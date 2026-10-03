// backend/src/controller/game.controller.js
import Team from "../model/user.schema.js";
import Level from "../model/level.schema.js";

const LOCK_MINUTES = 30;
const REFRESH_LOCK_MINUTES = 35;
const ELIMINATION_TARGETS = { 1: 15, 2: 9, 3: 6 };

const publicTeam = (team) => ({
  id: team._id,
  teamName: team.teamName,
  teamCode: team.teamCode,
  group: team.group,
  members: team.members.map((m) => ({ id: m._id, name: m.name })),
  status: team.status,
  currentLevel: team.currentLevel,
  lockUntil: team.lockUntil,
  finalRank: team.finalRank,
  completionRank: team.completionRank,
});

/* ---------- GET LEVELS ---------- */
export async function getLevels(req, res) {
  try {
    const { teamId } = req.params;
    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: "Team not found." });

    const levels = await Level.find().sort({ number: 1 });
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
      const finishedCount = await Team.countDocuments({
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
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Could not load levels." });
  }
}

/* ---------- REFRESH PENALTY ---------- */
export async function applyRefreshPenalty(req, res) {
  try {
    const { teamId } = req.body;
    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: "Team not found." });

    const now = new Date();
    if (team.lockUntil && team.lockUntil > now) {
      const newLock = new Date(now.getTime() + REFRESH_LOCK_MINUTES * 60 * 1000);
      if (newLock > team.lockUntil) {
        team.lockUntil = newLock;
        team.lockCount = (team.lockCount || 0) + 1;
        await team.save();
        return res.json({
          applied: true,
          message: "Nice try, team. +5 minutes added. 😏",
          lockUntil: team.lockUntil,
        });
      }
    }

    return res.json({ applied: false, lockUntil: team.lockUntil });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Could not apply refresh penalty." });
  }
}

/* ---------- GET LEVEL DETAIL ---------- */
export async function getLevelDetail(req, res) {
  try {
    const { number } = req.params;
    const { teamId } = req.query;

    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: "Team not found." });
    if (team.status === "eliminated")
      return res.status(403).json({ message: "You have been eliminated." });

    if (Number(number) > team.currentLevel)
      return res.status(403).json({ message: "Level is locked." });

    const level = await Level.findOne({ number: Number(number) });
    if (!level) return res.status(404).json({ message: "Level not found." });

    const solved = team.levelSolvedAt.some((l) => l.level === level.number);
    const lockActive = team.lockUntil && team.lockUntil > new Date();

    const groupData = level.groups[team.group];

    return res.json({
      number: level.number,
      title: level.title,
      mcq: level.mcq,
      group: team.group,
      // only send this team's group clue
      clue: solved ? groupData.clue : null,
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
    const { teamId, level, answerIndex } = req.body;
    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: "Team not found." });
    if (team.status === "eliminated")
      return res.status(403).json({ message: "You have been eliminated." });

    if (team.lockUntil && team.lockUntil > new Date())
      return res.status(423).json({
        message: "Options locked.",
        lockUntil: team.lockUntil,
      });

    const lv = await Level.findOne({ number: level });
    if (!lv) return res.status(404).json({ message: "Level not found." });

    if (answerIndex !== lv.mcq.correctIndex) {
      team.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
      team.wrongAttempts = (team.wrongAttempts || 0) + 1;
      team.penaltySeconds = (team.penaltySeconds || 0) + LOCK_MINUTES * 60;
      await team.save();
      return res.status(400).json({
        correct: false,
        message: "Wrong answer. Options locked for 30 minutes.",
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
    const groupData = lv.groups[team.group];
    return res.json({ correct: true, clue: groupData.clue });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Could not submit answer." });
  }
}

/* ---------- SUBMIT CODE ---------- */
export async function submitCode(req, res) {
  try {
    const { teamId, level, code } = req.body;
    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: "Team not found." });
    if (team.status === "eliminated")
      return res.status(403).json({ message: "You have been eliminated." });

    const lv = await Level.findOne({ number: level });
    if (!lv) return res.status(404).json({ message: "Level not found." });

    // check against this team's group code ONLY
    const correctCode = lv.groups[team.group].secretCode;

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
      await maybeEliminate(team.currentLevel - 1);
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

  const passed = await Team.countDocuments({
    currentLevel: { $gt: completedLevel },
    status: { $ne: "eliminated" },
  });

  if (passed >= target) {
    await Team.updateMany(
      { currentLevel: completedLevel, status: { $ne: "eliminated" } },
      { $set: { status: "eliminated", eliminatedAt: new Date() } }
    );
  }
}

/* ---------- LEADERBOARD ---------- */
export async function getLeaderboard(req, res) {
  try {
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

    return res.json({ teams: ranked, summary });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Could not load leaderboard." });
  }
}