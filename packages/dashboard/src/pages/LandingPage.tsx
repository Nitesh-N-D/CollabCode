import { motion } from "framer-motion";
import { ArrowRight, CalendarClock, Captions, Compass, Eye, Headphones, RadioTower, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { Logo } from "../components/Logo";

const features = [
  [Compass, "Live room compass", "A single conference-style pulse blends active work, help requests, and rising friction so you know where to walk next."],
  [Headphones, "Private rescue lane", "Students can ask quietly from VS Code; instructors reply with a contextual hint right beside the editor."],
  [CalendarClock, "Momentum replay", "Revisit the exact sequence of edits, errors, and interventions—not just a final file or a vague memory."],
  [UsersRound, "Rotating breakouts", "Match a driver with an observer and automatically swap roles, turning pair programming into an equitable live flow."],
  [Captions, "AI teaching co-pilot", "Turn a live stuck signal into an editable, human-reviewed next question before it reaches a student."]
] as const;

export function LandingPage() {
  return (
    <div className="landing">
      <nav className="landing-nav">
        <Logo />
        <div>
          <a href="#features">Five superpowers</a>
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
            <span className="pill"><span /> The live conference layer for coding classrooms</span>
            <h1>Run the room.<br /><em>Keep every coder in the conversation.</em></h1>
            <p>
              A bright, calm command center for live coding: see the room, host breakouts,
              and send the right nudge without interrupting everyone.
            </p>
            <div className="hero-actions">
              <Link className="button primary" to="/dashboard">Start a live room <ArrowRight size={17} /></Link>
              <a className="button secondary" href="#preview"><Eye size={16} /> See how live data works</a>
            </div>
            <div className="trust-row"><span>No screen sharing</span><span>Private by room</span><span>Multi-instructor</span></div>
          </motion.div>
          <motion.div
            id="preview"
            className="product-preview real-data-note"
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.75 }}
          >
            <RadioTower size={36} />
            <h2>Every classroom starts with real participants.</h2>
            <p>CollabCode never fills the dashboard with staged students. Create a room, share its generated code, and live activity appears as students join.</p>
            <Link className="button primary" to="/auth">Create a session <ArrowRight size={17} /></Link>
          </motion.div>
        </section>
        <section className="section" id="workflow">
          <div className="section-heading"><span className="eyebrow">A better live format</span><h2>Host a coding session like a great conference.</h2><p>Move from room setup to active facilitation without taking control of a student&apos;s environment.</p></div>
          <div className="steps">
            {[
              ["01", "Open the room", "Create a session, share its code, and let attendees join directly from VS Code."],
              ["02", "Read the floor", "Live file, activity, idle, and error signals become an actionable room pulse."],
              ["03", "Host the next move", "Send a private hint, create a rotating breakout pair, or replay the moment together."]
            ].map(([number, title, copy]) => (
              <motion.article whileInView={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 20 }} viewport={{ once: true }} key={number}>
                <span>{number}</span><h3>{title}</h3><p>{copy}</p>
              </motion.article>
            ))}
          </div>
        </section>
        <section className="section feature-section" id="features">
          <div className="section-heading"><span className="eyebrow">Five superpowers</span><h2>Unusually capable, still human-led.</h2><p>Each capability is connected to the live room, extension, and teaching workflow.</p></div>
          <div className="feature-grid">
            {features.map(([Icon, title, copy]) => (
              <motion.article whileHover={{ y: -4 }} key={title}>
                <Icon size={20} /><h3>{title}</h3><p>{copy}</p>
              </motion.article>
            ))}
          </div>
        </section>
        <section className="closing"><Eye size={28} /><h2>Make silent struggle visible.</h2><p>Create a live room and let real classroom activity shape every signal.</p><Link className="button primary" to="/dashboard">Open instructor dashboard <ArrowRight size={17} /></Link></section>
      </main>
      <footer className="site-footer"><Logo /><span>Real-time classroom coding intelligence.</span><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link></footer>
    </div>
  );
}
