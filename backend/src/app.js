// backend/src/app.js
import express from "express";
import cors from "cors";
import teamRoutes from "./routes/user.routes.js";
import gameRoutes from "./routes/game.routes.js";
import adminRoutes from "./routes/admin.routes.js";

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use("/api/teams", teamRoutes);
app.use("/api/game", gameRoutes);
app.use("/api/admin", adminRoutes);

export default app;