import { motion } from "framer-motion";
import {
  ArrowRight,
  BellRing,
  ChartNoAxesCombined,
  CircleHelp,
  Eye,
  Play,
  RadioTower,
  Rewind,
  Sparkles
} from "lucide-react";
import { Link } from "react-router-dom";
import { Logo } from "../components/Logo";

const features = [
  [RadioTower, "Live class view", "See editor progress and activity signals across the entire room in real time."],
  [Sparkles, "Stuck detection", "Surface silent struggle before it becomes a lost lab session."],
  [BellRing, "Instant hints", "Send a private Socratic nudge or a class-wide checkpoint."],
  [Rewind, "Session replay", "Review how a solution evolved instead of judging only the final answer."],
  [CircleHelp, "Private help", "Give students a quiet way to ask without performing uncertainty in public."],
  [ChartNoAxesCombined, "Class analytics", "Find the files, lines, and moments where the assignment broke down."]
] as const;

export function LandingPage() {
  return (
    <div className="landing">
      <nav className="landing-nav">
        <Logo />
        <div>
          <a href="#features">Product</a>
          <a href="#workflow">How it works</a>
          <Link className="button secondary small" to="/dashboard">Open dashboard</Link>
        </div>
      </nav>
      <main>
        <section className="hero">
          <div className="hero-glow" />
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65 }}
            className="hero-copy"
          >
            <span className="pill"><span /> Built for live coding classrooms</span>
            <h1>Your class is coding.<br /><em>Know who needs you.</em></h1>
            <p>
              CollabCode gives CS instructors a live view of every student&apos;s editor,
              with intelligent stuck detection and hints delivered where students work.
            </p>
            <div className="hero-actions">
              <Link className="button primary" to="/dashboard">Start a live room <ArrowRight size={17} /></Link>
              <a className="button secondary" href="#preview"><Play size={16} /> See the product</a>
            </div>
            <div className="trust-row"><span>No screen sharing</span><span>Local demo mode</span><span>Open architecture</span></div>
          </motion.div>
          <motion.div
            id="preview"
            className="product-preview"
            initial={{ opacity: 0, scale: 0.96, y: 25 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.75 }}
          >
            <div className="preview-top"><Logo compact /><span>CS101 · Algorithms lab</span><b><span /> Live</b></div>
            <div className="preview-body">
              <aside><span className="active" /><span /><span /><span /><span /></aside>
              <div className="preview-content">
                <div className="preview-heading"><div><small>Room health</small><strong>24 students active</strong></div><button>Send class hint</button></div>
                <div className="preview-alert"><Sparkles size={18} /><div><strong>3 students need a checkpoint</strong><span>Similar idle pattern near the recursion base case.</span></div><button>Review</button></div>
                <div className="preview-grid">
                  {["Asha Rao", "Noah Kim", "Maya Chen", "Eli Brooks", "Sofia Patel", "Liam Davis"].map((name, index) => (
                    <div className={index === 1 ? "warn" : ""} key={name}>
                      <header><i>{name.split(" ").map((part) => part[0]).join("")}</i><span><b>{name}</b><small>{index === 1 ? "Needs attention" : "Coding now"}</small></span></header>
                      <pre>{index === 1 ? "if n == 0:\n    pass" : "return solve(n - 1)\n+ solve(n - 2)"}</pre>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </section>
        <section className="section" id="workflow">
          <div className="section-heading"><span className="eyebrow">The classroom signal layer</span><h2>See the work behind the answer.</h2><p>Observe progress without taking control of the student&apos;s environment.</p></div>
          <div className="steps">
            {[
              ["01", "Students join", "A lightweight VS Code extension connects to a room code."],
              ["02", "Signals become context", "Code snapshots, idle time, and errors form a live progress picture."],
              ["03", "You intervene precisely", "Review the moment, send a hint, pair students, or pause the class."]
            ].map(([number, title, copy]) => (
              <motion.article whileInView={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 20 }} viewport={{ once: true }} key={number}>
                <span>{number}</span><h3>{title}</h3><p>{copy}</p>
              </motion.article>
            ))}
          </div>
        </section>
        <section className="section feature-section" id="features">
          <div className="section-heading"><span className="eyebrow">One calm control room</span><h2>Everything you need during the lab.</h2></div>
          <div className="feature-grid">
            {features.map(([Icon, title, copy]) => (
              <motion.article whileHover={{ y: -4 }} key={title}>
                <Icon size={20} /><h3>{title}</h3><p>{copy}</p>
              </motion.article>
            ))}
          </div>
        </section>
        <section className="closing"><Eye size={28} /><h2>Make silent struggle visible.</h2><p>Start a local room, launch the simulator, and watch CollabCode come alive.</p><Link className="button primary" to="/dashboard">Open instructor dashboard <ArrowRight size={17} /></Link></section>
      </main>
      <footer className="site-footer"><Logo /><span>Real-time classroom coding intelligence.</span><a href="https://github.com" rel="noreferrer" target="_blank">GitHub</a></footer>
    </div>
  );
}
