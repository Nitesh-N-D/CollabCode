import { Braces } from "lucide-react";
import { Link } from "react-router-dom";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="logo" to="/">
      <span className="logo-mark"><Braces size={18} /></span>
      {!compact && <span>CollabCode</span>}
    </Link>
  );
}
