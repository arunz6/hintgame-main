// backend/src/routes/user.routes.js
import { Router } from "express";
import { loginTeam, registerTeam } from "../controller/auth.controller.js";

const router = Router();

router.post("/register", registerTeam);
router.post("/login", loginTeam);

export default router;