import { randomUUID } from "node:crypto";
import type { Server } from "socket.io";
import {
  EVENTS,
  type ClientToServerEvents,
  type ClassPulsePayload,
  type ServerToClientEvents,
  type StuckAlert
} from "@collabcode/shared";
import { classroomStore } from "../store/classroom";

type CollabServer = Server<ClientToServerEvents, ServerToClientEvents>;
type RiskTrend = "stable" | "rising" | "falling";
const scoreHistory = new Map<string, number[]>();
const lastPulsePersistedAt = new Map<string, number>();

async function saveClassPulse(
  sessionId: string,
  pulse: ClassPulsePayload,
  details: { idleCount: number; helpCount: number; averageStuckScore: number }
): Promise<void> {
  const { persistClassPulse } = await import("../db/supabase");
  await persistClassPulse(sessionId, pulse, details);
}

export function calculateStuckScore(
  idleMs: number,
  contentLength: number,
  errorCount: number,
  helpRequested: boolean
): number {
  if (helpRequested) return 100;
  const idlePoints = Math.min(60, Math.floor(idleMs / 1000 / 2));
  const sparsePoints = contentLength < 40 && idleMs > 30_000 ? 20 : 0;
  const errorPoints = Math.min(25, errorCount * 7);
  return Math.min(100, idlePoints + sparsePoints + errorPoints);
}

export function computeRiskTrend(history: number[]): RiskTrend {
  const points = history.slice(-5);
  if (points.length < 3) return "stable";
  const first = points[0];
  const last = points[points.length - 1];
  const slope = (last - first) / Math.max(1, points.length - 1);
  const projectedThreeMinutes = last + slope * 12;
  if (slope >= 4 && projectedThreeMinutes >= 60) return "rising";
  if (slope <= -4) return "falling";
  return "stable";
}

export function scanForStuckStudents(io: CollabServer): void {
  for (const room of classroomStore.getRooms()) {
    const newlyStuck: StuckAlert[] = [];
    for (const student of room.students) {
      if (!student.connected && Date.now() - student.lastSeen > 120_000) continue;
      const effectiveIdle = student.connected
        ? Math.max(student.idleMs, Date.now() - student.lastSeen)
        : student.idleMs;
      const score = calculateStuckScore(
        effectiveIdle,
        student.content.length,
        student.errorCount,
        student.helpRequested
      );
      const historyKey = `${room.roomCode}:${student.studentId}`;
      const history = [...(scoreHistory.get(historyKey) ?? []), score].slice(-5);
      scoreHistory.set(historyKey, history);
      const wasStuck = student.stuckFlag;
      const updated = classroomStore.setStuck(room.roomCode, student.studentId, score);
      if (updated) updated.riskTrend = computeRiskTrend(history);
      if (updated) io.to(`room:${room.roomCode}:instructors`).emit(EVENTS.STUDENT_UPDATE, updated);
      if (score >= 65 && !wasStuck) {
        const alert: StuckAlert = {
          id: randomUUID(),
          roomCode: room.roomCode,
          studentId: student.studentId,
          displayName: student.displayName,
          idleMs: effectiveIdle,
          stuckScore: score,
          lastCode: student.content,
          fileName: student.fileName,
          message: `${student.displayName} may be stuck in ${student.fileName || "their editor"}.`,
          commonPattern: false,
          createdAt: Date.now()
        };
        if (classroomStore.addAlert(alert)) newlyStuck.push(alert);
      }
    }
    for (const alert of newlyStuck) {
      io.to(`room:${room.roomCode}:instructors`).emit(EVENTS.STUCK_ALERT, alert);
    }
    const stuck = room.students.filter((student) => student.stuckFlag);
    const now = Date.now();
    const pulse: ClassPulsePayload = {
      roomCode: room.roomCode,
      timestamp: now,
      activeCount: room.students.filter((student) => student.connected && student.status === "active").length,
      stuckCount: stuck.length,
      editRate: Math.round(room.students.reduce((sum, student) => sum + student.editRate, 0))
    };
    io.to(`room:${room.roomCode}:instructors`).emit(EVENTS.CLASS_PULSE, pulse);
    if (room.id && now - (lastPulsePersistedAt.get(room.id) ?? 0) >= 30_000) {
      lastPulsePersistedAt.set(room.id, now);
      const scored = room.students.map((student) => student.stuckScore);
      void saveClassPulse(room.id, pulse, {
        idleCount: room.students.filter((student) => student.status === "idle").length,
        helpCount: room.students.filter((student) => student.helpRequested).length,
        averageStuckScore: scored.length
          ? Math.round(scored.reduce((sum, score) => sum + score, 0) / scored.length)
          : 0
      }).catch((error) => console.error("[db] class pulse", error));
    }
    if (stuck.length >= 3) {
      const common: StuckAlert = {
        id: randomUUID(),
        roomCode: room.roomCode,
        displayName: "Class pattern",
        idleMs: Math.max(...stuck.map((student) => student.idleMs)),
        stuckScore: Math.round(
          stuck.reduce((sum, student) => sum + student.stuckScore, 0) / stuck.length
        ),
        lastCode: "",
        fileName: stuck[0]?.fileName ?? "",
        message: `${stuck.length} students are struggling at the same time. Consider a class-wide checkpoint.`,
        suggestedHint: "Pause and identify the input, expected output, and one invariant before writing the next line.",
        commonPattern: true,
        createdAt: Date.now()
      };
      if (classroomStore.addAlert(common)) {
        io.to(`room:${room.roomCode}:instructors`).emit(EVENTS.STUCK_ALERT, common);
      }
    }
  }
}
