import {
  Activity,
  BadgeCheck,
  BrainCircuit,
  GitBranch,
  Gauge,
  Orbit,
  Radar,
  ShieldCheck,
  Sparkles,
  UsersRound
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ClassroomState, StudentState } from "@collabcode/shared";

interface IntelligenceDeckProps {
  state: ClassroomState;
  onSelectStudent: (student: StudentState) => void;
}

interface IntelligenceFeature {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone: "hot" | "good" | "warm" | "neutral" | "violet";
  action?: () => void;
}

export function IntelligenceDeck({ state, onSelectStudent }: IntelligenceDeckProps) {
  const students = state.students;
  const connected = students.filter((student) => student.connected);
  const attention = connected.filter((student) => student.stuckFlag || student.helpRequested);
  const queue = attention.slice().sort((a, b) =>
    (b.helpRequested ? 120 : b.stuckScore) - (a.helpRequested ? 120 : a.stuckScore)
  );
  const active = connected.filter((student) => student.status === "active");
  const focused = connected.filter((student) => student.focusProtected);
  const paired = connected.filter((student) => student.pairPartnerId);
  const rising = connected.filter((student) => student.riskTrend === "rising");
  const recovering = connected.filter((student) => student.riskTrend === "falling");
  const languages = new Set(connected.map((student) => student.languageId).filter(Boolean));
  const workspaces = new Set(connected.map((student) => student.fileName).filter(Boolean));
  const uniqueCode = new Set(connected.map((student) =>
    student.content.replace(/\s+/g, " ").trim().slice(0, 400)
  ).filter(Boolean));
  const hintsRead = state.hints.reduce((sum, hint) => sum + hint.readBy.length, 0);
  const targetedHints = state.hints.reduce((sum, hint) =>
    sum + (hint.targetStudentId ? 1 : Math.max(1, connected.length)), 0
  );
  const hintReach = targetedHints ? Math.min(100, Math.round(hintsRead / targetedHints * 100)) : 0;
  const averageVelocity = connected.length
    ? Math.round(connected.reduce((sum, student) => sum + student.editRate, 0) / connected.length)
    : 0;
  const health = connected.length
    ? Math.max(0, Math.round((active.length - attention.length * 0.7) / connected.length * 100))
    : 0;
  const readiness = connected.length
    ? Math.max(0, Math.round((active.length + recovering.length * 0.5 - rising.length) / connected.length * 100))
    : 0;
  const divergence = connected.length
    ? Math.round(uniqueCode.size / connected.length * 100)
    : 0;

  const features: IntelligenceFeature[] = [
    {
      icon: BrainCircuit,
      label: "Intervention autopilot",
      value: queue.length ? `${queue.length} queued` : "Clear",
      detail: queue[0] ? `${queue[0].displayName} has the highest current need.` : "No intervention signal is active.",
      tone: queue.length ? "hot" : "good",
      action: queue[0] ? () => onSelectStudent(queue[0]) : undefined
    },
    {
      icon: Gauge,
      label: "Room health",
      value: `${health}%`,
      detail: "Live balance of flow, help requests, and stuck signals.",
      tone: health >= 70 ? "good" : health >= 40 ? "warm" : "hot"
    },
    {
      icon: Activity,
      label: "Momentum compass",
      value: `${averageVelocity}/min`,
      detail: "Average real editor-change velocity across connected students.",
      tone: averageVelocity > 2 ? "good" : "neutral"
    },
    {
      icon: ShieldCheck,
      label: "Flow shields",
      value: `${focused.length} protected`,
      detail: "Students in productive flow who should not be interrupted.",
      tone: "violet"
    },
    {
      icon: Radar,
      label: "Silent-drift radar",
      value: rising.length ? `${rising.length} rising` : "Stable",
      detail: "Forecasts risk before a student explicitly asks for help.",
      tone: rising.length ? "warm" : "good",
      action: rising[0] ? () => onSelectStudent(rising[0]) : undefined
    },
    {
      icon: Sparkles,
      label: "Recovery runway",
      value: `${recovering.length} recovering`,
      detail: "Momentum returning after idle, errors, or an intervention.",
      tone: recovering.length ? "good" : "neutral"
    },
    {
      icon: Orbit,
      label: "Knowledge constellation",
      value: `${languages.size} stacks`,
      detail: `${workspaces.size} active files grouped from real editor context.`,
      tone: "violet"
    },
    {
      icon: GitBranch,
      label: "Solution divergence",
      value: `${divergence}%`,
      detail: "How independently the room's current solutions are evolving.",
      tone: divergence > 60 ? "good" : "warm"
    },
    {
      icon: BadgeCheck,
      label: "Hint impact loop",
      value: `${hintReach}% read`,
      detail: `${hintsRead} acknowledgements across ${state.hints.length} delivered hints.`,
      tone: hintReach > 65 ? "good" : "neutral"
    },
    {
      icon: UsersRound,
      label: "Checkpoint readiness",
      value: `${readiness}%`,
      detail: `${paired.length} students paired; readiness updates with every snapshot.`,
      tone: readiness >= 70 ? "good" : readiness >= 40 ? "warm" : "neutral"
    }
  ];

  return (
    <section className="intelligence-deck" aria-label="Live classroom intelligence">
      <div className="deck-heading">
        <div><span className="eyebrow"><Sparkles size={13} /> Live intelligence deck</span><h2>Ten signals. One calm decision surface.</h2></div>
        <span className="real-data-chip"><i /> Derived from {connected.length} live editors</span>
      </div>
      <div className="intelligence-grid">
        {features.map(({ icon: Icon, label, value, detail, tone, action }) => (
          <article className={`intelligence-card ${tone} ${action ? "actionable" : ""}`} key={label}>
            <div><span className="signal-icon"><Icon size={16} /></span><small>{label}</small></div>
            <strong>{value}</strong>
            <p>{detail}</p>
            {action && <button type="button" onClick={action}>Inspect signal</button>}
          </article>
        ))}
      </div>
    </section>
  );
}
