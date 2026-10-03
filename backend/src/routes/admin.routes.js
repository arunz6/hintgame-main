// backend/src/routes/admin.routes.js
import { Router } from "express";
import {
  overview,
  addTeam,
  deleteTeam,
  updateTeam,
  resetPassword,
  updateMember,
  addMember,
  deleteMember,
  disqualify,
  resetLock,
  getLevels,
  saveQuestionSet,
  setQuestionSetFinalized,
} from "../controller/admin.controller.js";

const router = Router();

router.get("/overview", overview);
router.post("/add-team", addTeam);
router.post("/delete-team", deleteTeam);
router.post("/update-team", updateTeam);
router.post("/reset-password", resetPassword);
router.post("/update-member", updateMember);
router.post("/add-member", addMember);
router.post("/delete-member", deleteMember);
router.post("/disqualify", disqualify);
router.post("/reset-lock", resetLock);
router.get("/levels", getLevels);
router.post("/levels/sets", saveQuestionSet);
router.post("/levels/sets/finalize", setQuestionSetFinalized);

export default router;