import { useMemo, useState } from "react";
import { Clock3, Play, X } from "lucide-react";
import type { ReplayData } from "@collabcode/shared";

export function ReplayModal({ replay, onClose }: { replay: ReplayData; onClose: () => void }) {
  const snapshots = useMemo(
    () => replay.events.filter((event) => event.type === "snapshot"),
    [replay.events]
  );
  const [index, setIndex] = useState(Math.max(0, snapshots.length - 1));
  const event = snapshots[index];
  const lines = (event?.content ?? "// No snapshots").split("\n");
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="modal replay-modal" onMouseDown={(click) => click.stopPropagation()}>
        <header>
          <div>
            <span className="eyebrow"><Clock3 size={14} /> Session replay</span>
            <h2>{replay.displayName}</h2>
          </div>
          <button className="icon-button" onClick={onClose} type="button"><X size={18} /></button>
        </header>
        <div className="replay-stage">
          <div className="code-window">
            {lines.map((line, lineIndex) => (
              <div key={`${lineIndex}-${line}`}>
                <span>{lineIndex + 1}</span><code>{line || " "}</code>
              </div>
            ))}
          </div>
        </div>
        <footer className="replay-controls">
          <button className="icon-button" type="button"><Play size={17} /></button>
          <input
            aria-label="Replay position"
            max={Math.max(0, snapshots.length - 1)}
            min="0"
            onChange={(change) => setIndex(Number(change.target.value))}
            type="range"
            value={index}
          />
          <span>{index + 1} / {snapshots.length || 1}</span>
        </footer>
      </section>
    </div>
  );
}
