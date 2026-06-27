import { CircleHelp, Code2, Radio, Users } from "lucide-react";
import type { StudentState } from "@collabcode/shared";

const STATUS_LABEL: Record<StudentState["status"], string> = {
  active: "Coding",
  idle: "Idle",
  stuck: "Needs attention",
  needs_help: "Asked for help",
  offline: "Offline"
};

export function StudentCard({
  student,
  selected,
  onClick
}: {
  student: StudentState;
  selected: boolean;
  onClick: () => void;
}) {
  const initials = student.displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
  const recentIdle = student.sessionEvents.filter((event) => event.type === "snapshot")
    .slice(-4).map((event) => event.idleMs ?? 0);
  const riskRising = !student.stuckFlag && recentIdle.length >= 3
    && recentIdle.every((value, index) => index === 0 || value >= recentIdle[index - 1])
    && recentIdle[recentIdle.length - 1] >= 15_000;
  return (
    <button
      className={`student-card status-${student.status} ${selected ? "selected" : ""}`}
      onClick={onClick}
      type="button"
    >
      <div className="student-head">
        <span className="avatar">{initials}</span>
        <span className="student-copy">
          <strong>{student.displayName}</strong>
          <small><span className="status-dot" />{STATUS_LABEL[student.status]}</small>
        </span>
        {riskRising && <span className="risk-rising">Rising</span>}
        {student.helpRequested && <CircleHelp className="help-icon" size={18} />}
      </div>
      <div className="student-file"><Code2 size={14} />{student.fileName || "Waiting for editor"}</div>
      <div className="code-peek">
        {student.content
          ? student.content.split("\n").slice(-3).join("\n")
          : "No snapshot received yet"}
      </div>
      <div className="student-meta">
        <span><Radio size={13} />{Math.round(student.idleMs / 1000)}s idle</span>
        <span>{student.pairPartnerId ? <><Users size={13} />{student.pairRole}</> : `${student.stuckScore}% risk`}</span>
      </div>
      <div className="stuck-meter" aria-label={`Attention risk ${student.stuckScore}%`}>
        {[20, 40, 60, 80, 100].map((threshold) =>
          <i className={student.stuckScore >= threshold ? "filled" : ""} key={threshold} />)}
      </div>
    </button>
  );
}
