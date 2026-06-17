import { useEffect, useState } from "react";
import { ArrowRight, Plus, RadioTower, ServerOff, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { ClassroomState } from "@collabcode/shared";
import { Logo } from "../components/Logo";
import { api } from "../lib/api";

export function DashboardPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<ClassroomState[]>([]);
  const [title, setTitle] = useState("Algorithms lab");
  const [roomCode, setRoomCode] = useState("CS101");
  const [error, setError] = useState("");

  useEffect(() => {
    api.sessions().then(setSessions).catch(() => setError("The server is offline. Start it on port 4000."));
  }, []);

  async function createSession() {
    setError("");
    try {
      const session = await api.createSession(title, roomCode);
      navigate(`/session/${session.roomCode}`);
    } catch {
      setError("Could not create the room. Check that the server is running.");
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Logo />
        <nav><a className="active"><RadioTower size={17} /> Sessions</a><a><Users size={17} /> Students</a></nav>
        <div className="sidebar-foot"><span className="avatar small-avatar">IN</span><div><strong>Instructor</strong><small>Local workspace</small></div></div>
      </aside>
      <main className="dashboard-page">
        <header className="page-header"><div><span className="eyebrow">Instructor workspace</span><h1>Good to see you.</h1><p>Start a room or resume a classroom already in motion.</p></div></header>
        {error && <div className="offline-banner"><ServerOff size={18} />{error}</div>}
        <section className="create-session">
          <div className="create-copy"><span className="create-icon"><Plus /></span><div><h2>Create a live session</h2><p>Students join with the room code from their VS Code extension.</p></div></div>
          <div className="create-fields">
            <label>Session name<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
            <label>Room code<input maxLength={8} value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} /></label>
            <button className="button primary" onClick={createSession} type="button">Launch room <ArrowRight size={17} /></button>
          </div>
        </section>
        <section className="session-list">
          <div className="list-heading"><div><h2>Recent rooms</h2><p>Rooms remain in memory while the server is running.</p></div><span>{sessions.length} total</span></div>
          {sessions.length === 0 ? (
            <div className="empty-state"><RadioTower /><h3>No sessions yet</h3><p>Create your first room above, then run the simulator.</p></div>
          ) : sessions.map((session) => (
            <button className="session-row" onClick={() => navigate(`/session/${session.roomCode}`)} type="button" key={session.roomCode}>
              <span className="session-symbol"><RadioTower size={18} /></span>
              <span><strong>{session.title}</strong><small>Created {new Date(session.createdAt).toLocaleString()}</small></span>
              <span className="room-code">{session.roomCode}</span>
              <span>{session.students.length} students</span>
              <ArrowRight size={17} />
            </button>
          ))}
        </section>
      </main>
    </div>
  );
}
