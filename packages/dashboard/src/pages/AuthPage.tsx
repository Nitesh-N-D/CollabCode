import { useState } from "react";
import { Navigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { Logo } from "../components/Logo";
import { supabase } from "../lib/supabase";

export function AuthPage({ session }: { session: Session | null }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  if (session) return <Navigate to="/dashboard" replace />;
  const redirectTo = `${window.location.origin}/auth`;
  return <main className="auth-page"><section className="auth-card">
    <Logo /><h1>Instructor sign in</h1><p>Create and manage live classrooms with your verified account.</p>
    <button className="button primary full" onClick={() => supabase.auth.signInWithOAuth({
      provider: "google", options: { redirectTo }
    })}>Continue with Google</button>
    <span className="auth-divider">or use a magic link</span>
    <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@school.edu" />
    <button className="button secondary full" onClick={async () => {
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
      setMessage(error?.message ?? "Check your inbox for the secure sign-in link.");
    }}>Email me a sign-in link</button>
    {message && <small>{message}</small>}
  </section></main>;
}
