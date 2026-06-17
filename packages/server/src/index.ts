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

export function startServer(port = Number(process.env.PORT ?? 4000)) {
  const app = createApp();
  const httpServer = createServer(app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL?.split(",") ?? "*",
      methods: ["GET", "POST"]
    }
  });

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
