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

  const httpServer = createServer(app);
  initSocket(httpServer);

  await new Promise((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(port, resolve);
  });
  console.log(`Server listening on port ${port}`);

  while (mongoose.connection.readyState !== 1) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        dbName: process.env.MONGODB_DB || "hintgame",
        serverSelectionTimeoutMS: 10000,
      });
      console.log("Connected to MongoDB.");
    } catch (error) {
      console.error("MongoDB connection failed; retrying in 5 seconds:", error.message);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
};

startServer().catch((error) => {
  console.error("Server startup failed:", error);
  process.exit(1);
});