// backend/src/controller/auth.controller.js
import { randomUUID } from "node:crypto";
import Team from "../model/user.schema.js";
import {
  createTeamWithBalancedLevelGroups,
  serializeTeamLevelGroups,
} from "../utils/level-groups.js";

const publicTeam = (team) => ({
  id: team._id,
  teamName: team.teamName,
  teamCode: team.teamCode,
  group: team.group,
  levelGroups: serializeTeamLevelGroups(team),
  members: team.members.map((m) => ({ id: m._id, name: m.name })),
  status: team.status,
  currentLevel: team.currentLevel,
  createdAt: team.createdAt,
});

export async function registerTeam(req, res) {
  try {
    const { teamName, teamCode, password, members } = req.body ?? {};

    if (
      typeof teamName !== "string" ||
      typeof teamCode !== "string" ||
      typeof password !== "string" ||
      !Array.isArray(members)
    ) {
      return res.status(400).json({
        message: "teamName, teamCode, password, and members are required.",
      });
    }

    const normalizedMembers = members.map((member) => {
      if (typeof member === "string") return member.trim();
      return typeof member?.name === "string" ? member.name.trim() : "";
    });

    if (normalizedMembers.some((name) => !name)) {
      return res.status(400).json({ message: "Every team member needs a name." });
    }
    if (normalizedMembers.length < 2 || normalizedMembers.length > 5) {
      return res.status(400).json({ message: "A team must have 2 to 5 members." });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters." });
    }

    const team = await createTeamWithBalancedLevelGroups({
      teamName: teamName.trim(),
      teamCode: teamCode.trim().toUpperCase(),
      password,
      members: normalizedMembers.map((name) => ({ name })),
    });

    return res.status(201).json({
      message: "Team registered successfully.",
      team: publicTeam(team),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Team name or team code is already registered." });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    console.error("Team registration failed:", error);
    return res.status(500).json({ message: "Could not register team." });
  }
}

export async function loginTeam(req, res) {
  try {
    const { teamName, password } = req.body ?? {};
    if (typeof teamName !== "string" || typeof password !== "string") {
      return res.status(400).json({ message: "teamName and password are required." });
    }

    const team = await Team.findOne({ teamName: teamName.trim() }).select("+password");
    if (!team || !(await team.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid team name or password." });
    }

    team.activeSessionId = randomUUID();
    team.activeSessionExpiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
    await team.save();

    return res.status(200).json({
      message: "Login successful.",
      sessionId: team.activeSessionId,
      team: publicTeam(team),
    });
  } catch (error) {
    console.error("Team login failed:", error);
    return res.status(500).json({ message: "Could not log in." });
  }
}

export async function logoutTeam(req, res) {
  try {
    req.team.activeSessionId = null;
    req.team.activeSessionExpiresAt = null;
    await req.team.save();
    return res.json({ message: "Signed out successfully." });
  } catch (error) {
    console.error("Team logout failed:", error);
    return res.status(500).json({ message: "Could not sign out." });
  }
}