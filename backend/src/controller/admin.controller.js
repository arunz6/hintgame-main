// backend/src/controller/admin.controller.js
import Team from "../model/user.schema.js";

const MAX_MEMBERS = 6;

function checkKey(req, res) {
  const key = req.headers["x-admin-key"] || req.body?.adminKey;
  if (key !== process.env.ADMIN_KEY) {
    res.status(401).json({ message: "Invalid admin key." });
    return false;
  }
  return true;
}

/* ---------- OVERVIEW ---------- */
export async function overview(req, res) {
  if (!checkKey(req, res)) return;
  try {
    const teams = await Team.find().sort({ currentLevel: -1, startedAt: 1 });
    const now = new Date();
    const data = teams.map((t) => ({
      id: t._id,
      teamName: t.teamName,
      teamCode: t.teamCode,
      group: t.group,
      members: t.members.map((m) => ({ id: m._id, name: m.name })),
      currentLevel: t.currentLevel,
      status: t.status,
      lockUntil: t.lockUntil,
      lockedNow: t.lockUntil && t.lockUntil > now,
      finalRank: t.finalRank,
      wrongAttempts: t.wrongAttempts,
      createdAt: t.createdAt,
    }));
    return res.json({ teams: data, maxMembers: MAX_MEMBERS });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Could not load overview." });
  }
}

/* ---------- ADD TEAM ---------- */
export async function addTeam(req, res) {
  if (!checkKey(req, res)) return;
  try {
    const { teamName, teamCode, password, members, group } = req.body;

    if (!teamName || !teamCode || !password)
      return res.status(400).json({ message: "teamName, teamCode, password are required." });
    if (!["A", "B", "C"].includes(group))
      return res.status(400).json({ message: "Group must be A, B, or C." });

    const normalizedMembers = Array.isArray(members)
      ? members.map((m) => String(m).trim()).filter(Boolean)
      : [];

    if (normalizedMembers.length < 5 || normalizedMembers.length > MAX_MEMBERS)
      return res.status(400).json({ message: `A team must have 5 to ${MAX_MEMBERS} members.` });

    const team = await Team.create({
      teamName: teamName.trim(),
      teamCode: teamCode.trim().toUpperCase(),
      password,
      group,
      members: normalizedMembers.map((name) => ({ name })),
    });

    return res.status(201).json({
      message: "Team added.",
      team: { id: team._id, teamName: team.teamName, teamCode: team.teamCode, group: team.group },
    });
  } catch (e) {
    if (e.code === 11000)
      return res.status(409).json({ message: "Team name/code already exists." });
    if (e.name === "ValidationError")
      return res.status(400).json({ message: e.message });
    console.error(e);
    return res.status(500).json({ message: "Could not add team." });
  }
}

/* ---------- DELETE TEAM ---------- */
export async function deleteTeam(req, res) {
  if (!checkKey(req, res)) return;
  try {
    const { teamId } = req.body;
    await Team.findByIdAndDelete(teamId);
    return res.json({ message: "Team deleted." });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Could not delete team." });
  }
}

/* ---------- UPDATE TEAM ---------- */
export async function updateTeam(req, res) {
  if (!checkKey(req, res)) return;
  try {
    const { teamId, teamName, teamCode, group } = req.body;
    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: "Team not found." });

    if (teamName) team.teamName = teamName.trim();
    if (teamCode) team.teamCode = teamCode.trim().toUpperCase();
    if (group) {
      if (!["A", "B", "C"].includes(group))
        return res.status(400).json({ message: "Group must be A, B, or C." });
      team.group = group;
    }

    await team.save();
    return res.json({ message: "Team updated." });
  } catch (e) {
    if (e.code === 11000)
      return res.status(409).json({ message: "Team name/code already exists." });
    console.error(e);
    return res.status(500).json({ message: "Could not update team." });
  }
}

/* ---------- RESET PASSWORD ---------- */
export async function resetPassword(req, res) {
  if (!checkKey(req, res)) return;
  try {
    const { teamId, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ message: "Password must be at least 6 characters." });

    const team = await Team.findById(teamId).select("+password");
    if (!team) return res.status(404).json({ message: "Team not found." });

    team.password = newPassword;
    await team.save();
    return res.json({ message: "Password reset successfully." });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Could not reset password." });
  }
}

/* ---------- MEMBER: UPDATE ---------- */
export async function updateMember(req, res) {
  if (!checkKey(req, res)) return;
  try {
    const { teamId, memberId, name } = req.body;
    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: "Team not found." });
    const member = team.members.id(memberId);
    if (!member) return res.status(404).json({ message: "Member not found." });
    member.name = name.trim();
    await team.save();
    return res.json({ message: "Member updated." });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Could not update member." });
  }
}

/* ---------- MEMBER: ADD ---------- */
export async function addMember(req, res) {
  if (!checkKey(req, res)) return;
  try {
    const { teamId, name } = req.body;
    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: "Team not found." });
    if (team.members.length >= MAX_MEMBERS)
      return res.status(400).json({ message: `Team already has max ${MAX_MEMBERS} members.` });
    team.members.push({ name: name.trim() });
    await team.save();
    return res.json({ message: "Member added." });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Could not add member." });
  }
}

/* ---------- MEMBER: DELETE ---------- */
export async function deleteMember(req, res) {
  if (!checkKey(req, res)) return;
  try {
    const { teamId, memberId } = req.body;
    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: "Team not found." });
    if (team.members.length <= 1)
      return res.status(400).json({ message: "Team must have at least 1 member." });
    const member = team.members.id(memberId);
    if (!member) return res.status(404).json({ message: "Member not found." });
    member.deleteOne();
    await team.save();
    return res.json({ message: "Member deleted." });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Could not delete member." });
  }
}

/* ---------- DISQUALIFY ---------- */
export async function disqualify(req, res) {
  if (!checkKey(req, res)) return;
  try {
    const { teamId } = req.body;
    await Team.findByIdAndUpdate(teamId, {
      status: "eliminated",
      eliminatedAt: new Date(),
    });
    return res.json({ message: "Team disqualified." });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Could not disqualify." });
  }
}

/* ---------- RESET LOCK ---------- */
export async function resetLock(req, res) {
  if (!checkKey(req, res)) return;
  try {
    const { teamId } = req.body;
    await Team.findByIdAndUpdate(teamId, { lockUntil: null, wrongAttempts: 0 });
    return res.json({ message: "Lock cleared." });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Could not reset lock." });
  }
}