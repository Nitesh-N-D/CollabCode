import { useEffect, useState } from "react";
import { ArrowLeft, Download, FileWarning, Gauge, ShieldCheck, Users } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AnalyticsReport, IntegrityReport } from "@collabcode/shared";
import { Logo } from "../components/Logo";
import { api, downloadExport } from "../lib/api";

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

  return (
    <div className="analytics-page">
      <header className="analytics-nav"><div><Link className="icon-button" to={`/session/${roomCode}`}><ArrowLeft size={18} /></Link><Logo /></div><span className="room-pill">{roomCode}</span></header>
      <main>
        <div className="analytics-heading"><div><span className="eyebrow">Room intelligence</span><h1>Class analytics</h1><p>Review attention patterns, struggle hotspots, and process similarity.</p></div><div className="export-actions"><button className="button secondary" onClick={() => downloadExport(roomCode, "json")} type="button"><Download size={16} /> JSON</button><button className="button secondary" onClick={() => downloadExport(roomCode, "csv")} type="button"><Download size={16} /> CSV</button></div></div>
        {error && <div className="offline-banner">{error}</div>}
        {!report && !error && <div className="empty-state">Loading persisted session analytics…</div>}
        {report && <>
          <div className="analytics-cards">
            <article><Users /><span><small>Total students</small><strong>{report.totalStudents}</strong></span></article>
            <article><Gauge /><span><small>Connected now</small><strong>{report.connectedStudents}</strong></span></article>
            <article><FileWarning /><span><small>Need attention</small><strong>{report.stuckStudents}</strong></span></article>
            <article><ShieldCheck /><span><small>Hints sent</small><strong>{report.hintsSent}</strong></span></article>
          </div>
          <section className="chart-card">
            <div><span className="eyebrow">Session timeline</span><h2>How the room moved</h2><p>Thirty-second activity buckets computed from persisted telemetry.</p></div>
            {report.timeline.length ? <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={report.timeline}>
                <CartesianGrid stroke="#202735" vertical={false} />
                <XAxis dataKey="timestamp" tickFormatter={(value: number) => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} stroke="#727e93" />
                <YAxis stroke="#727e93" allowDecimals={false} />
                <Tooltip labelFormatter={(value) => new Date(Number(value)).toLocaleTimeString()} contentStyle={{ background: "#111722", border: "1px solid #293244" }} />
                <Area type="monotone" dataKey="activeCount" stackId="1" stroke="#42d39b" fill="#42d39b" fillOpacity={0.35} />
                <Area type="monotone" dataKey="stuckCount" stackId="1" stroke="#ff6b7a" fill="#ff6b7a" fillOpacity={0.4} />
              </AreaChart>
            </ResponsiveContainer> : <div className="empty-chart">The timeline will appear after telemetry arrives.</div>}
          </section>
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
