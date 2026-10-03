import "dotenv/config";
import { createServer } from "node:http";
import mongoose from "mongoose";
import app from "./src/app.js";
import { initSocket } from "./src/socket/server.socket.js";

const startServer = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI must be set before starting the backend.");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const httpServer = createServer(app);
  initSocket(httpServer);

  const port = process.env.PORT || 3000;
  httpServer.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
};

startServer().catch((error) => {
  console.error("Server startup failed:", error);
  process.exit(1);
});