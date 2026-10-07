// backend/src/controller/game.controller.js
import Team from "../model/user.schema.js";
import Level from "../model/level.schema.js";
import { getHuntState } from "../utils/hunt-state.js";
import {
  getSetKey,
  serializeTeamLevelSets,
} from "../utils/level-sets.js";

const LOCK_MINUTES = 5;
const ELIMINATION_TARGETS = { 1: 15, 2: 9, 3: 6, 4: 4 };
const FINISHED_MESSAGE =
  "Vector displacement: Zero. Thermodynamic equilibrium: Not achieved. Do not mistake the closure of the campus loop for the termination of the experiment. Your presence at Source Coordinate Zero has simply activated the Omega Trigger. The prize remains locked behind a final dynamic resistance barrier. Prepare for a direct, high-frequency cognitive trial right here at the transmission desk. The ultimate asset belongs only to the apex architecture that dominates this final processing cycle";

const publicTeam = (team) => ({
  id: team._id,
  teamName: team.teamName,
  teamCode: team.teamCode,
  group: team.group,
  levelGroups: serializeTeamLevelSets(team),
  members: team.members.map((m) => ({ id: m._id, name: m.name })),
  status: team.status,
  currentLevel: team.currentLevel,
  lockUntil: team.lockUntil,
  finalRank: team.finalRank,
  completionRank: team.completionRank,
});

function getAssignedLevelSet(team, level) {
  const setKey = getSetKey(team, level.number);
  const data = setKey ? level.groups?.[setKey] : null;
  const mcq = data?.mcq;
  if (
    !data?.finalized ||
    !mcq?.question?.trim() ||
    !Array.isArray(mcq.options) ||
    mcq.options.length < 2 ||
    !Number.isInteger(mcq.correctIndex) ||
    mcq.correctIndex < 0 ||
    mcq.correctIndex >= mcq.options.length ||
    typeof mcq.options[mcq.correctIndex] !== "string" ||
    !mcq.options[mcq.correctIndex].trim() ||
    !data.clue?.trim() ||
    !data.secretCode?.trim()
  ) {
    console.error("No question set assigned for this team and level.", {
    teamCode: team.teamCode,
    level: level.number,
    setKey,
    });
    return null;
  }
  return { setKey, data, mcq };
}

/* ---------- GET LEVELS ---------- */
export async function getLevels(req, res) {
  try {
    const team = req.team;
    const hunt = await getHuntState();

    const levels = await Level.find({ number: { $gte: 1, $lte: 4 } }).sort({ number: 1 });
    const safe = levels.map((lv) => ({
      number: lv.number,
      title: lv.title,
      locked: lv.number > team.currentLevel,
      completed: lv.number < team.currentLevel,
    }));

    const target = ELIMINATION_TARGETS[team.currentLevel];
    let warning = null;
    if (target) {
      const half = Math.ceil(target / 2);
      const finishedCount = team.currentLevel === 4
        ? await Team.countDocuments({ status: "finished" })
        : await Team.countDocuments({
            currentLevel: { $gt: team.currentLevel },
          });
      if (finishedCount >= half) {
        warning = "⚠ You have less time — other teams are completing this level fast!";
      }
    }

    return res.json({
      team: publicTeam(team),
      levels: safe,
      warning,
      completionMessage: FINISHED_MESSAGE,
      hunt: {
        status: hunt.status,
        startsAt: hunt.startsAt,
        startedAt: hunt.startedAt,
        endedAt: hunt.endedAt,
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Could not load levels." });
  }
}

/* ---------- GET LEVEL DETAIL ---------- */
export async function getLevelDetail(req, res) {
  try {
    const { number } = req.params;
    const team = req.team;
    const hunt = await getHuntState();
    if (hunt?.status !== "running")
      return res.status(403).json({
        message: hunt?.status === "ended"
          ? "The game has ended. Gameplay is no longer available."
          : "The hunt has not started yet.",
        huntNotStarted: true,
        hunt: { status: hunt.status, startsAt: hunt.startsAt, endedAt: hunt.endedAt },
      });
    if (team.status === "eliminated")
      return res.status(403).json({ message: "You have been eliminated." });
    if (team.status === "finished")
      return res.status(403).json({ message: FINISHED_MESSAGE });

    if (Number(number) > team.currentLevel)
      return res.status(403).json({ message: "Level is locked." });

    const level = await Level.findOne({ number: Number(number) });
    if (!level) return res.status(404).json({ message: "Level not found." });

    const solved = team.levelSolvedAt.some((l) => l.level === level.number);
    const lockActive = team.lockUntil && team.lockUntil > new Date();

    const assigned = getAssignedLevelSet(team, level);
    if (!assigned)
      return res.status(500).json({ message: "No question set assigned for this team and level." });

    return res.json({
      number: level.number,
      title: level.title,
      mcq: {
        question: assigned.mcq.question,
        options: assigned.mcq.options,
      },
      group: assigned.setKey,
      // only send this team's group clue
      clue: solved ? assigned.data.clue : null,
      lockUntil: lockActive ? team.lockUntil : null,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Could not load level." });
  }
}

/* ---------- SUBMIT ANSWER ---------- */
export async function submitAnswer(req, res) {
  try {
    const { level, answerIndex } = req.body;
    const team = req.team;
    const hunt = await getHuntState();
    if (hunt?.status !== "running")
      return res.status(403).json({
        message: hunt?.status === "ended"
          ? "The game has ended. Gameplay is no longer available."
          : "The hunt has not started yet.",
        huntNotStarted: true,
        hunt: { status: hunt.status, startsAt: hunt.startsAt, endedAt: hunt.endedAt },
      });
    if (team.status === "eliminated")
      return res.status(403).json({ message: "You have been eliminated." });
    if (team.status === "finished")
      return res.status(403).json({ message: FINISHED_MESSAGE });
    if (!Number.isInteger(level) || level > team.currentLevel || level < 1)
      return res.status(403).json({ message: "Level is locked." });

    if (team.lockUntil && team.lockUntil > new Date())
      return res.status(423).json({
        message: "Options locked.",
        lockUntil: team.lockUntil,
      });

    const lv = await Level.findOne({ number: level });
    if (!lv) return res.status(404).json({ message: "Level not found." });

    const assigned = getAssignedLevelSet(team, lv);
    if (!assigned)
      return res.status(500).json({ message: "No question set assigned for this team and level." });

    if (answerIndex !== assigned.mcq.correctIndex) {
      team.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
      team.wrongAttempts = (team.wrongAttempts || 0) + 1;
      team.penaltySeconds = (team.penaltySeconds || 0) + LOCK_MINUTES * 60;
      await team.save();
      return res.status(400).json({
        correct: false,
        message: `Wrong answer. Options locked for ${LOCK_MINUTES} minutes.`,
        lockUntil: team.lockUntil,
      });
    }

    if (!team.levelSolvedAt.some((l) => l.level === level)) {
      team.levelSolvedAt.push({ level, at: new Date() });
      if (team.status === "not_started") {
        team.status = "playing";
        team.startedAt = new Date();
      }
      team.wrongAttempts = 0;
      await team.save();
    }

    await maybeEliminate(level);

    // send THIS team's group clue
    return res.json({ correct: true, clue: assigned.data.clue });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Could not submit answer." });
  }
}

/* ---------- SUBMIT CODE ---------- */
export async function submitCode(req, res) {
  try {
    const { level, code } = req.body;
    const team = req.team;
    const hunt = await getHuntState();
    if (hunt?.status !== "running")
      return res.status(403).json({
        message: hunt?.status === "ended"
          ? "The game has ended. Gameplay is no longer available."
          : "The hunt has not started yet.",
        huntNotStarted: true,
        hunt: { status: hunt.status, startsAt: hunt.startsAt, endedAt: hunt.endedAt },
      });
    if (team.status === "eliminated")
      return res.status(403).json({ message: "You have been eliminated." });
    if (team.status === "finished")
      return res.status(403).json({ message: FINISHED_MESSAGE });
    if (!Number.isInteger(level) || level > team.currentLevel || level < 1)
      return res.status(403).json({ message: "Level is locked." });

    const lv = await Level.findOne({ number: level });
    if (!lv) return res.status(404).json({ message: "Level not found." });

    // check against this team's group code ONLY
    const assigned = getAssignedLevelSet(team, lv);
    if (!assigned)
      return res.status(500).json({ message: "No question set assigned for this team and level." });
    const correctCode = assigned.data.secretCode;

    if (String(code).trim().toUpperCase() !== correctCode)
      return res.status(400).json({ correct: false, message: "Wrong code. Try again." });

    if (!team.levelSolvedAt.some((l) => l.level === level))
      return res.status(400).json({ message: "Solve the MCQ first." });

    if (team.currentLevel === level) {
      team.currentLevel = level + 1;
      team.lockUntil = null;
      team.wrongAttempts = 0;

      if (team.currentLevel > 4) {
        team.currentLevel = 4;
        team.status = "finished";
        team.finishedAt = new Date();

        const finishedCount = await Team.countDocuments({
          status: "finished",
          _id: { $ne: team._id },
        });
        team.completionRank = finishedCount + 1;
        if (team.completionRank === 1) team.finalRank = "gold";
        else if (team.completionRank === 2) team.finalRank = "silver";
        else if (team.completionRank === 3) team.finalRank = "bronze";
      }
      await team.save();
      await maybeEliminate(level);
    }

    return res.json({ correct: true, currentLevel: team.currentLevel });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Could not unlock." });
  }
}

/* ---------- AUTO-ELIMINATION ---------- */
async function maybeEliminate(completedLevel) {
  const target = ELIMINATION_TARGETS[completedLevel];
  if (!target) return;

  const passed = completedLevel === 4
    ? await Team.countDocuments({ status: "finished" })
    : await Team.countDocuments({
        currentLevel: { $gt: completedLevel },
        status: { $ne: "eliminated" },
      });

  if (passed >= target) {
    const filter = completedLevel === 4
      ? { status: { $nin: ["eliminated", "finished"] } }
      : { currentLevel: completedLevel, status: { $ne: "eliminated" } };

    await Team.updateMany(filter, {
      $set: { status: "eliminated", eliminatedAt: new Date() },
    });
  }
}

/* ---------- LEADERBOARD ---------- */
export async function getLeaderboard(req, res) {
  try {
    const hunt = await getHuntState();
    const teams = await Team.find().sort({
      currentLevel: -1,
      finishedAt: 1,
      startedAt: 1,
      createdAt: 1,
    });

    const now = new Date();
    const ranked = teams.map((t, i) => ({
      rank: i + 1,
      teamName: t.teamName,
      teamCode: t.teamCode,
      group: t.group,
      members: t.members.map((m) => m.name),
      currentLevel: t.currentLevel,
      status: t.status,
      finalRank: t.finalRank,
      completionRank: t.completionRank,
      lockUntil: t.lockUntil,
      lockedNow: t.lockUntil && t.lockUntil > now,
      finishedAt: t.finishedAt,
    }));

    const summary = {
      total: teams.length,
      playing: teams.filter((t) => t.status === "playing").length,
      eliminated: teams.filter((t) => t.status === "eliminated").length,
      finished: teams.filter((t) => t.status === "finished").length,
      locked: ranked.filter((t) => t.lockedNow).length,
    };

    return res.json({ teams: ranked, summary, hunt });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Could not load leaderboard." });
  }
}