// backend/src/routes/user.routes.js
import { Router } from "express";
import { loginTeam, logoutTeam, registerTeam } from "../controller/auth.controller.js";
import { requireTeamSession } from "../middleware/team-session.middleware.js";

const router = Router();

router.post("/register", registerTeam);
router.post("/login", loginTeam);
router.post("/logout", requireTeamSession, logoutTeam);

export default router;