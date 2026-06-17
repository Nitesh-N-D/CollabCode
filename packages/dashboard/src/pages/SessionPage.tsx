import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  BellRing,
  BrainCircuit,
  ChartNoAxesCombined,
  Check,
  Copy,
  History,
  Radio,
  Search,
  Send,
  Sparkles,
  Users,
  X
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import {
  EVENTS,
  type ClassroomState,
  type Hint,
  type ReplayData,
  type StudentState,
  type StuckAlert
} from "@collabcode/shared";
import { CodeViewer } from "../components/CodeViewer";
import { Logo } from "../components/Logo";
import { ReplayModal } from "../components/ReplayModal";
import { StudentCard } from "../components/StudentCard";
import { getSocket } from "../lib/socket";

type Filter = "all" | "active" | "attention" | "offline";

export function SessionPage() {
  const roomCode = (useParams().roomCode ?? "CS101").toUpperCase();
  const [state, setState] = useState<ClassroomState>({
    roomCode,
    title: `${roomCode} Live Lab`,
    students: [],
    hints: [],
    alerts: [],
    createdAt: Date.now()
  });
  const [connected, setConnected] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<StudentState>();
  const [targetId, setTargetId] = useState("");
  const [hint, setHint] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [replay, setReplay] = useState<ReplayData>();
  const [pairA, setPairA] = useState("");
  const [pairB, setPairB] = useState("");

  useEffect(() => {
    const socket = getSocket();
    const join = () => {
      setConnected(true);
      socket.emit(EVENTS.INSTRUCTOR_JOIN, { roomCode, instructorName: "Instructor" });
    };
    const onState = (next: ClassroomState) => setState(next);
    const onStudent = (student: StudentState) => {
      setState((current) => ({
        ...current,
        students: current.students.some((item) => item.studentId === student.studentId)
          ? current.students.map((item) => item.studentId === student.studentId ? student : item)
          : [...current.students, student]
      }));
      setSelected((current) => current?.studentId === student.studentId ? student : current);
    };
    const onAlert = (alert: StuckAlert) =>
      setState((current) => ({ ...current, alerts: [alert, ...current.alerts] }));
    const onHint = (sent: Hint) => {
      setState((current) => ({ ...current, hints: [sent, ...current.hints] }));
      setNotice("Hint delivered.");
      setTimeout(() => setNotice(""), 2200);
    };
    const onAi = (result: { studentId: string; hint: string; cached: boolean }) => {
      setHint(result.hint);
      setTargetId(result.studentId);
      setAiLoading(false);
    };
    const onReplay = (data: ReplayData) => setReplay(data);
    socket.on("connect", join);
    socket.on("disconnect", () => setConnected(false));
    socket.on(EVENTS.CLASSROOM_STATE, onState);
    socket.on(EVENTS.STUDENT_UPDATE, onStudent);
    socket.on(EVENTS.STUCK_ALERT, onAlert);
    socket.on(EVENTS.HINT_SENT, onHint);
    socket.on(EVENTS.AI_HINT_RESULT, onAi);
    socket.on(EVENTS.REPLAY_DATA, onReplay);
    socket.connect();
    if (socket.connected) join();
    return () => {
      socket.off("connect", join);
      socket.off(EVENTS.CLASSROOM_STATE, onState);
      socket.off(EVENTS.STUDENT_UPDATE, onStudent);
      socket.off(EVENTS.STUCK_ALERT, onAlert);
      socket.off(EVENTS.HINT_SENT, onHint);
      socket.off(EVENTS.AI_HINT_RESULT, onAi);
      socket.off(EVENTS.REPLAY_DATA, onReplay);
      socket.disconnect();
    };
  }, [roomCode]);

  const filtered = useMemo(() => state.students.filter((student) => {
    const matchesQuery = student.displayName.toLowerCase().includes(query.toLowerCase());
    if (!matchesQuery) return false;
    if (filter === "active") return student.status === "active";
    if (filter === "attention") return student.stuckFlag || student.helpRequested;
    if (filter === "offline") return !student.connected;
    return true;
  }), [filter, query, state.students]);

  const stuckCount = state.students.filter((student) => student.stuckFlag).length;
  const activeCount = state.students.filter((student) => student.status === "active").length;
  const helpCount = state.students.filter((student) => student.helpRequested).length;

  const sendHint = useCallback(() => {
    if (!hint.trim()) return;
    getSocket().emit(EVENTS.SEND_HINT, {
      roomCode,
      hint,
      targetStudentId: targetId || undefined,
      instructorName: "Instructor"
    });
    setHint("");
  }, [hint, roomCode, targetId]);

  function askAi(studentId: string) {
    setAiLoading(true);
    getSocket().emit(EVENTS.REQUEST_AI_HINT, { roomCode, studentId });
  }

  function assignPair() {
    if (!pairA || !pairB || pairA === pairB) return;
    getSocket().emit(EVENTS.ASSIGN_PAIR, { roomCode, studentAId: pairA, studentBId: pairB });
    setNotice("Pair assigned. Roles will swap automatically.");
  }

  return (
    <div className="session-shell">
      <header className="session-nav">
        <div><Link className="icon-button" to="/dashboard"><ArrowLeft size={18} /></Link><Logo /></div>
        <div className="live-title"><span className={connected ? "live-dot" : "offline-dot"} /><div><strong>{state.title}</strong><small>{connected ? "Live connection" : "Reconnecting"}</small></div></div>
        <div><Link className="button secondary small" to={`/analytics/${roomCode}`}><ChartNoAxesCombined size={16} /> Analytics</Link><span className="room-pill">{roomCode}</span><button className="icon-button" onClick={() => navigator.clipboard.writeText(roomCode)} type="button"><Copy size={16} /></button></div>
      </header>
      <main className="session-main">
        <section className="classroom">
          <div className="class-summary">
            <div><span className="eyebrow"><Radio size={14} /> Live classroom</span><h1>Class pulse</h1><p>Scan the room. Step in where your attention changes the outcome.</p></div>
            <div className="summary-metrics">
              <span><b>{state.students.length}</b><small>Students</small></span>
              <span className="green"><b>{activeCount}</b><small>Active</small></span>
              <span className="red"><b>{stuckCount}</b><small>Attention</small></span>
              <span className="blue"><b>{helpCount}</b><small>Help</small></span>
            </div>
          </div>
          {state.alerts[0] && (
            <div className={`alert-banner ${state.alerts[0].commonPattern ? "common" : ""}`}>
              <span><Sparkles size={19} /></span>
              <div><strong>{state.alerts[0].commonPattern ? "Class-wide pattern detected" : state.alerts[0].displayName}</strong><p>{state.alerts[0].message}</p></div>
              {state.alerts[0].studentId && <button className="button ghost small" onClick={() => askAi(state.alerts[0].studentId!)} type="button"><BrainCircuit size={15} /> Draft hint</button>}
              <button className="icon-button" type="button"><X size={16} /></button>
            </div>
          )}
          <div className="filter-bar">
            <div className="filter-tabs">
              {(["all", "active", "attention", "offline"] as Filter[]).map((item) => (
                <button className={filter === item ? "active" : ""} onClick={() => setFilter(item)} type="button" key={item}>{item}</button>
              ))}
            </div>
            <label className="search"><Search size={16} /><input placeholder="Find a student" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          </div>
          {filtered.length ? (
            <div className="student-grid">
              {filtered.map((student) => <StudentCard student={student} selected={selected?.studentId === student.studentId} onClick={() => setSelected(student)} key={student.studentId} />)}
            </div>
          ) : (
            <div className="empty-class"><Users /><h3>Waiting for students</h3><p>Run <code>pnpm sim</code> or join room <strong>{roomCode}</strong> from the extension.</p></div>
          )}
        </section>
        <aside className="control-panel">
          <section>
            <div className="panel-heading"><div><span className="eyebrow"><BellRing size={14} /> Intervention</span><h2>Send a hint</h2></div>{targetId && <button onClick={() => setTargetId("")} type="button">Clear target</button>}</div>
            <label>Audience<select value={targetId} onChange={(event) => setTargetId(event.target.value)}><option value="">Entire class</option>{state.students.map((student) => <option value={student.studentId} key={student.studentId}>{student.displayName}</option>)}</select></label>
            <textarea placeholder="Ask one question that unlocks the next step..." value={hint} onChange={(event) => setHint(event.target.value)} />
            <div className="composer-actions">
              <button className="button secondary small" disabled={!targetId || aiLoading} onClick={() => askAi(targetId)} type="button"><Sparkles size={15} />{aiLoading ? "Thinking..." : "AI draft"}</button>
              <button className="button primary small" disabled={!hint.trim()} onClick={sendHint} type="button"><Send size={15} /> Send</button>
            </div>
          </section>
          <section>
            <div className="panel-heading"><div><span className="eyebrow"><Users size={14} /> Collaboration</span><h2>Pair students</h2></div></div>
            <div className="pair-fields">
              <select value={pairA} onChange={(event) => setPairA(event.target.value)}><option value="">Choose driver</option>{state.students.map((student) => <option value={student.studentId} key={student.studentId}>{student.displayName}</option>)}</select>
              <select value={pairB} onChange={(event) => setPairB(event.target.value)}><option value="">Choose observer</option>{state.students.map((student) => <option value={student.studentId} key={student.studentId}>{student.displayName}</option>)}</select>
            </div>
            <button className="button secondary full" onClick={assignPair} type="button">Assign pair · auto-swap</button>
          </section>
          <section className="activity-panel">
            <div className="panel-heading"><div><span className="eyebrow"><Activity size={14} /> Recent signals</span><h2>Room activity</h2></div></div>
            <div className="activity-list">
              {state.students.slice().sort((a, b) => b.lastSeen - a.lastSeen).slice(0, 5).map((student) => (
                <button onClick={() => { getSocket().emit(EVENTS.REQUEST_REPLAY, { roomCode, studentId: student.studentId }); }} type="button" key={student.studentId}>
                  <span className={`activity-dot ${student.status}`} /><span><strong>{student.displayName}</strong><small>{student.fileName || "joined the room"}</small></span><History size={14} />
                </button>
              ))}
            </div>
          </section>
          {notice && <div className="toast"><Check size={16} />{notice}</div>}
        </aside>
      </main>
      {selected && <CodeViewer student={selected} onClose={() => setSelected(undefined)} />}
      {replay && <ReplayModal replay={replay} onClose={() => setReplay(undefined)} />}
    </div>
  );
}
