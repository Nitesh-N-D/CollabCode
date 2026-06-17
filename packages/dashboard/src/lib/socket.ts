import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@collabcode/shared";
import { SERVER_URL } from "./api";

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | undefined;

export function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (!socket) {
    socket = io(SERVER_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000
    });
  }
  return socket;
}
