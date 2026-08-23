import { useState } from "react";
import { Check, Code2, Copy, X } from "lucide-react";
import type { StudentState } from "@collabcode/shared";
import { copyText } from "../lib/clipboard";

export function CodeViewer({
  student,
  onClose
}: {
  student: StudentState;
  onClose: () => void;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const lines = (student.content || "// Waiting for the first code snapshot...").split("\n");
  const snapshots = student.sessionEvents.filter((event) => event.type === "snapshot" && event.content !== undefined);
  const previous = snapshots.length > 1 ? snapshots[snapshots.length - 2].content?.split("\n") ?? [] : [];
  const current = student.content.split("\n");
  const added = current.filter((line, index) => previous[index] !== line && !previous.includes(line)).length;
  const removed = previous.filter((line, index) => current[index] !== line && !current.includes(line)).length;
  const modified = current.filter((line, index) => previous[index] !== undefined && previous[index] !== line
    && previous.includes(line) === false).length;
  async function copyCode() {
    try {
      await copyText(student.content);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }
  return (
    <div className="drawer-backdrop" onMouseDown={onClose}>
      <aside className="code-drawer" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span className="eyebrow"><Code2 size={14} /> Live editor</span>
            <h2>{student.displayName}</h2>
            <p>{student.fileName || "No file"} · {student.languageId || "unknown"}</p>
          </div>
          <div className="code-actions"><button className="button secondary small" onClick={() => { void copyCode(); }} type="button"><Copy size={15} /> {copyState === "copied" ? "Copied" : "Copy code"}</button><button className="icon-button" aria-label="Close code viewer" onClick={onClose} type="button"><X size={18} /></button></div>
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
        {copyState === "error" && <p className="copy-error" role="alert">Copy was blocked. Select the code and use your browser’s copy shortcut.</p>}
      </aside>
    </div>
  );
}
