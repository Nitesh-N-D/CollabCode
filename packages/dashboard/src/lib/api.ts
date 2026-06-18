import type {
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
  return response.json() as Promise<T>;
}

export const api = {
  sessions: () => request<ClassroomState[]>("/api/sessions"),
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
