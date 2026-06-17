import cors from "cors";
import express from "express";
import { checkAcademicIntegrity } from "./ai/integrityChecker";
import { classroomStore } from "./store/classroom";

export function createApp(): express.Express {
  const app = express();
  app.use(
    cors({
      origin: process.env.FRONTEND_URL?.split(",") ?? "*",
      credentials: true
    })
  );
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_request, response) => {
    response.json({ status: "ok", service: "collabcode-server", ts: Date.now() });
  });

  app.get("/api/sessions", (_request, response) => {
    response.json(classroomStore.getRooms());
  });

  app.post("/api/sessions", (request, response) => {
    const title = String(request.body?.title ?? "Untitled coding lab").trim();
    const roomCode = request.body?.roomCode ? String(request.body.roomCode) : undefined;
    response.status(201).json(classroomStore.createRoom(title, roomCode));
  });

  app.get("/api/sessions/:roomCode", (request, response) => {
    const room = classroomStore.getState(request.params.roomCode);
    if (!room) {
      response.status(404).json({ error: "Room not found" });
      return;
    }
    response.json(room);
  });

  app.get("/api/replay/:roomCode/:studentId", (request, response) => {
    const student = classroomStore
      .getRoom(request.params.roomCode)
      ?.students.get(request.params.studentId);
    if (!student) {
      response.status(404).json({ error: "Student not found" });
      return;
    }
    response.json({
      studentId: student.studentId,
      displayName: student.displayName,
      events: student.sessionEvents
    });
  });

  app.get("/api/analytics/:roomCode", (request, response) => {
    const report = classroomStore.getAnalytics(request.params.roomCode);
    if (!report) {
      response.status(404).json({ error: "Room not found" });
      return;
    }
    response.json(report);
  });

  app.get("/api/integrity/:roomCode", (request, response) => {
    const room = classroomStore.getRoom(request.params.roomCode);
    if (!room) {
      response.status(404).json({ error: "Room not found" });
      return;
    }
    response.json(checkAcademicIntegrity([...room.students.values()]));
  });

  return app;
}
