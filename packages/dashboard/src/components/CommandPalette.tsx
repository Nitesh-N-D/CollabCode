import { useEffect, useMemo, useState } from "react";
import { Command, Search, X } from "lucide-react";

export interface PaletteCommand {
  id: string;
  label: string;
  detail?: string;
  run: () => void | Promise<void>;
}

export function CommandPalette({ commands }: { commands: PaletteCommand[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return commands.filter((item) =>
      terms.every((term) => `${item.label} ${item.detail ?? ""}`.toLowerCase().includes(term))
    );
  }, [commands, query]);

  if (!open) return <button className="command-trigger" type="button" onClick={() => setOpen(true)}>
    <Command size={14} /> Commands <kbd>Ctrl K</kbd>
  </button>;

  return <div className="palette-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
    <section className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette" onMouseDown={(event) => event.stopPropagation()}>
      <header><Search size={18} /><input autoFocus placeholder="Type a command…" value={query} onChange={(event) => setQuery(event.target.value)} /><button type="button" onClick={() => setOpen(false)}><X size={17} /></button></header>
      <div>{filtered.length ? filtered.map((item) => <button type="button" key={item.id} onClick={() => {
        void item.run();
        setOpen(false);
        setQuery("");
      }}><span><strong>{item.label}</strong>{item.detail && <small>{item.detail}</small>}</span><kbd>↵</kbd></button>)
        : <p>No matching commands.</p>}</div>
    </section>
  </div>;
}
