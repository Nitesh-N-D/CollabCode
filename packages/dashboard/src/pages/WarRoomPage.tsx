import { useEffect, useState } from "react";
import { Activity, ArrowLeft, RadioTower, ServerOff, Users } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import type { ActiveSessionSummary } from "@collabcode/shared";
import { Logo } from "../components/Logo";
import { api } from "../lib/api";

export function WarRoomPage() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<ActiveSessionSummary[]>();
  const [error, setError] = useState("");

  useEffect(() => {
    api.activeSessions().then(setRooms).catch(() => setError("Active rooms could not be loaded."));
  }, []);

  return <div className="analytics-page">
    <header className="analytics-nav"><div><Link className="icon-button" to="/dashboard"><ArrowLeft size={18} /></Link><Logo /></div></header>
    <main>
      <div className="analytics-heading"><div><span className="eyebrow"><Activity size={14} /> Teaching team</span><h1>War room</h1><p>Every live room you own or support, in one calm view.</p></div></div>
      {error && <div className="offline-banner"><ServerOff size={18} />{error}</div>}
      {rooms === undefined ? <div className="empty-state">Loading active rooms…</div>
        : rooms.length === 0 ? <div className="empty-state"><RadioTower /><h3>No rooms are live</h3><p>Active owned and co-instructor sessions will appear here.</p></div>
          : <section className="war-room-list">{rooms.map((room) =>
            <button type="button" className="war-room-row" onClick={() => navigate(`/session/${room.roomCode}`)} key={room.id}>
              <span className="live-dot" />
              <span><strong>{room.title}</strong><small>{room.assignmentName} · {room.instructorName}</small></span>
              <span><Users size={15} /> {room.studentCount} live</span>
              <span className={room.stuckCount ? "attention" : ""}>{room.stuckCount} need attention</span>
              <span className="mini-pulse" aria-label="Live room pulse">{room.pulse.length
                ? room.pulse.slice(-8).map((point) => <i style={{ height: `${Math.max(4, Math.min(22, point.editRate + point.activeCount * 2))}px` }} key={point.timestamp} />)
                : <small>No pulse yet</small>}</span>
              <code>{room.roomCode}</code>
            </button>)}</section>}
    </main>
  </div>;
}
