import { randomBytes } from "node:crypto";
import cors from "cors";
import express from "express";
import { config } from "./config";
import {
  canManageSession, createSession, endSession, findSession, inviteInstructor, listSessions,
  loadAnalyticsRows, loadClassPulse, loadEvents, loadHintReadIds, loadHints, loadTeachingMoments, type SessionRow
} from "./db/supabase";
import { requireInstructor, type AuthRequest } from "./middleware/auth";
import { classroomStore } from "./store/classroom";
import { checkAcademicIntegrity } from "./ai/integrityChecker";
import type { StudentState } from "@collabcode/shared";
import { dependencyHealth } from "./health";

function code(): string {
  return randomBytes(6).toString("base64url").replace(/[-_]/g, "A").slice(0, 6).toUpperCase();
}

function csvCell(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function sanitize(value: unknown, maxLength: number): string {
  return String(value ?? "").replaceAll("\0", "").trim().slice(0, maxLength);
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
  const requestWindows = new Map<string, { count: number; resetAt: number }>();
  app.use(cors({ origin: config.frontendOrigins, credentials: true }));
  app.disable("x-powered-by");
  app.use((_request, response, next) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Permissions-Policy", "camera=(), geolocation=()");
    next();
  });
  app.use(express.json({ limit: "2mb" }));
  app.use((request, response, next) => {
    if (request.path === "/health") return next();
    const key = request.ip || "unknown";
    const now = Date.now();
    if (requestWindows.size > 2_000) {
      for (const [windowKey, window] of requestWindows) {
        if (window.resetAt <= now) requestWindows.delete(windowKey);
      }
    }
    const current = requestWindows.get(key);
    const entry = !current || current.resetAt <= now ? { count: 1, resetAt: now + 60_000 }
      : { count: current.count + 1, resetAt: current.resetAt };
    requestWindows.set(key, entry);
    response.setHeader("x-ratelimit-limit", "180");
    response.setHeader("x-ratelimit-remaining", String(Math.max(0, 180 - entry.count)));
    if (entry.count > 180) return response.status(429).json({ error: "Too many requests. Try again shortly." });
    next();
  });

  app.get("/health", (_request, response) => {
    response.json({
      status: dependencyHealth.persistence === "unavailable" ? "degraded" : "ok",
      service: "collabcode-server",
      persistence: dependencyHealth.persistence,
      checkedAt: dependencyHealth.checkedAt,
      ts: Date.now()
    });
  });

  app.get("/ready", (_request, response) => {
    const ready = dependencyHealth.persistence === "available";
    response.status(ready ? 200 : 503).json({
      ready,
      persistence: dependencyHealth.persistence
    });
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
      const title = sanitize(request.body?.title, 120);
      const assignmentName = sanitize(request.body?.assignmentName, 160);
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
      const email = sanitize(request.body?.email, 254).toLowerCase();
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
      const [data, teachingMoments] = await Promise.all([
        loadAnalyticsRows(row.id),
        loadTeachingMoments(row.id)
      ]);
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
      const timelineBuckets = new Map<number, {
        active: Set<string>; stuck: Set<string>; idle: Set<string>; help: Set<string>; scores: number[];
      }>();
      for (const { studentKey, event } of data.events) {
        const timestamp = Math.floor(event.timestamp / 30_000) * 30_000;
        const bucket = timelineBuckets.get(timestamp) ?? {
          active: new Set(), stuck: new Set(), idle: new Set(), help: new Set(), scores: []
        };
        if (event.type === "help_request") bucket.help.add(studentKey);
        if (event.type === "snapshot") {
          const idle = event.idleMs ?? 0;
          const score = Math.min(100, Math.floor(idle / 2000) + Number(event.meta?.errorCount ?? 0) * 7);
          bucket.scores.push(score);
          if (idle >= 60_000) bucket.stuck.add(studentKey);
          else if (idle >= 30_000) bucket.idle.add(studentKey);
          else bucket.active.add(studentKey);
        }
        timelineBuckets.set(timestamp, bucket);
      }
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
        timeline: [...timelineBuckets.entries()].sort(([a], [b]) => a - b).map(([timestamp, bucket]) => ({
          timestamp,
          activeCount: bucket.active.size,
          stuckCount: bucket.stuck.size,
          idleCount: bucket.idle.size,
          helpCount: bucket.help.size,
          averageStuckScore: bucket.scores.length
            ? Math.round(bucket.scores.reduce((sum, score) => sum + score, 0) / bucket.scores.length)
            : 0
        })),
        teachingMoments,
        generatedAt: Date.now()
      });
    } catch (error) { next(error); }
  });

  app.get("/api/sessions/active", requireInstructor, async (request: AuthRequest, response, next) => {
    try {
      const rows = (await listSessions(request.user!.id)).filter((row) =>
        row.active && (!row.expires_at || Date.parse(row.expires_at) > Date.now())
      );
      response.json(await Promise.all(rows.map(async (row) => {
        const state = classroomStore.getState(hydrate(row).roomCode);
        const students = state?.students ?? [];
        const persistedPulse = await loadClassPulse(row.id, row.code);
        const currentPulse = {
          roomCode: row.code,
          timestamp: Date.now(),
          activeCount: students.filter((student) => student.status === "active").length,
          stuckCount: students.filter((student) => student.stuckFlag).length,
          editRate: Math.round(students.reduce((sum, student) => sum + student.editRate, 0))
        };
        return {
          id: row.id,
          roomCode: row.code,
          title: row.title,
          assignmentName: row.assignment_name,
          instructorName: row.instructor_name,
          studentCount: students.filter((student) => student.connected).length,
          stuckCount: students.filter((student) => student.stuckFlag).length,
          pulse: [...persistedPulse, currentPulse].slice(-12)
        };
      })));
    } catch (error) { next(error); }
  });

  app.get("/api/export/:roomCode/:format", requireInstructor, async (request: AuthRequest, response, next) => {
    try {
      const row = await findSession(String(request.params.roomCode).toUpperCase());
      if (!row || !(await canManageSession(row.id, request.user!.id))) {
        return response.status(404).json({ error: "Session not found" });
      }
      const [analytics, events, hints, teachingMoments] = await Promise.all([
        loadAnalyticsRows(row.id), loadEvents(row.id), loadHints(row.id), loadTeachingMoments(row.id)
      ]);
      const payload = { session: row, students: analytics.students, events, hints, teachingMoments, exportedAt: Date.now() };
      const format = String(request.params.format);
      if (format !== "json" && format !== "csv") {
        return response.status(400).json({ error: "Export format must be json or csv" });
      }
      response.setHeader("content-disposition", `attachment; filename="collabcode-${row.code}.${format}"`);
      if (format === "json") return response.type("application/json").send(JSON.stringify(payload, null, 2));
      const header = ["student_key", "event_type", "occurred_at", "file_name", "cursor_line", "idle_ms", "content"];
      const lines = events.map((event) => [
        "", event.type, new Date(event.timestamp).toISOString(), event.fileName ?? "",
        event.cursorLine ?? "", event.idleMs ?? "", event.content ?? ""
      ].map(csvCell).join(","));
      response.type("text/csv").send([header.join(","), ...lines].join("\n"));
    } catch (error) { next(error); }
  });

  app.get("/api/export/:roomCode/:studentId/json", async (request, response, next) => {
    try {
      const row = await findSession(String(request.params.roomCode).toUpperCase());
      if (!row) return response.status(404).json({ error: "Session not found" });
      const studentId = sanitize(request.params.studentId, 120);
      const [events, hints, readIds, moments] = await Promise.all([
        loadEvents(row.id, studentId), loadHints(row.id, studentId), loadHintReadIds(row.id, studentId),
        loadTeachingMoments(row.id)
      ]);
      response.setHeader("content-disposition", `attachment; filename="collabcode-${row.code}-student.json"`);
      response.json({
        roomCode: row.code,
        studentId,
        events,
        hints,
        readHintIds: readIds,
        teachingMoments: moments.filter((moment) => moment.studentId === studentId)
      });
    } catch (error) { next(error); }
  });

  app.get("/api/progress/:roomCode/:studentId", async (request, response, next) => {
    try {
      const row = await findSession(String(request.params.roomCode).toUpperCase());
      if (!row) return response.status(404).json({ error: "Session not found" });
      const studentId = sanitize(request.params.studentId, 120);
      const analytics = await loadAnalyticsRows(row.id);
      const student = analytics.students.find((item) => item.student_key === studentId);
      if (!student) return response.status(404).json({ error: "Student not found" });
      const [events, hints, readIds] = await Promise.all([
        loadEvents(row.id, studentId), loadHints(row.id, studentId), loadHintReadIds(row.id, studentId)
      ]);
      const snapshots = events.filter((event) => event.type === "snapshot");
      const active = snapshots.filter((event) => (event.idleMs ?? 0) < 30_000).length;
      const activeRatio = snapshots.length ? Math.round(active / snapshots.length * 100) : 0;
      response.json({
        sessionId: row.id, roomCode: row.code, studentId, displayName: student.display_name,
        codingMs: snapshots.length > 1
          ? snapshots[snapshots.length - 1].timestamp - snapshots[0].timestamp : 0,
        activeRatio, trickyRatio: 100 - activeRatio,
        hintsReceived: hints.length, hintsRead: readIds.length,
        endedAt: row.ended_at ? Date.parse(row.ended_at) : null
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
          selectionStartLine: latest?.cursorLine ?? 0, selectionEndLine: latest?.cursorLine ?? 0,
          focusProtected: false, editRate: 0, riskTrend: "stable",
          sessionEvents: events
        };
      });
      response.json(checkAcademicIntegrity(students));
    } catch (error) { next(error); }
  });

  app.use((_request, response) => {
    response.status(404).json({ error: "Route not found" });
  });

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    console.error(error);
    if (error instanceof SyntaxError && "status" in error && error.status === 400) {
      return response.status(400).json({ error: "Malformed JSON request body" });
    }
    response.status(500).json({ error: "The request could not be completed" });
  });
  return app;
}
