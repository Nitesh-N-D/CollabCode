import { randomUUID } from "node:crypto";
import type { Server, Socket } from "socket.io";
import {
  EVENTS,
  type ClientToServerEvents,
  type Hint,
  type PairAssignment,
  type ServerToClientEvents,
  type StuckAlert
} from "@collabcode/shared";
import { generateHint } from "../ai/aiService";
import { classroomStore } from "../store/classroom";

type CollabServer = Server<ClientToServerEvents, ServerToClientEvents>;
type CollabSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

function emitState(io: CollabServer, roomCode: string): void {
  const state = classroomStore.getState(roomCode);
  if (state) io.to(`room:${roomCode}:instructors`).emit(EVENTS.CLASSROOM_STATE, state);
}

export function registerHandlers(io: CollabServer, socket: CollabSocket): void {
  socket.on(EVENTS.STUDENT_JOIN, (payload) => {
    const roomCode = payload.roomCode.trim().toUpperCase();
    socket.join(`room:${roomCode}:students`);
    socket.join(`student:${payload.studentId}`);
    socket.data.role = "student";
    socket.data.roomCode = roomCode;
    socket.data.studentId = payload.studentId;
    classroomStore.joinStudent(roomCode, payload.studentId, payload.displayName, socket.id);
    emitState(io, roomCode);
  });

  socket.on(EVENTS.INSTRUCTOR_JOIN, (payload) => {
    const roomCode = payload.roomCode.trim().toUpperCase();
    classroomStore.ensureRoom(roomCode);
    socket.join(`room:${roomCode}:instructors`);
    socket.data.role = "instructor";
    socket.data.roomCode = roomCode;
    socket.emit(EVENTS.CLASSROOM_STATE, classroomStore.getState(roomCode)!);
  });

  socket.on(EVENTS.CODE_SNAPSHOT, (payload) => {
    const student = classroomStore.updateSnapshot(payload, socket.id);
    io.to(`room:${student.roomCode}:instructors`).emit(EVENTS.STUDENT_UPDATE, student);
  });

  socket.on(EVENTS.HELP_REQUEST, (payload) => {
    const student = classroomStore.requestHelp(payload.roomCode, payload.studentId, payload.message);
    if (!student) return;
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

  socket.on(EVENTS.SEND_HINT, (payload) => {
    const hint: Hint = {
      id: randomUUID(),
      roomCode: payload.roomCode.toUpperCase(),
      hint: payload.hint.trim(),
      codeSnippet: payload.codeSnippet?.trim() || undefined,
      targetStudentId: payload.targetStudentId,
      instructorName: payload.instructorName || "Instructor",
      sentAt: Date.now(),
      readBy: [],
      aiGenerated: false
    };
    if (!hint.hint) {
      socket.emit(EVENTS.ERROR, { message: "A hint cannot be empty." });
      return;
    }
    classroomStore.addHint(hint);
    if (hint.targetStudentId) {
      io.to(`student:${hint.targetStudentId}`).emit(EVENTS.HINT_RECEIVE, hint);
    } else {
      io.to(`room:${hint.roomCode}:students`).emit(EVENTS.HINT_RECEIVE, hint);
    }
    io.to(`room:${hint.roomCode}:instructors`).emit(EVENTS.HINT_SENT, hint);
  });

  socket.on(EVENTS.REQUEST_AI_HINT, async (payload) => {
    const student = classroomStore.getRoom(payload.roomCode)?.students.get(payload.studentId);
    if (!student) {
      socket.emit(EVENTS.ERROR, { message: "Student not found." });
      return;
    }
    const result = await generateHint(student);
    socket.emit(EVENTS.AI_HINT_RESULT, {
      studentId: student.studentId,
      hint: result.hint,
      cached: result.cached
    });
  });

  socket.on(EVENTS.HINT_READ, (payload) => {
    classroomStore.markHintRead(payload.roomCode, payload.hintId, payload.studentId);
    io.to(`room:${payload.roomCode}:instructors`).emit(EVENTS.HINT_READ_RECEIPT, {
      hintId: payload.hintId,
      studentId: payload.studentId
    });
  });

  socket.on(EVENTS.REQUEST_REPLAY, (payload) => {
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
