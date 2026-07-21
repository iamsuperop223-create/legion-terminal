import { io, Socket } from "socket.io-client";

const WS_URL = import.meta.env.VITE_WS_URL || "";

let socket: Socket | null = null;

export function connectSocket(token: string): Socket {
  if (socket?.connected) return socket;

  socket = io(WS_URL || window.location.origin, {
    auth: { token },
    transports: ["websocket", "polling"],
  });

  socket.on("connect", () => console.log("WebSocket connected"));
  socket.on("disconnect", () => console.log("WebSocket disconnected"));
  socket.on("connect_error", (err) => console.error("WS error:", err.message));

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
