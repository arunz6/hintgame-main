// backend/src/routes/game.routes.js
import { Router } from "express";
import {
  getLevels,
  getLevelDetail,
  submitAnswer,
  submitCode,
  getLeaderboard,
} from "../controller/game.controller.js";
import { requireTeamSession } from "../middleware/team-session.middleware.js";

const router = Router();

router.get("/leaderboard", getLeaderboard);
router.get("/levels/:teamId", requireTeamSession, getLevels);
router.get("/level/:number", requireTeamSession, getLevelDetail);
router.post("/answer", requireTeamSession, submitAnswer);
router.post("/unlock", requireTeamSession, submitCode);

export default router;