import { useEffect, useState } from "react";
import { ArrowRight, Check, Plus, RadioTower, ServerOff, Users } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import type { ClassroomState } from "@collabcode/shared";
import { Logo } from "../components/Logo";
import { api } from "../lib/api";
import { supabase } from "../lib/supabase";

export function DashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sessions, setSessions] = useState<ClassroomState[]>();
  const [title, setTitle] = useState("");
  const [assignmentName, setAssignmentName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.sessions().then(setSessions).catch(() => setError("The server is offline. Start it on port 4000."));
  }, []);

  async function createSession() {
    setError("");
    try {
      const session = await api.createSession(title, assignmentName);
      navigate(`/session/${session.roomCode}`);
    } catch {
      setError("Could not create the room. Check that the server is running.");
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Logo />
        <nav><a className="active"><RadioTower size={17} /> Sessions</a><button type="button" onClick={() => navigate("/warroom")}><Users size={17} /> War room</button></nav>
        <button className="sidebar-foot" onClick={() => { void supabase.auth.signOut().then(({ error: signOutError }) => { if (signOutError) setError("Could not sign out. Please try again."); }); }} type="button"><span className="avatar small-avatar">IN</span><div><strong>Instructor</strong><small>Sign out</small></div></button>
      </aside>
      <main className="dashboard-page">
        <header className="page-header"><div><span className="eyebrow">Instructor workspace</span><h1>Good to see you.</h1><p>Start a room or resume a classroom already in motion.</p></div></header>
        {typeof location.state === "object" && location.state && "notice" in location.state && (
          <div className="success-banner"><Check size={18} />{String(location.state.notice)}</div>
        )}
        {error && <div className="offline-banner"><ServerOff size={18} />{error}</div>}
        <section className="create-session">
          <div className="create-copy"><span className="create-icon"><Plus /></span><div><h2>Create a live session</h2><p>Students join with the room code from their VS Code extension.</p></div></div>
          <div className="create-fields">
            <label>Session name<input placeholder="e.g. Week 4 lab" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
            <label>Assignment<input placeholder="e.g. Graph traversal" value={assignmentName} onChange={(event) => setAssignmentName(event.target.value)} /></label>
            <button className="button primary" disabled={!title.trim() || !assignmentName.trim()} onClick={createSession} type="button">Launch room <ArrowRight size={17} /></button>
          </div>
        </section>
        <section className="session-list">
          <div className="list-heading"><div><h2>Your sessions</h2><p>Live and completed sessions stored securely in Supabase.</p></div>{sessions && <span>{sessions.length} total</span>}</div>
          {sessions === undefined ? <div className="empty-state">Loading your sessions…</div> : sessions.length === 0 ? (
            <div className="empty-state"><RadioTower /><h3>No sessions yet</h3><p>Create your first room above and share its generated code.</p></div>
          ) : sessions.map((session) => (
            <button className="session-row" onClick={() => navigate(session.active
              ? `/session/${session.roomCode}`
              : `/analytics/${session.roomCode}`)} type="button" key={session.roomCode}>
              <span className="session-symbol"><RadioTower size={18} /></span>
              <span><strong>{session.title}</strong><small>Created {new Date(session.createdAt).toLocaleString()}</small></span>
              <span className={`room-code ${session.active ? "" : "ended"}`}>{session.active ? session.roomCode : "Completed"}</span>
              <span>{session.students.length} students</span>
              <ArrowRight size={17} />
            </button>
          ))}
        </section>
      </main>
    </div>
  );
}
