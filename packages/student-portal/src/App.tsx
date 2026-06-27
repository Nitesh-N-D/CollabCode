import { randomUUID } from "./uuid";
import { useEffect, useState } from "react";
import { Check, CircleHelp, Download, RadioTower } from "lucide-react";
import { Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";
import { EVENTS, type Hint, type ProgressReceipt, type SessionInfo } from "@collabcode/shared";

const SERVER = import.meta.env.VITE_SERVER_URL ?? "http://localhost:4000";

function Join() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [roomCode, setRoomCode] = useState((params.get("code") ?? "").toUpperCase());
  const [name, setName] = useState(localStorage.getItem("collabcode.name") ?? "");
  const [error, setError] = useState("");
  async function join() {
    const response = await fetch(`${SERVER}/api/public/sessions/${roomCode}`);
    if (!response.ok) return setError("That room is not active. Check the code with your instructor.");
    localStorage.setItem("collabcode.name", name.trim());
    navigate(`/room/${roomCode}?name=${encodeURIComponent(name.trim())}`);
  }
  return <main className="join-shell"><section><RadioTower /><h1>Join a live session</h1><p>Enter the code your instructor shared. No account is required.</p>
    <label>Room code<input value={roomCode} maxLength={6} onChange={(e) => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}/></label>
    <label>Your name<input value={name} onChange={(e) => setName(e.target.value)}/></label>
    <button disabled={roomCode.length !== 6 || !name.trim()} onClick={join}>Join session</button>{error && <small>{error}</small>}
  </section></main>;
}

function Room() {
  const { code = "" } = useParams();
  const [params] = useSearchParams();
  const name = params.get("name")?.trim() ?? "";
  const [connected, setConnected] = useState(false);
  const [info, setInfo] = useState<SessionInfo>();
  const [hints, setHints] = useState<Hint[]>([]);
  const [read, setRead] = useState<string[]>([]);
  const [helpSent, setHelpSent] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<ProgressReceipt>();
  const [socket] = useState(() => io(SERVER, { autoConnect: false }));
  const [studentId] = useState(() => localStorage.getItem("collabcode.studentId") ?? randomUUID());
  useEffect(() => {
    localStorage.setItem("collabcode.studentId", studentId);
    socket.on("connect", () => {
      setConnected(true);
      socket.emit(EVENTS.STUDENT_JOIN, { roomCode: code, studentId, displayName: name });
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on(EVENTS.SESSION_INFO, setInfo);
    socket.on(EVENTS.HINT_RECEIVE, (hint) => setHints((current) => [hint, ...current]));
    socket.on(EVENTS.ERROR, ({ message }) => setError(message));
    socket.on(EVENTS.SESSION_ENDED, async () => {
      setConnected(false);
      try {
        const response = await fetch(`${SERVER}/api/progress/${code}/${studentId}`);
        if (!response.ok) throw new Error("Receipt unavailable");
        setReceipt(await response.json() as ProgressReceipt);
      } catch {
        setError("The session ended. Your personal summary is still being prepared.");
      }
    });
    socket.connect();
    return () => { socket.disconnect(); };
  }, [code, name, socket, studentId]);
  if (!name) return <Navigate to={`/?code=${code}`} replace />;
  if (receipt) return <main className="join-shell"><section className="receipt">
    <Check /><span>Session complete</span><h1>Your progress receipt</h1>
    <p>You spent <strong>{receipt.activeRatio}%</strong> of the session in flow and <strong>{receipt.trickyRatio}%</strong> working through tricky parts. Both are a normal, useful part of learning.</p>
    <div><span><b>{Math.round(receipt.codingMs / 60_000)}</b><small>minutes coding</small></span><span><b>{receipt.hintsRead}/{receipt.hintsReceived}</b><small>hints read</small></span></div>
    <a className="download" href={`${SERVER}/api/export/${code}/${studentId}/json`}><Download /> Download my session</a>
  </section></main>;
  return <main className="room-shell"><section className="status-card"><header><RadioTower/><div><h1>{info?.title ?? "Connecting…"}</h1><p>{info?.assignmentName}</p></div><span className={connected ? "online" : "offline"}>{connected ? "Connected" : "Reconnecting"}</span></header>
    {info && <div className="session-meta">Instructor: {info.instructorName} · Room {info.roomCode}</div>}
    <button className="help" disabled={helpSent || !connected} onClick={() => {
      socket.emit(EVENTS.HELP_REQUEST, { roomCode: code, studentId });
      setHelpSent(true);
    }}><CircleHelp/>{helpSent ? "Help request sent" : "Request help privately"}</button>
    {error && <div className="error">{error}</div>}
  </section><section className="hints"><h2>Hints from your instructor</h2>{hints.length === 0 ? <p>No hints yet.</p> : hints.map((hint) => <article key={hint.id}><small>{new Date(hint.sentAt).toLocaleTimeString()}</small><p>{hint.hint}</p>{hint.codeSnippet && <pre>{hint.codeSnippet}</pre>}<button disabled={read.includes(hint.id)} onClick={() => {
      socket.emit(EVENTS.HINT_READ, { roomCode: code, studentId, hintId: hint.id });
      setRead((current) => [...current, hint.id]);
    }}><Check/>{read.includes(hint.id) ? "Acknowledged" : "Got it"}</button></article>)}</section></main>;
}

export function App() { return <Routes><Route path="/" element={<Join/>}/><Route path="/room/:code" element={<Room/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes>; }
