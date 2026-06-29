import { createClient, type User } from "@supabase/supabase-js";
import type { Hint, SessionEvent, StudentState, TeachingMoment } from "@collabcode/shared";
import { config } from "../config";

export const admin = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

export interface SessionRow {
  id: string;
  code: string;
  instructor_id: string;
  instructor_name: string;
  title: string;
  assignment_name: string;
  active: boolean;
  created_at: string;
  ended_at: string | null;
  expires_at: string | null;
}

export async function verifyToken(token: string): Promise<User> {
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new Error("Invalid instructor token");
  return data.user;
}

export async function findSession(code: string): Promise<SessionRow | null> {
  const { data, error } = await admin.from("sessions").select("*").eq("code", code).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listSessions(instructorId: string): Promise<SessionRow[]> {
  const { data: owned, error } = await admin.from("sessions").select("*")
    .eq("instructor_id", instructorId).order("created_at", { ascending: false });
  if (error) throw error;
  const { data: memberships, error: membershipError } = await admin.from("session_instructors")
    .select("session_id").eq("instructor_id", instructorId);
  if (membershipError) throw membershipError;
  const ids = (memberships ?? []).map((item) => item.session_id);
  let shared: SessionRow[] = [];
  if (ids.length) {
    const result = await admin.from("sessions").select("*").in("id", ids);
    if (result.error) throw result.error;
    shared = result.data ?? [];
  }
  return [...new Map([...(owned ?? []), ...shared].map((row) => [row.id, row])).values()]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

export async function listActiveSessions(): Promise<SessionRow[]> {
  const { data, error } = await admin.from("sessions").select("*").eq("active", true);
  if (error) throw error;
  return data ?? [];
}

export async function canManageSession(sessionId: string, instructorId: string): Promise<boolean> {
  const { data: owned, error } = await admin.from("sessions").select("id")
    .eq("id", sessionId).eq("instructor_id", instructorId).maybeSingle();
  if (error) throw error;
  if (owned) return true;
  const { data, error: memberError } = await admin.from("session_instructors").select("session_id")
    .eq("session_id", sessionId).eq("instructor_id", instructorId).maybeSingle();
  if (memberError) throw memberError;
  return Boolean(data);
}

export async function inviteInstructor(sessionId: string, ownerId: string, email: string): Promise<void> {
  const { data: session, error } = await admin.from("sessions").select("id")
    .eq("id", sessionId).eq("instructor_id", ownerId).maybeSingle();
  if (error) throw error;
  if (!session) throw new Error("Only the room owner can invite instructors");
  let page = 1;
  let invitedId: string | undefined;
  while (!invitedId) {
    const { data, error: usersError } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (usersError) throw usersError;
    invitedId = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase())?.id;
    if (data.users.length < 1000) break;
    page += 1;
  }
  if (!invitedId) throw new Error("That instructor must sign in once before being invited");
  const { error: insertError } = await admin.from("session_instructors")
    .upsert({ session_id: sessionId, instructor_id: invitedId });
  if (insertError) throw insertError;
}

export async function markHintRead(hintId: string, studentKey: string): Promise<void> {
  const { error } = await admin.from("hint_reads").upsert({ hint_id: hintId, student_key: studentKey });
  if (error) throw error;
}

export async function loadAnalyticsRows(sessionId: string) {
  const [events, students, hints] = await Promise.all([
    admin.from("events").select("student_key,payload").eq("session_id", sessionId),
    admin.from("students").select("student_key,display_name,connected").eq("session_id", sessionId),
    admin.from("hints").select("id").eq("session_id", sessionId)
  ]);
  if (events.error) throw events.error;
  if (students.error) throw students.error;
  if (hints.error) throw hints.error;
  return {
    events: (events.data ?? []).map((row) => ({
      studentKey: row.student_key,
      event: row.payload as SessionEvent
    })),
    students: students.data ?? [],
    hintCount: hints.data?.length ?? 0
  };
}

export async function createSession(input: Omit<SessionRow, "id" | "created_at" | "ended_at">): Promise<SessionRow> {
  const { data, error } = await admin.from("sessions").insert(input).select("*").single();
  if (error) throw error;
  return data;
}

export async function endSession(id: string, instructorId: string): Promise<SessionRow> {
  const { data, error } = await admin.from("sessions").update({
    active: false, ended_at: new Date().toISOString()
  }).eq("id", id).eq("instructor_id", instructorId).select("*").single();
  if (error) throw error;
  return data;
}

export async function persistStudent(sessionId: string, student: StudentState): Promise<void> {
  const { error } = await admin.from("students").upsert({
    session_id: sessionId, student_key: student.studentId, display_name: student.displayName,
    last_seen_at: new Date(student.lastSeen).toISOString(), connected: student.connected
  }, { onConflict: "session_id,student_key" });
  if (error) throw error;
}

export async function persistEvents(sessionId: string, studentKey: string, events: SessionEvent[]): Promise<void> {
  if (!events.length) return;
  const { error } = await admin.from("events").upsert(events.map((event) => ({
    id: event.id, session_id: sessionId, student_key: studentKey, event_type: event.type,
    occurred_at: new Date(event.timestamp).toISOString(), payload: event
  })));
  if (error) throw error;
}

export async function persistHint(sessionId: string, hint: Hint): Promise<void> {
  const { error } = await admin.from("hints").insert({
    id: hint.id, session_id: sessionId, target_student_key: hint.targetStudentId ?? null,
    message: hint.hint, code_snippet: hint.codeSnippet ?? null,
    instructor_name: hint.instructorName, sent_at: new Date(hint.sentAt).toISOString()
  });
  if (error) throw error;
}

export async function persistTeachingMoment(moment: TeachingMoment): Promise<void> {
  const { error } = await admin.from("teaching_moments").upsert({
    id: moment.id,
    session_id: moment.sessionId,
    student_key: moment.studentId,
    title: moment.title,
    reason: moment.reason,
    start_at: new Date(moment.startAt).toISOString(),
    end_at: new Date(moment.endAt).toISOString(),
    created_at: new Date(moment.createdAt).toISOString()
  });
  if (error) throw error;
}

export async function loadTeachingMoments(sessionId: string): Promise<TeachingMoment[]> {
  const { data, error } = await admin.from("teaching_moments")
    .select("id,session_id,student_key,title,reason,start_at,end_at,created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    studentId: row.student_key,
    title: row.title,
    reason: row.reason,
    startAt: Date.parse(row.start_at),
    endAt: Date.parse(row.end_at),
    createdAt: Date.parse(row.created_at)
  }));
}

export async function loadEvents(sessionId: string, studentKey?: string): Promise<SessionEvent[]> {
  let query = admin.from("events").select("payload").eq("session_id", sessionId)
    .order("occurred_at", { ascending: true });
  if (studentKey) query = query.eq("student_key", studentKey);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => row.payload as SessionEvent);
}

export async function loadHints(sessionId: string, studentKey?: string) {
  let query = admin.from("hints").select("id,target_student_key,message,code_snippet,instructor_name,sent_at")
    .eq("session_id", sessionId).order("sent_at", { ascending: true });
  if (studentKey) query = query.or(`target_student_key.is.null,target_student_key.eq.${studentKey}`);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function loadHintReadIds(sessionId: string, studentKey: string): Promise<string[]> {
  const { data: hints, error: hintError } = await admin.from("hints").select("id")
    .eq("session_id", sessionId);
  if (hintError) throw hintError;
  const ids = (hints ?? []).map((hint) => hint.id);
  if (!ids.length) return [];
  const { data, error } = await admin.from("hint_reads").select("hint_id")
    .eq("student_key", studentKey).in("hint_id", ids);
  if (error) throw error;
  return (data ?? []).map((row) => row.hint_id);
}
