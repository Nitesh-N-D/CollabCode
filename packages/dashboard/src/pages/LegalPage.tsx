import { ArrowLeft, LockKeyhole, Scale, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Logo } from "../components/Logo";

const privacy = [
  ["What CollabCode processes", "Room code, display name, active-file snapshots, editor signals, private help requests, and instructor hints while a session is active."],
  ["How it is used", "Only to run the selected classroom: show progress to the teaching team, deliver hints, create replays, and prepare the session analytics."],
  ["Who can see it", "Authorized instructors in the room can view student activity. Students receive only their own private help and pairing information; code is never broadcast to classmates."],
  ["Your controls", "Leave a room at any time, export your locally recorded session from the extension, and ask your institution or room owner about retention and deletion."],
];
const terms = [
  ["Use of the service", "Use CollabCode only in classrooms or teams where you are authorized to participate. Instructors are responsible for the rooms they create and people they invite."],
  ["Responsible collaboration", "Do not use the service to harass, impersonate, or access another participant’s work outside a session’s intended teaching purpose."],
  ["Service boundaries", "Signals help instructors make decisions; they are not a grading engine or a guarantee of student understanding. Review context before acting on an alert."],
  ["Changes and support", "We may improve the product as classroom needs change. Material policy updates will be reflected on this page with a revised date."],
];

export function LegalPage({ kind }: { kind: "privacy" | "terms" }) {
  const isPrivacy = kind === "privacy";
  const entries = isPrivacy ? privacy : terms;
  const Icon = isPrivacy ? LockKeyhole : Scale;
  return <main className="legal-page">
    <nav className="legal-nav"><Logo /><Link className="button secondary small" to="/"><ArrowLeft size={15} /> Back to home</Link></nav>
    <section className="legal-card">
      <span className="legal-icon"><Icon size={24} /></span>
      <span className="eyebrow">CollabCode policies</span>
      <h1>{isPrivacy ? "Privacy, without the fine-print maze." : "Terms built for collaborative classrooms."}</h1>
      <p className="legal-lead">Last updated August 23, 2026. This plain-language summary explains the rules for using CollabCode.</p>
      <div className="legal-list">{entries.map(([title, body]) => <article key={title}><ShieldCheck size={17} /><div><h2>{title}</h2><p>{body}</p></div></article>)}</div>
      <p className="legal-contact">Questions about these policies? Contact your instructor or the team that manages your CollabCode deployment.</p>
    </section>
  </main>;
}
