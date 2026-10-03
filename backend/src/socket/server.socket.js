import { Server } from "socket.io";
import { getAllowedOrigins } from "../config/security-config.js";

let io;

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: getAllowedOrigins(),
      credentials: true,
    },
  });

  console.log("Socket.io initialized");

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);
    socket.on("disconnect", (reason) => {
      console.log(`Socket disconnected: ${socket.id} (${reason})`);
    });
  });
};

export function getio() {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
}