// backend/src/routes/game.routes.js
import { Router } from "express";
import {
  getLevels,
  getLevelDetail,
  submitAnswer,
  submitCode,
  getLeaderboard,
  applyRefreshPenalty,
} from "../controller/game.controller.js";

const router = Router();

router.get("/levels/:teamId", getLevels);
router.get("/level/:number", getLevelDetail);
router.post("/answer", submitAnswer);
router.post("/unlock", submitCode);
router.post("/refresh", applyRefreshPenalty);
router.get("/leaderboard", getLeaderboard);

export default router;