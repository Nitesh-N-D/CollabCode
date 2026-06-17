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
