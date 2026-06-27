import "dotenv/config";
import { createServer } from "node:http";
import { Server } from "socket.io";
import {
  type ClientToServerEvents,
  type ServerToClientEvents
} from "@collabcode/shared";
import { createApp } from "./app";
import { scanForStuckStudents } from "./ai/stuckDetector";
import { registerHandlers } from "./socket/handlers";
import { assertProductionConfig, config } from "./config";
import { listActiveSessions } from "./db/supabase";
import { classroomStore } from "./store/classroom";

export function startServer(port = config.port) {
  assertProductionConfig();
  const app = createApp();
  const httpServer = createServer(app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: config.frontendOrigins,
      methods: ["GET", "POST"]
    }
  });

  void listActiveSessions().then((rows) => {
    for (const row of rows) {
      if (row.expires_at && Date.parse(row.expires_at) <= Date.now()) continue;
      classroomStore.hydrateRoom({
        id: row.id, code: row.code, title: row.title, assignmentName: row.assignment_name,
        instructorId: row.instructor_id, instructorName: row.instructor_name, active: row.active,
        endedAt: row.ended_at ? Date.parse(row.ended_at) : null,
        expiresAt: row.expires_at ? Date.parse(row.expires_at) : null
      });
    }
    console.log(`[CollabCode] recovered ${rows.length} active session records`);
  }).catch((error) => console.error("[CollabCode] session recovery failed", error));

  io.on("connection", (socket) => registerHandlers(io, socket));
  const scanTimer = setInterval(
    () => scanForStuckStudents(io),
    Number(process.env.STUCK_SCAN_MS ?? 5000)
  );
  scanTimer.unref();

  httpServer.listen(port, () => {
    console.log(`[CollabCode] server ready at http://localhost:${port}`);
  });
  return { app, io, httpServer };
}

if (require.main === module) startServer();
