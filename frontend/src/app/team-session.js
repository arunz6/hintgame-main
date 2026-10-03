const SESSION_KEY = "hintgame.session";

export function getTeamSessionHeaders() {
  try {
    const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    const teamId = session?.team?.id || session?.team?._id;
    if (!teamId || !session?.sessionId) return {};
    return {
      "x-team-id": teamId,
      "x-team-session": session.sessionId,
    };
  } catch {
    return {};
  }
}
