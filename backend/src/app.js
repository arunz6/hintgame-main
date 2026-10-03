// backend/src/app.js
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import teamRoutes from "./routes/user.routes.js";
import gameRoutes from "./routes/game.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import { getAllowedOrigins } from "./config/security-config.js";

const app = express();
const allowedOrigins = getAllowedOrigins();
app.use(express.json({ limit: "32kb" }));
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Origin is not allowed by CORS."));
    },
    credentials: true,
  })
);
app.get("/api/health", (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  return res.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? "ok" : "unavailable",
    checks: { database: databaseConnected ? "connected" : "disconnected" },
  });
});
app.use("/api/teams", teamRoutes);
app.use("/api/game", gameRoutes);
app.use("/api/admin", adminRoutes);
app.use((error, req, res, next) => {
  if (error.message === "Origin is not allowed by CORS.") {
    return res.status(403).json({ message: error.message });
  }
  console.error("Request failed:", error);
  return res.status(500).json({ message: "Request failed." });
});

export default app;