import { randomUUID } from "node:crypto";
import type { Server, Socket } from "socket.io";
import {
  EVENTS,
  type ClientToServerEvents,
  type CodeSnapshotPayload,
  type Hint,
  type PairAssignment,
  type ServerToClientEvents,
  type StuckAlert,
  type StudentState,
  type TeachingMoment
} from "@collabcode/shared";
import { generateHint } from "../ai/aiService";
import { classroomStore } from "../store/classroom";
import {
  canManageSession, endSession, findSession, markHintRead, persistEvents, persistHint,
  persistStudent, persistTeachingMoment, verifyToken
} from "../db/supabase";

type CollabServer = Server<ClientToServerEvents, ServerToClientEvents>;
type CollabSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
const teachingMomentCooldowns = new Map<string, number>();

function emitState(io: CollabServer, roomCode: string): void {
  const state = classroomStore.getState(roomCode);
  if (state) io.to(`room:${roomCode}:instructors`).emit(EVENTS.CLASSROOM_STATE, state);
}

function isStudentSocket(socket: CollabSocket, roomCode: string, studentId: string): boolean {
  return socket.data.role === "student" &&
    socket.data.roomCode === roomCode.toUpperCase() &&
    socket.data.studentId === studentId;
}

function isInstructorSocket(socket: CollabSocket, roomCode: string): boolean {
  return socket.data.role === "instructor" && socket.data.roomCode === roomCode.toUpperCase();
}

function clean(value: string, maxLength: number): string {
  return value.replaceAll("\0", "").trim().slice(0, maxLength);
}

function detectTeachingMoment(
  sessionId: string,
  before: StudentState | undefined,
  after: StudentState
): TeachingMoment | undefined {
  if (!before) return undefined;
  const wasBlocked = before.helpRequested || before.stuckFlag || before.idleMs >= 45_000;
  const recovered = after.idleMs < 15_000 && !after.stuckFlag;
  const addedEnoughCode = after.content.length - before.content.length >= 24;
  const cooldownKey = `${sessionId}:${after.studentId}`;
  const lastMomentAt = teachingMomentCooldowns.get(cooldownKey) ?? 0;
  if (!wasBlocked || !recovered || !addedEnoughCode || Date.now() - lastMomentAt < 120_000) return undefined;
  teachingMomentCooldowns.set(cooldownKey, Date.now());
  return {
    id: randomUUID(),
    sessionId,
    studentId: after.studentId,
    title: `${after.displayName} recovered momentum`,
    reason: "A help/stuck signal was followed by fresh edits and a low-idle snapshot.",
    startAt: before.lastSeen,
    endAt: after.lastSeen,
    createdAt: Date.now()
  };
}

export function registerHandlers(io: CollabServer, socket: CollabSocket): void {
  socket.on(EVENTS.STUDENT_JOIN, async (payload) => {
    const roomCode = clean(payload.roomCode, 6).toUpperCase();
    const row = await findSession(roomCode).catch(() => null);
    if (!row || !row.active || (row.expires_at && Date.parse(row.expires_at) <= Date.now())) {
      socket.emit(EVENTS.ERROR, { message: "This room code is invalid or the session has ended." });
      return;
    }
    classroomStore.hydrateRoom({
      id: row.id, code: row.code, title: row.title, assignmentName: row.assignment_name,
      instructorId: row.instructor_id, instructorName: row.instructor_name, active: row.active,
      endedAt: row.ended_at ? Date.parse(row.ended_at) : null,
      expiresAt: row.expires_at ? Date.parse(row.expires_at) : null
    });
    socket.join(`room:${roomCode}:students`);
    const studentId = clean(payload.studentId, 120);
    socket.join(`student:${studentId}`);
    socket.data.role = "student";
    socket.data.roomCode = roomCode;
    socket.data.studentId = studentId;
    const student = classroomStore.joinStudent(roomCode, studentId, clean(payload.displayName, 80), socket.id);
    await Promise.all([
      persistStudent(row.id, student),
      persistEvents(row.id, student.studentId, student.sessionEvents.slice(-1))
    ]).catch((error) => console.error("[db] student join", error));
    socket.emit(EVENTS.SESSION_INFO, {
      id: row.id, roomCode, title: row.title, assignmentName: row.assignment_name,
      instructorName: row.instructor_name, active: row.active,
      expiresAt: row.expires_at ? Date.parse(row.expires_at) : null
    });
    io.to(`room:${roomCode}:instructors`).emit(EVENTS.STUDENT_JOINED, student);
    emitState(io, roomCode);
  });

  socket.on(EVENTS.INSTRUCTOR_JOIN, async (payload) => {
    const roomCode = clean(payload.roomCode, 6).toUpperCase();
    try {
      const [user, row] = await Promise.all([verifyToken(payload.token), findSession(roomCode)]);
      if (!row || !(await canManageSession(row.id, user.id))) throw new Error("You cannot manage this session");
      classroomStore.hydrateRoom({
        id: row.id, code: row.code, title: row.title, assignmentName: row.assignment_name,
        instructorId: row.instructor_id, instructorName: row.instructor_name, active: row.active,
        endedAt: row.ended_at ? Date.parse(row.ended_at) : null,
        expiresAt: row.expires_at ? Date.parse(row.expires_at) : null
      });
      socket.data.userId = user.id;
    } catch {
      socket.emit(EVENTS.ERROR, { message: "Instructor authorization failed." });
      return;
    }
    socket.join(`room:${roomCode}:instructors`);
    socket.data.role = "instructor";
    socket.data.roomCode = roomCode;
    socket.emit(EVENTS.CLASSROOM_STATE, classroomStore.getState(roomCode)!);
  });

  socket.on(EVENTS.CODE_SNAPSHOT, async (payload) => {
    if (!isStudentSocket(socket, payload.roomCode, payload.studentId)) {
      socket.emit(EVENTS.ERROR, { message: "Join this room before sending telemetry." });
      return;
    }
    const safePayload: CodeSnapshotPayload = {
      ...payload,
      roomCode: clean(payload.roomCode, 6).toUpperCase(),
      studentId: clean(payload.studentId, 120),
      displayName: clean(payload.displayName, 80),
      fileName: clean(payload.fileName, 500),
      languageId: clean(payload.languageId, 80),
      content: String(payload.content ?? "").replaceAll("\0", "").slice(0, 250_000),
      cursorLine: Math.max(0, Math.min(1_000_000, Number(payload.cursorLine) || 0)),
      selectionStartLine: Math.max(0, Math.min(1_000_000, Number(payload.selectionStartLine) || 0)),
      selectionEndLine: Math.max(0, Math.min(1_000_000, Number(payload.selectionEndLine) || 0)),
      idleMs: Math.max(0, Math.min(86_400_000, Number(payload.idleMs) || 0)),
      errorCount: Math.max(0, Math.min(10_000, Number(payload.errorCount) || 0)),
      timestamp: Number.isFinite(payload.timestamp) ? payload.timestamp : Date.now()
    };
    const existing = classroomStore.getRoom(safePayload.roomCode)?.students.get(safePayload.studentId);
    const before = existing ? { ...existing, sessionEvents: [...existing.sessionEvents] } : undefined;
    const student = classroomStore.updateSnapshot(safePayload, socket.id);
    const room = classroomStore.getRoom(student.roomCode);
    const teachingMoment = room?.id ? detectTeachingMoment(room.id, before, student) : undefined;
    if (room?.id) {
      await Promise.all([
        persistStudent(room.id, student),
        persistEvents(room.id, student.studentId, student.sessionEvents.slice(-1)),
        ...(teachingMoment ? [persistTeachingMoment(teachingMoment)] : [])
      ]).catch((error) => console.error("[db] telemetry", error));
    }
    io.to(`room:${student.roomCode}:instructors`).emit(EVENTS.STUDENT_UPDATE, student);
  });

  socket.on(EVENTS.HELP_REQUEST, async (payload) => {
    if (!isStudentSocket(socket, payload.roomCode, payload.studentId)) {
      socket.emit(EVENTS.ERROR, { message: "Join this room before requesting help." });
      return;
    }
    const student = classroomStore.requestHelp(payload.roomCode, payload.studentId, payload.message);
    if (!student) return;
    const room = classroomStore.getRoom(student.roomCode);
    if (room?.id) {
      await Promise.all([
        persistStudent(room.id, student),
        persistEvents(room.id, student.studentId, student.sessionEvents.slice(-1))
      ]).catch((error) => console.error("[db] help request", error));
    }
    const alert: StuckAlert = {
      id: randomUUID(),
      roomCode: student.roomCode,
      studentId: student.studentId,
      displayName: "Anonymous student",
      idleMs: student.idleMs,
      stuckScore: 100,
      lastCode: student.content,
      fileName: student.fileName,
      message: payload.message || "A student privately requested help.",
      commonPattern: false,
      createdAt: Date.now()
    };
    classroomStore.addAlert(alert);
    io.to(`room:${student.roomCode}:instructors`).emit(EVENTS.STUCK_ALERT, alert);
    io.to(`room:${student.roomCode}:instructors`).emit(EVENTS.STUDENT_UPDATE, student);
  });

  socket.on(EVENTS.SEND_HINT, async (payload) => {
    if (!isInstructorSocket(socket, payload.roomCode)) {
      socket.emit(EVENTS.ERROR, { message: "Instructor authorization required." });
      return;
    }
    const hint: Hint = {
      id: randomUUID(),
      roomCode: payload.roomCode.toUpperCase(),
      hint: clean(payload.hint, 2000),
      codeSnippet: payload.codeSnippet ? clean(payload.codeSnippet, 12_000) : undefined,
      targetStudentId: payload.targetStudentId,
      instructorName: clean(payload.instructorName, 80) || "Instructor",
      sentAt: Date.now(),
      readBy: [],
      aiGenerated: false
    };
    if (!hint.hint) {
      socket.emit(EVENTS.ERROR, { message: "A hint cannot be empty." });
      return;
    }
    classroomStore.addHint(hint);
    const room = classroomStore.getRoom(hint.roomCode);
    if (room?.id) {
      const targets = hint.targetStudentId
        ? [room.students.get(hint.targetStudentId)].filter(Boolean)
        : [...room.students.values()];
      await Promise.all([
        persistHint(room.id, hint),
        ...targets.flatMap((student) => student
          ? [persistEvents(room.id, student.studentId, student.sessionEvents.slice(-1))]
          : [])
      ]).catch((error) => console.error("[db] hint", error));
    }
    if (hint.targetStudentId) {
      io.to(`student:${hint.targetStudentId}`).emit(EVENTS.HINT_RECEIVE, hint);
    } else {
      io.to(`room:${hint.roomCode}:students`).emit(EVENTS.HINT_RECEIVE, hint);
    }
    io.to(`room:${hint.roomCode}:instructors`).emit(EVENTS.HINT_SENT, hint);
  });

  socket.on(EVENTS.REQUEST_AI_HINT, async (payload) => {
    if (!isInstructorSocket(socket, payload.roomCode)) {
      socket.emit(EVENTS.ERROR, { message: "Instructor authorization required." });
      return;
    }
    const student = classroomStore.getRoom(payload.roomCode)?.students.get(payload.studentId);
    if (!student) {
      socket.emit(EVENTS.ERROR, { message: "Student not found." });
      return;
    }
    try {
      const result = await generateHint(student);
      socket.emit(EVENTS.AI_HINT_RESULT, {
        studentId: student.studentId,
        hint: result.hint,
        cached: result.cached
      });
    } catch (error) {
      console.error("[ai] hint generation failed", error);
      socket.emit(EVENTS.ERROR, {
        message: "The AI hint service is temporarily unavailable. You can still send a manual hint."
      });
    }
  });

  socket.on(EVENTS.HINT_READ, async (payload) => {
    if (!isStudentSocket(socket, payload.roomCode, payload.studentId)) {
      socket.emit(EVENTS.ERROR, { message: "Join this room before acknowledging hints." });
      return;
    }
    classroomStore.markHintRead(payload.roomCode, payload.hintId, payload.studentId);
    const room = classroomStore.getRoom(payload.roomCode);
    const student = room?.students.get(payload.studentId);
    await Promise.all([
      markHintRead(payload.hintId, payload.studentId),
      ...(room?.id && student
        ? [persistEvents(room.id, student.studentId, student.sessionEvents.slice(-1))]
        : [])
    ]).catch((error) => console.error("[db] hint read", error));
    io.to(`room:${payload.roomCode}:instructors`).emit(EVENTS.HINT_READ_RECEIPT, {
      hintId: payload.hintId,
      studentId: payload.studentId
    });
  });

  socket.on(EVENTS.REQUEST_REPLAY, (payload) => {
    if (!isInstructorSocket(socket, payload.roomCode)) {
      socket.emit(EVENTS.ERROR, { message: "Instructor authorization required." });
      return;
    }
    const student = classroomStore.getRoom(payload.roomCode)?.students.get(payload.studentId);
    if (!student) {
      socket.emit(EVENTS.ERROR, { message: "Replay not found." });
      return;
    }
    socket.emit(EVENTS.REPLAY_DATA, {
      studentId: student.studentId,
      displayName: student.displayName,
      events: student.sessionEvents
    });
  });

  socket.on(EVENTS.ASSIGN_PAIR, (payload) => {
    if (!isInstructorSocket(socket, payload.roomCode)) {
      socket.emit(EVENTS.ERROR, { message: "Instructor authorization required." });
      return;
    }
    const roomCode = payload.roomCode.toUpperCase();
    const students = classroomStore.assignPair(roomCode, payload.studentAId, payload.studentBId);
    if (!students) {
      socket.emit(EVENTS.ERROR, { message: "Both students must be connected before pairing." });
      return;
    }
    const swapInMs = payload.swapInMs ?? Number(process.env.PAIR_SWAP_MS ?? 600_000);
    const assignedAt = Date.now();
    const assignmentA: PairAssignment = {
      partnerId: students[1].studentId,
      partnerName: students[1].displayName,
      role: "driver",
      swapInMs,
      assignedAt
    };
    const assignmentB: PairAssignment = {
      partnerId: students[0].studentId,
      partnerName: students[0].displayName,
      role: "observer",
      swapInMs,
      assignedAt
    };
    io.to(`student:${students[0].studentId}`).emit(EVENTS.PAIR_ASSIGNED, assignmentA);
    io.to(`student:${students[1].studentId}`).emit(EVENTS.PAIR_ASSIGNED, assignmentB);
    emitState(io, roomCode);
    setTimeout(() => {
      classroomStore.swapPair(roomCode, students[0].studentId, students[1].studentId);
      io.to(`student:${students[0].studentId}`).emit(EVENTS.PAIR_SWAP, {
        ...assignmentA,
        role: "observer",
        assignedAt: Date.now()
      });
      io.to(`student:${students[1].studentId}`).emit(EVENTS.PAIR_SWAP, {
        ...assignmentB,
        role: "driver",
        assignedAt: Date.now()
      });
      emitState(io, roomCode);
    }, swapInMs).unref();
  });

  socket.on(EVENTS.END_SESSION, async ({ roomCode }) => {
    const normalized = roomCode.toUpperCase();
    if (socket.data.role !== "instructor" || socket.data.roomCode !== normalized) {
      socket.emit(EVENTS.ERROR, { message: "Instructor authorization required." });
      return;
    }
    const room = classroomStore.getRoom(normalized);
    if (!room?.id || !room.instructorId || socket.data.userId !== room.instructorId) {
      socket.emit(EVENTS.ERROR, { message: "Only the room owner can end this session." });
      return;
    }
    try {
      await endSession(room.id, room.instructorId);
      room.active = false;
      room.endedAt = Date.now();
      io.to(`room:${normalized}:students`).emit(EVENTS.SESSION_ENDED, {
        roomCode: normalized, endedAt: room.endedAt
      });
    } catch {
      socket.emit(EVENTS.ERROR, { message: "Only the room owner can end this session." });
    }
  });

  socket.on("disconnect", () => {
    const disconnected = classroomStore.disconnect(socket.id);
    if (disconnected) {
      io.to(`room:${disconnected.roomCode}:instructors`).emit(
        EVENTS.STUDENT_UPDATE,
        disconnected.student
      );
    }
  });
}
