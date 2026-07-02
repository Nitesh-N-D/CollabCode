import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { AuthPage } from "./pages/AuthPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LandingPage } from "./pages/LandingPage";
import { SessionPage } from "./pages/SessionPage";
import { WarRoomPage } from "./pages/WarRoomPage";
import { supabase } from "./lib/supabase";
import { ErrorBoundary } from "./components/ErrorBoundary";

function Guard({ session, children }: { session: Session | null; children: ReactNode }) {
  return session ? children : <Navigate to="/auth" replace />;
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);
  if (session === undefined) return <div className="app-loading">Connecting securely…</div>;
  return <ErrorBoundary><BrowserRouter><Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/auth" element={<AuthPage session={session} />} />
    <Route path="/dashboard" element={<Guard session={session}><DashboardPage /></Guard>} />
    <Route path="/session/:roomCode" element={<Guard session={session}><SessionPage /></Guard>} />
    <Route path="/analytics/:roomCode" element={<Guard session={session}><AnalyticsPage /></Guard>} />
    <Route path="/warroom" element={<Guard session={session}><WarRoomPage /></Guard>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></BrowserRouter></ErrorBoundary>;
}
