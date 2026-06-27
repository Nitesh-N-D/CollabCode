import type {
  ActiveSessionSummary,
  AnalyticsReport,
  ClassroomState,
  IntegrityReport,
  ReplayData
} from "@collabcode/shared";
import { accessToken } from "./supabase";

export const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:4000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await accessToken();
  const response = await fetch(`${SERVER_URL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...init?.headers }
  });
  if (!response.ok) throw new Error((await response.text()) || `Request failed: ${response.status}`);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function downloadExport(roomCode: string, format: "json" | "csv"): Promise<void> {
  const token = await accessToken();
  const response = await fetch(`${SERVER_URL}/api/export/${roomCode}/${format}`, {
    headers: { authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error((await response.text()) || "Export failed");
  const href = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = `collabcode-${roomCode}.${format}`;
  anchor.click();
  URL.revokeObjectURL(href);
}

export const api = {
  sessions: () => request<ClassroomState[]>("/api/sessions"),
  activeSessions: () => request<ActiveSessionSummary[]>("/api/sessions/active"),
  createSession: (title: string, assignmentName: string, expiresAt?: string) =>
    request<ClassroomState>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ title, assignmentName, expiresAt })
    }),
  session: (roomCode: string) => request<ClassroomState>(`/api/sessions/${roomCode}`),
  analytics: (roomCode: string) =>
    request<AnalyticsReport>(`/api/analytics/${roomCode}`),
  replay: (roomCode: string, studentId: string) =>
    request<ReplayData>(`/api/replay/${roomCode}/${studentId}`),
  integrity: (roomCode: string) =>
    request<IntegrityReport>(`/api/integrity/${roomCode}`),
  inviteInstructor: (roomCode: string, email: string) =>
    request<void>(`/api/sessions/${roomCode}/instructors`, {
      method: "POST", body: JSON.stringify({ email })
    })
};
