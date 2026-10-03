// backend/src/routes/user.routes.js
import { Router } from "express";
import { loginTeam } from "../controller/auth.controller.js";

const router = Router();

router.post("/login", loginTeam);

export default router;