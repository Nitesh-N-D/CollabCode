import { randomBytes } from "node:crypto";
import cors from "cors";
import express from "express";
import { config } from "./config";
import {
  canManageSession, createSession, endSession, findSession, inviteInstructor, listSessions,
  loadAnalyticsRows, loadEvents, type SessionRow
} from "./db/supabase";
import { requireInstructor, type AuthRequest } from "./middleware/auth";
import { classroomStore } from "./store/classroom";
import { checkAcademicIntegrity } from "./ai/integrityChecker";
import type { StudentState } from "@collabcode/shared";

function code(): string {
  return randomBytes(6).toString("base64url").replace(/[-_]/g, "A").slice(0, 6).toUpperCase();
}

function hydrate(row: SessionRow) {
  return classroomStore.hydrateRoom({
    id: row.id, code: row.code, title: row.title, assignmentName: row.assignment_name,
    instructorId: row.instructor_id, instructorName: row.instructor_name, active: row.active,
    endedAt: row.ended_at ? Date.parse(row.ended_at) : null,
    expiresAt: row.expires_at ? Date.parse(row.expires_at) : null
  });
}

export function createApp(): express.Express {
  const app = express();
  app.use(cors({ origin: config.frontendOrigins, credentials: true }));
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_request, response) => {
    response.json({ status: "ok", service: "collabcode-server", persistence: "supabase", ts: Date.now() });
  });

  app.get("/api/public/sessions/:roomCode", async (request, response, next) => {
    try {
      const row = await findSession(String(request.params.roomCode).toUpperCase());
      if (!row || !row.active || (row.expires_at && Date.parse(row.expires_at) <= Date.now())) {
        return response.status(404).json({ error: "Active session not found" });
      }
      response.json({
        id: row.id, roomCode: row.code, title: row.title,
        assignmentName: row.assignment_name, instructorName: row.instructor_name,
        active: row.active, expiresAt: row.expires_at ? Date.parse(row.expires_at) : null
      });
    } catch (error) { next(error); }
  });

  app.get("/api/sessions", requireInstructor, async (request: AuthRequest, response, next) => {
    try {
      const rows = await listSessions(request.user!.id);
      response.json(rows.map((row) => classroomStore.getState(hydrate(row).roomCode)));
    } catch (error) { next(error); }
  });

  app.post("/api/sessions", requireInstructor, async (request: AuthRequest, response, next) => {
    try {
      const title = String(request.body?.title ?? "").trim();
      const assignmentName = String(request.body?.assignmentName ?? "").trim();
      if (!title || !assignmentName) return response.status(400).json({ error: "Title and assignment are required" });
      const expiresAt = request.body?.expiresAt ? new Date(request.body.expiresAt) : null;
      if (expiresAt && Number.isNaN(expiresAt.getTime())) return response.status(400).json({ error: "Invalid expiry date" });
      let row: SessionRow | undefined;
      for (let attempt = 0; attempt < 5 && !row; attempt += 1) {
        try {
          row = await createSession({
            code: code(), instructor_id: request.user!.id,
            instructor_name: String(request.user!.user_metadata?.full_name ?? request.user!.email ?? "Instructor"),
            title, assignment_name: assignmentName, active: true,
            expires_at: expiresAt?.toISOString() ?? null
          });
        } catch (error) {
          if (attempt === 4) throw error;
        }
      }
      if (!row) throw new Error("Could not allocate a room code");
      response.status(201).json(classroomStore.getState(hydrate(row).roomCode));
    } catch (error) { next(error); }
  });

  app.post("/api/sessions/:roomCode/end", requireInstructor, async (request: AuthRequest, response, next) => {
    try {
      const row = await findSession(String(request.params.roomCode).toUpperCase());
      if (!row || row.instructor_id !== request.user!.id) return response.status(404).json({ error: "Session not found" });
      const ended = await endSession(row.id, request.user!.id);
      response.json(ended);
    } catch (error) { next(error); }
  });

  app.post("/api/sessions/:roomCode/instructors", requireInstructor, async (request: AuthRequest, response, next) => {
    try {
      const row = await findSession(String(request.params.roomCode).toUpperCase());
      const email = String(request.body?.email ?? "").trim();
      if (!row) return response.status(404).json({ error: "Session not found" });
      if (!email) return response.status(400).json({ error: "Instructor email is required" });
      await inviteInstructor(row.id, request.user!.id, email);
      response.status(204).end();
    } catch (error) { next(error); }
  });

  app.get("/api/replay/:roomCode/:studentId", requireInstructor, async (request: AuthRequest, response, next) => {
    try {
      const row = await findSession(String(request.params.roomCode).toUpperCase());
      if (!row || !(await canManageSession(row.id, request.user!.id))) return response.status(404).json({ error: "Session not found" });
      response.json({
        studentId: String(request.params.studentId),
        displayName: classroomStore.getRoom(row.code)?.students.get(String(request.params.studentId))?.displayName ?? "Student",
        events: await loadEvents(row.id, String(request.params.studentId))
      });
    } catch (error) { next(error); }
  });

  app.get("/api/analytics/:roomCode", requireInstructor, async (request: AuthRequest, response, next) => {
    try {
      const row = await findSession(String(request.params.roomCode).toUpperCase());
      if (!row || !(await canManageSession(row.id, request.user!.id))) return response.status(404).json({ error: "Session not found" });
      const data = await loadAnalyticsRows(row.id);
      const heatmap = new Map<string, { fileName: string; lineNumber: number; struggleCount: number; totalIdleMs: number }>();
      for (const { event } of data.events) {
        if (event.type !== "snapshot" || !event.fileName || event.cursorLine === undefined) continue;
        const lineNumber = Math.max(1, Math.round(event.cursorLine / 5) * 5);
        const key = `${event.fileName}:${lineNumber}`;
        const current = heatmap.get(key) ?? { fileName: event.fileName, lineNumber, struggleCount: 0, totalIdleMs: 0 };
        current.totalIdleMs += event.idleMs ?? 0;
        if ((event.idleMs ?? 0) >= 30_000) current.struggleCount += 1;
        heatmap.set(key, current);
      }
      const snapshots = data.events.filter(({ event }) => event.type === "snapshot");
      response.json({
        roomCode: row.code,
        totalStudents: data.students.length,
        connectedStudents: data.students.filter((student) => student.connected).length,
        stuckStudents: new Set(snapshots.filter(({ event }) => (event.idleMs ?? 0) >= 60_000)
          .map(({ studentKey }) => studentKey)).size,
        helpRequests: data.events.filter(({ event }) => event.type === "help_request").length,
        hintsSent: data.hintCount,
        averageIdleMs: snapshots.length ? Math.round(snapshots.reduce((sum, { event }) => sum + (event.idleMs ?? 0), 0) / snapshots.length) : 0,
        heatmap: [...heatmap.values()].filter((entry) => entry.struggleCount > 0)
          .sort((a, b) => b.totalIdleMs - a.totalIdleMs),
        generatedAt: Date.now()
      });
    } catch (error) { next(error); }
  });

  app.get("/api/integrity/:roomCode", requireInstructor, async (request: AuthRequest, response, next) => {
    try {
      const row = await findSession(String(request.params.roomCode).toUpperCase());
      if (!row || !(await canManageSession(row.id, request.user!.id))) return response.status(404).json({ error: "Session not found" });
      const data = await loadAnalyticsRows(row.id);
      const students: StudentState[] = data.students.map((record) => {
        const events = data.events.filter((item) => item.studentKey === record.student_key).map((item) => item.event);
        const latest = [...events].reverse().find((event) => event.type === "snapshot");
        return {
          studentId: record.student_key, displayName: record.display_name, roomCode: row.code,
          fileName: latest?.fileName ?? "", languageId: latest?.languageId ?? "",
          content: latest?.content ?? "", cursorLine: latest?.cursorLine ?? 0,
          lastSeen: latest?.timestamp ?? 0, idleMs: latest?.idleMs ?? 0,
          errorCount: Number(latest?.meta?.errorCount ?? 0), status: record.connected ? "active" : "offline",
          stuckScore: 0, stuckFlag: false, helpRequested: false, connected: record.connected,
          sessionEvents: events
        };
      });
      response.json(checkAcademicIntegrity(students));
    } catch (error) { next(error); }
  });

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    console.error(error);
    response.status(500).json({ error: "The request could not be completed" });
  });
  return app;
}
