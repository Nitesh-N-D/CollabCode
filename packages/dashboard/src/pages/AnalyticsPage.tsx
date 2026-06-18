import { useEffect, useState } from "react";
import { ArrowLeft, Download, FileWarning, Gauge, ShieldCheck, Users } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AnalyticsReport, IntegrityReport } from "@collabcode/shared";
import { Logo } from "../components/Logo";
import { api } from "../lib/api";

export function AnalyticsPage() {
  const roomCode = (useParams().roomCode ?? "").toUpperCase();
  const [report, setReport] = useState<AnalyticsReport>();
  const [integrity, setIntegrity] = useState<IntegrityReport>();
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.analytics(roomCode), api.integrity(roomCode)])
      .then(([analytics, integrityReport]) => {
        setReport(analytics);
        setIntegrity(integrityReport);
      })
      .catch(() => setError("Analytics are unavailable. Check that the server and room are active."));
  }, [roomCode]);

  function download() {
    if (!report) return;
    const href = URL.createObjectURL(new Blob([JSON.stringify({ report, integrity }, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `collabcode-${roomCode}-analytics.json`;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  return (
    <div className="analytics-page">
      <header className="analytics-nav"><div><Link className="icon-button" to={`/session/${roomCode}`}><ArrowLeft size={18} /></Link><Logo /></div><span className="room-pill">{roomCode}</span></header>
      <main>
        <div className="analytics-heading"><div><span className="eyebrow">Room intelligence</span><h1>Class analytics</h1><p>Review attention patterns, struggle hotspots, and process similarity.</p></div><button className="button secondary" onClick={download} type="button"><Download size={16} /> Export report</button></div>
        {error && <div className="offline-banner">{error}</div>}
        {report && <>
          <div className="analytics-cards">
            <article><Users /><span><small>Total students</small><strong>{report.totalStudents}</strong></span></article>
            <article><Gauge /><span><small>Connected now</small><strong>{report.connectedStudents}</strong></span></article>
            <article><FileWarning /><span><small>Need attention</small><strong>{report.stuckStudents}</strong></span></article>
            <article><ShieldCheck /><span><small>Hints sent</small><strong>{report.hintsSent}</strong></span></article>
          </div>
          <section className="chart-card">
            <div><span className="eyebrow">Struggle heatmap</span><h2>Where the room slowed down</h2><p>Idle-heavy cursor regions grouped into five-line buckets.</p></div>
            {report.heatmap.length ? <ResponsiveContainer width="100%" height={320}>
              <BarChart data={report.heatmap.slice(0, 12)} margin={{ top: 20, right: 10, left: 0, bottom: 30 }}>
                <CartesianGrid stroke="#202735" vertical={false} />
                <XAxis dataKey="fileName" stroke="#727e93" tickLine={false} axisLine={false} />
                <YAxis stroke="#727e93" tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "#111722", border: "1px solid #293244", borderRadius: 10 }} />
                <Bar dataKey="totalIdleMs" fill="#8b7cf8" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer> : <div className="empty-chart">No struggle hotspots were recorded for this session.</div>}
          </section>
          <section className="integrity-card">
            <div><span className="eyebrow">Academic integrity</span><h2>Process similarity review</h2><p>This is a review signal, never an automatic accusation.</p></div>
            {integrity?.suspectedPairs.length ? integrity.suspectedPairs.map((pair) => (
              <article key={`${pair.student1Id}-${pair.student2Id}`}><span>{pair.similarityScore}%</span><div><strong>{pair.student1Name} and {pair.student2Name}</strong><p>{pair.evidence}</p></div></article>
            )) : <div className="clean-report"><ShieldCheck />No high-similarity coding processes detected.</div>}
          </section>
        </>}
      </main>
    </div>
  );
}
