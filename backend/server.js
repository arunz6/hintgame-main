import "dotenv/config";
import { createServer } from "node:http";
import mongoose from "mongoose";
import app from "./src/app.js";
import { initSocket } from "./src/socket/server.socket.js";

const startServer = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI must be set before starting the backend.");
  }
  if (process.env.NODE_ENV === "production") {
    if (!process.env.ADMIN_KEY || process.env.ADMIN_KEY.length < 32) {
      throw new Error("Production ADMIN_KEY must be set to a secret of at least 32 characters.");
    }
    if (process.env.MONGODB_URI.includes("localhost") || process.env.MONGODB_URI.includes("127.0.0.1")) {
      throw new Error("Production MONGODB_URI must point to a remotely hosted database.");
    }
  }

  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be a valid TCP port number.");
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_DB || "hintgame",
  });

  const httpServer = createServer(app);
  initSocket(httpServer);

  httpServer.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
};

startServer().catch((error) => {
  console.error("Server startup failed:", error);
  process.exit(1);
});