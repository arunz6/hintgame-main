import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import teamRoutes from "./routes/user.routes.js";
import gameRoutes from "./routes/game.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import { getAllowedOrigins } from "./config/security-config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const allowedOrigins = getAllowedOrigins();
const publicPath = path.resolve(__dirname, "../public");

app.use(express.static(publicPath));

app.use((req, res, next) => {
  const origin = req.get("origin");
  if (origin) {
    try {
      const forwardedProtocol = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
      const requestProtocol = forwardedProtocol || req.protocol;
      const requestOrigin = new URL(`${requestProtocol}://${req.get("host")}`).origin;
      if (new URL(origin).origin === requestOrigin) {
        return next();
      }
    } catch {
      return next(new Error("Invalid request origin."));
    }
  }

  return cors({
    origin(requestOrigin, callback) {
      if (!requestOrigin || allowedOrigins.includes(requestOrigin)) {
        return callback(null, true);
      }
      return callback(new Error("Origin is not allowed by CORS."));
    },
    credentials: true,
  })(req, res, next);
});

app.use(express.json({ limit: "32kb" }));

app.get("/api/health", (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  return res.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? "ok" : "unavailable",
    checks: { database: databaseConnected ? "connected" : "disconnected" },
  });
});

app.use("/api", (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      message: "Database is unavailable. The server is reconnecting; please try again shortly.",
    });
  }
  return next();
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

app.get("/{*splat}", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

export default app;