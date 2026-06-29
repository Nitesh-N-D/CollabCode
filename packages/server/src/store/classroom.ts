import { randomUUID } from "node:crypto";
import type {
  AnalyticsReport,
  ClassroomState,
  CodeSnapshotPayload,
  HeatmapEntry,
  Hint,
  SessionEvent,
  StudentState,
  StuckAlert
} from "@collabcode/shared";

interface RoomRecord {
  id: string;
  roomCode: string;
  title: string;
  assignmentName: string;
  instructorId: string;
  instructorName: string;
  active: boolean;
  endedAt: number | null;
  expiresAt: number | null;
  students: Map<string, StudentState>;
  hints: Hint[];
  alerts: StuckAlert[];
  createdAt: number;
}

const MAX_EVENTS = 10_000;

export class ClassroomStore {
  private readonly rooms = new Map<string, RoomRecord>();

  ensureRoom(roomCode: string, title = `${roomCode} Live Lab`): RoomRecord {
    const code = roomCode.trim().toUpperCase();
    const existing = this.rooms.get(code);
    if (existing) return existing;
    const room = {
      id: "",
      roomCode: code,
      title,
      assignmentName: "",
      instructorId: "",
      instructorName: "",
      active: true,
      endedAt: null,
      expiresAt: null,
      students: new Map<string, StudentState>(),
      hints: [],
      alerts: [],
      createdAt: Date.now()
    };
    this.rooms.set(code, room);
    return room;
  }

  hydrateRoom(input: {
    id: string; code: string; title: string; assignmentName: string;
    instructorId: string; instructorName: string; active: boolean;
    endedAt: number | null; expiresAt: number | null;
  }): RoomRecord {
    const room = this.ensureRoom(input.code, input.title);
    Object.assign(room, {
      id: input.id, title: input.title, assignmentName: input.assignmentName,
      instructorId: input.instructorId, instructorName: input.instructorName,
      active: input.active, endedAt: input.endedAt, expiresAt: input.expiresAt
    });
    return room;
  }

  createRoom(title: string, requestedCode?: string): ClassroomState {
    const code = (requestedCode ?? randomUUID().replaceAll("-", "").slice(0, 6)).toUpperCase();
    return this.toState(this.ensureRoom(code, title));
  }

  getRoom(roomCode: string): RoomRecord | undefined {
    return this.rooms.get(roomCode.toUpperCase());
  }

  getRooms(): ClassroomState[] {
    return [...this.rooms.values()].map((room) => this.toState(room));
  }

  joinStudent(
    roomCode: string,
    studentId: string,
    displayName: string,
    socketId: string
  ): StudentState {
    const room = this.ensureRoom(roomCode);
    const existing = room.students.get(studentId);
    const student: StudentState = {
      studentId,
      displayName: displayName || existing?.displayName || "Student",
      roomCode: room.roomCode,
      fileName: existing?.fileName ?? "",
      languageId: existing?.languageId ?? "",
      content: existing?.content ?? "",
      cursorLine: existing?.cursorLine ?? 0,
      lastSeen: Date.now(),
      idleMs: existing?.idleMs ?? 0,
      errorCount: existing?.errorCount ?? 0,
      status: "active",
      stuckScore: existing?.stuckScore ?? 0,
      stuckFlag: existing?.stuckFlag ?? false,
      helpRequested: existing?.helpRequested ?? false,
      connected: true,
      selectionStartLine: existing?.selectionStartLine ?? 0,
      selectionEndLine: existing?.selectionEndLine ?? 0,
      focusProtected: existing?.focusProtected ?? false,
      editRate: existing?.editRate ?? 0,
      socketId,
      pairPartnerId: existing?.pairPartnerId,
      pairRole: existing?.pairRole,
      sessionEvents: existing?.sessionEvents ?? []
    };
    room.students.set(studentId, student);
    this.pushEvent(room.roomCode, studentId, { type: "join", timestamp: Date.now() });
    return student;
  }

  updateSnapshot(payload: CodeSnapshotPayload, socketId?: string): StudentState {
    const room = this.ensureRoom(payload.roomCode);
    let student = room.students.get(payload.studentId);
    if (!student) {
      student = this.joinStudent(
        room.roomCode,
        payload.studentId,
        payload.displayName,
        socketId ?? ""
      );
    }
    const previousSnapshot = [...student.sessionEvents].reverse().find((event) => event.type === "snapshot");
    const elapsedMinutes = previousSnapshot
      ? Math.max((payload.timestamp - previousSnapshot.timestamp) / 60_000, 1 / 60)
      : 1;
    const changed = previousSnapshot?.content !== payload.content;
    const editRate = changed ? Math.min(60, 1 / elapsedMinutes) : 0;
    const focusProtected = editRate > 3 && payload.idleMs < 10_000
      && student.stuckScore < 20 && (payload.errorCount ?? 0) === 0;
    Object.assign(student, {
      displayName: payload.displayName || student.displayName,
      fileName: payload.fileName,
      languageId: payload.languageId,
      content: payload.content,
      cursorLine: payload.cursorLine,
      lastSeen: payload.timestamp,
      idleMs: payload.idleMs,
      errorCount: payload.errorCount ?? student.errorCount,
      selectionStartLine: payload.selectionStartLine ?? payload.cursorLine,
      selectionEndLine: payload.selectionEndLine ?? payload.cursorLine,
      editRate,
      focusProtected,
      connected: true,
      socketId: socketId ?? student.socketId,
      status: payload.idleMs > 60_000 ? "idle" : "active"
    });
    this.pushEvent(room.roomCode, student.studentId, {
      type: "snapshot",
      timestamp: payload.timestamp,
      fileName: payload.fileName,
      languageId: payload.languageId,
      content: payload.content,
      cursorLine: payload.cursorLine,
      idleMs: payload.idleMs,
      meta: { errorCount: payload.errorCount ?? 0 }
    });
    return student;
  }

  requestHelp(roomCode: string, studentId: string, message?: string): StudentState | undefined {
    const student = this.getRoom(roomCode)?.students.get(studentId);
    if (!student) return undefined;
    student.helpRequested = true;
    student.status = "needs_help";
    student.stuckFlag = true;
    student.stuckScore = 100;
    this.pushEvent(roomCode, studentId, {
      type: "help_request",
      timestamp: Date.now(),
      meta: { message: message ?? "" }
    });
    return student;
  }

  pushEvent(
    roomCode: string,
    studentId: string,
    event: Omit<SessionEvent, "id"> & { id?: string }
  ): void {
    const student = this.getRoom(roomCode)?.students.get(studentId);
    if (!student) return;
    if (student.sessionEvents.length >= MAX_EVENTS) student.sessionEvents.shift();
    student.sessionEvents.push({ ...event, id: event.id ?? randomUUID() });
  }

  addHint(hint: Hint): void {
    const room = this.ensureRoom(hint.roomCode);
    room.hints.unshift(hint);
    room.hints = room.hints.slice(0, 100);
    const targets = hint.targetStudentId
      ? [room.students.get(hint.targetStudentId)].filter(Boolean)
      : [...room.students.values()];
    for (const student of targets) {
      if (!student) continue;
      this.pushEvent(room.roomCode, student.studentId, {
        type: "hint_received",
        timestamp: hint.sentAt,
        meta: { hintId: hint.id, hint: hint.hint }
      });
    }
  }

  markHintRead(roomCode: string, hintId: string, studentId: string): void {
    const room = this.getRoom(roomCode);
    const hint = room?.hints.find((item) => item.id === hintId);
    if (hint && !hint.readBy.includes(studentId)) hint.readBy.push(studentId);
    this.pushEvent(roomCode, studentId, {
      type: "hint_read",
      timestamp: Date.now(),
      meta: { hintId }
    });
  }

  addAlert(alert: StuckAlert): boolean {
    const room = this.ensureRoom(alert.roomCode);
    const duplicate = room.alerts.some(
      (item) =>
        item.studentId === alert.studentId &&
        item.commonPattern === alert.commonPattern &&
        Date.now() - item.createdAt < 60_000
    );
    if (duplicate) return false;
    room.alerts.unshift(alert);
    room.alerts = room.alerts.slice(0, 100);
    return true;
  }

  setStuck(roomCode: string, studentId: string, score: number): StudentState | undefined {
    const student = this.getRoom(roomCode)?.students.get(studentId);
    if (!student) return undefined;
    student.stuckScore = score;
    student.stuckFlag = score >= 65 || student.helpRequested;
    if (student.helpRequested) student.status = "needs_help";
    else if (student.stuckFlag) student.status = "stuck";
    else if (!student.connected) student.status = "offline";
    else if (student.idleMs > 60_000) student.status = "idle";
    else student.status = "active";
    return student;
  }

  assignPair(
    roomCode: string,
    studentAId: string,
    studentBId: string
  ): [StudentState, StudentState] | undefined {
    const room = this.getRoom(roomCode);
    const a = room?.students.get(studentAId);
    const b = room?.students.get(studentBId);
    if (!a || !b) return undefined;
    a.pairPartnerId = b.studentId;
    a.pairRole = "driver";
    b.pairPartnerId = a.studentId;
    b.pairRole = "observer";
    this.pushEvent(roomCode, a.studentId, {
      type: "pair_start",
      timestamp: Date.now(),
      meta: { partnerId: b.studentId, role: a.pairRole }
    });
    this.pushEvent(roomCode, b.studentId, {
      type: "pair_start",
      timestamp: Date.now(),
      meta: { partnerId: a.studentId, role: b.pairRole }
    });
    return [a, b];
  }

  swapPair(roomCode: string, studentAId: string, studentBId: string): void {
    const room = this.getRoom(roomCode);
    const a = room?.students.get(studentAId);
    const b = room?.students.get(studentBId);
    if (!a || !b) return;
    a.pairRole = a.pairRole === "driver" ? "observer" : "driver";
    b.pairRole = b.pairRole === "driver" ? "observer" : "driver";
    this.pushEvent(roomCode, a.studentId, {
      type: "pair_swap",
      timestamp: Date.now(),
      meta: { role: a.pairRole }
    });
    this.pushEvent(roomCode, b.studentId, {
      type: "pair_swap",
      timestamp: Date.now(),
      meta: { role: b.pairRole }
    });
  }

  disconnect(socketId: string): { roomCode: string; student: StudentState } | undefined {
    for (const room of this.rooms.values()) {
      const student = [...room.students.values()].find((item) => item.socketId === socketId);
      if (!student) continue;
      student.connected = false;
      student.status = "offline";
      student.socketId = undefined;
      this.pushEvent(room.roomCode, student.studentId, {
        type: "disconnect",
        timestamp: Date.now()
      });
      return { roomCode: room.roomCode, student };
    }
    return undefined;
  }

  getState(roomCode: string): ClassroomState | undefined {
    const room = this.getRoom(roomCode);
    return room ? this.toState(room) : undefined;
  }

  getAnalytics(roomCode: string): AnalyticsReport | undefined {
    const room = this.getRoom(roomCode);
    if (!room) return undefined;
    const students = [...room.students.values()];
    const buckets = new Map<string, HeatmapEntry>();
    for (const student of students) {
      for (const event of student.sessionEvents) {
        if (event.type !== "snapshot" || !event.fileName || event.cursorLine === undefined) continue;
        const line = Math.max(1, Math.round(event.cursorLine / 5) * 5);
        const key = `${event.fileName}:${line}`;
        const entry = buckets.get(key) ?? {
          fileName: event.fileName,
          lineNumber: line,
          struggleCount: 0,
          totalIdleMs: 0
        };
        if ((event.idleMs ?? 0) >= 30_000) entry.struggleCount += 1;
        entry.totalIdleMs += event.idleMs ?? 0;
        buckets.set(key, entry);
      }
    }
    return {
      roomCode: room.roomCode,
      totalStudents: students.length,
      connectedStudents: students.filter((student) => student.connected).length,
      stuckStudents: students.filter((student) => student.stuckFlag).length,
      helpRequests: students.filter((student) => student.helpRequested).length,
      hintsSent: room.hints.length,
      averageIdleMs: students.length
        ? Math.round(students.reduce((sum, student) => sum + student.idleMs, 0) / students.length)
        : 0,
      heatmap: [...buckets.values()]
        .filter((item) => item.struggleCount > 0)
        .sort((a, b) => b.totalIdleMs - a.totalIdleMs),
      timeline: [],
      teachingMoments: [],
      generatedAt: Date.now()
    };
  }

  reset(): void {
    this.rooms.clear();
  }

  private toState(room: RoomRecord): ClassroomState {
    return {
      id: room.id,
      roomCode: room.roomCode,
      title: room.title,
      assignmentName: room.assignmentName,
      instructorId: room.instructorId,
      instructorName: room.instructorName,
      active: room.active,
      endedAt: room.endedAt,
      expiresAt: room.expiresAt,
      students: [...room.students.values()],
      hints: room.hints,
      alerts: room.alerts,
      createdAt: room.createdAt
    };
  }
}

export const classroomStore = new ClassroomStore();
