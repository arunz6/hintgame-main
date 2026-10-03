import Team from "../model/user.schema.js";

export async function requireTeamSession(req, res, next) {
  const teamId = req.get("x-team-id");
  const sessionId = req.get("x-team-session");
  if (!teamId || !sessionId) {
    return res.status(401).json({ message: "Sign in to access this game feature." });
  }

  const requestedTeamId = req.params.teamId || req.body?.teamId || req.query?.teamId;
  if (requestedTeamId && requestedTeamId !== teamId) {
    return res.status(403).json({ message: "You cannot access another team's game data." });
  }

  try {
    const team = await Team.findOne({
      _id: teamId,
      activeSessionId: sessionId,
      activeSessionExpiresAt: { $gt: new Date() },
    });
    if (!team) {
      return res.status(401).json({ message: "Your session is invalid. Sign in again." });
    }
    req.team = team;
    return next();
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(401).json({ message: "Your session is invalid. Sign in again." });
    }
    return next(error);
  }
}
