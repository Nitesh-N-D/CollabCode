import { Code2, X } from "lucide-react";
import type { StudentState } from "@collabcode/shared";

export function CodeViewer({
  student,
  onClose
}: {
  student: StudentState;
  onClose: () => void;
}) {
  const lines = (student.content || "// Waiting for the first code snapshot...").split("\n");
  const snapshots = student.sessionEvents.filter((event) => event.type === "snapshot" && event.content !== undefined);
  const previous = snapshots.length > 1 ? snapshots[snapshots.length - 2].content?.split("\n") ?? [] : [];
  const current = student.content.split("\n");
  const added = current.filter((line, index) => previous[index] !== line && !previous.includes(line)).length;
  const removed = previous.filter((line, index) => current[index] !== line && !current.includes(line)).length;
  const modified = current.filter((line, index) => previous[index] !== undefined && previous[index] !== line
    && previous.includes(line) === false).length;
  return (
    <div className="drawer-backdrop" onMouseDown={onClose}>
      <aside className="code-drawer" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span className="eyebrow"><Code2 size={14} /> Live editor</span>
            <h2>{student.displayName}</h2>
            <p>{student.fileName || "No file"} · {student.languageId || "unknown"}</p>
          </div>
          <button className="icon-button" onClick={onClose} type="button"><X size={18} /></button>
        </header>
        <div className="diff-ribbon">
          {snapshots.length > 1 ? <><span className="added">+{added} added</span><span className="removed">−{removed} removed</span><span>{modified} modified</span></>
            : <span>Diff appears after the next real snapshot.</span>}
        </div>
        <div className="code-window">
          {lines.map((line, index) => (
            <div className={student.cursorLine === index + 1 ? "current-line" : ""} key={`${index}-${line}`}>
              <span>{index + 1}</span><code>{line || " "}</code>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
