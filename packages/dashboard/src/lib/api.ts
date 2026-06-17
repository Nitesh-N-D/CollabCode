import type {
  AnalyticsReport,
  ClassroomState,
  IntegrityReport,
  ReplayData
} from "@collabcode/shared";

export const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:4000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${SERVER_URL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers }
  });
  if (!response.ok) throw new Error((await response.text()) || `Request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

export const api = {
  sessions: () => request<ClassroomState[]>("/api/sessions"),
  createSession: (title: string, roomCode?: string) =>
    request<ClassroomState>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ title, roomCode })
    }),
  session: (roomCode: string) => request<ClassroomState>(`/api/sessions/${roomCode}`),
  analytics: (roomCode: string) =>
    request<AnalyticsReport>(`/api/analytics/${roomCode}`),
  replay: (roomCode: string, studentId: string) =>
    request<ReplayData>(`/api/replay/${roomCode}/${studentId}`),
  integrity: (roomCode: string) =>
    request<IntegrityReport>(`/api/integrity/${roomCode}`)
};
