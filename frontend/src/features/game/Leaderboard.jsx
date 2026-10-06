// frontend/src/features/game/Leaderboard.jsx
import { useEffect, useState } from "react";
import { serverUrl } from "../../app/api-config";

function medalEmoji(rank) {
  if (rank === "gold") return "🥇";
  if (rank === "silver") return "🥈";
  if (rank === "bronze") return "🥉";
  return null;
}

function formatTimeLeft(ms) {
  if (ms <= 0) return "00:00";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60).toString().padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function Leaderboard() {
  const [teams, setTeams] = useState([]);
  const [summary, setSummary] = useState(null);
  const [hunt, setHunt] = useState({ status: "setup" });
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  async function load() {
    const res = await fetch(`${serverUrl}/api/game/leaderboard`);
    const json = await res.json();
    setTeams(json.teams || []);
    setSummary(json.summary || null);
    setHunt(json.hunt || { status: "setup" });
    setLoading(false);
  }

  useEffect(() => {
    load();
    const poll = setInterval(
      load,
      hunt.status === "running" ? 5000 : hunt.status === "countdown" ? 1000 : 2000,
    );
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [hunt.status]);

  if (loading) return <main className="login-page"><p>Loading live view…</p></main>;

  return (
    <main className="dashboard-page spectator-page">
      <header className="dash-header">
        <div>
          <p className="eyebrow">
            <span className="live-dot" /> HINTGAME / LIVE
          </p>
          <h1>Spectator Arena</h1>
          <p className="panel-copy">
            Watch every team battle through the levels in real time.
          </p>
        </div>
      </header>

      {hunt.status !== "running" && (
        <section className="level-card-large" aria-live="polite">
          <p className="eyebrow">HUNT STATUS</p>
          <h2>
            {hunt.status === "countdown"
              ? "The game is starting!"
              : hunt.status === "ended"
                ? "Game ended"
                : "Waiting for the hunt to start"}
          </h2>
          <p className="panel-copy">
            {hunt.status === "ended"
              ? "Gameplay has stopped. Team results are preserved."
              : hunt.status === "countdown" && hunt.startsAt
              ? `The game starts in ${Math.max(0, Math.ceil((new Date(hunt.startsAt).getTime() - now) / 1000))} seconds.`
              : "The administrator will start the hunt shortly."}
          </p>
        </section>
      )}

      {summary && (
        <section className="spectator-stats">
          <div className="stat-card">
            <span className="stat-value">{summary.total}</span>
            <span className="stat-label">Teams</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{summary.playing}</span>
            <span className="stat-label">Playing</span>
          </div>
          <div className="stat-card">
            <span className="stat-value locked">{summary.locked}</span>
            <span className="stat-label">Locked</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{summary.finished}</span>
            <span className="stat-label">Finished</span>
          </div>
          <div className="stat-card">
            <span className="stat-value eliminated">{summary.eliminated}</span>
            <span className="stat-label">Eliminated</span>
          </div>
        </section>
      )}

      <section className="leaderboard-table-wrap">
        <table className="lb-table big">
          <thead>
            <tr>
              <th>#</th>
              <th>Team</th>
              <th>Members</th>
              <th>Level</th>
              <th>Status</th>
              <th>Locked</th>
              <th>Medal</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => {
              const medal = medalEmoji(t.finalRank);
              const lockedTimeLeft = t.lockedNow
                ? new Date(t.lockUntil).getTime() - now
                : 0;
              const rowClass = [
                t.status === "eliminated" ? "elim" : "",
                t.finalRank ? "medal-row" : "",
                t.lockedNow ? "locked-row" : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <tr key={t.teamCode} className={rowClass}>
                  <td className="rank-cell">
                    {t.rank === 1 ? "🥇" : t.rank === 2 ? "🥈" : t.rank === 3 ? "🥉" : t.rank}
                  </td>
                  <td>
                    <strong>{t.teamName}</strong>
                    <span className="team-code-badge small">{t.teamCode}</span>
                  </td>
                  <td className="members-cell">
                    {t.members.join(", ")}
                  </td>
                  <td>
                    <span className="level-chip">Lv {t.currentLevel}</span>
                  </td>
                  <td>
                    <span className={`status-chip status-${t.status}`}>
                      {t.status === "playing" && "▶ Playing"}
                      {t.status === "finished" && "🏁 Finished"}
                      {t.status === "eliminated" && "✕ Eliminated"}
                      {t.status === "not_started" && "· Not started"}
                    </span>
                  </td>
                  <td>
                    {t.lockedNow ? (
                      <span className="lock-chip">
                        🔒 {formatTimeLeft(lockedTimeLeft)}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="medal-cell">
                    {medal ? (
                      <span className="medal-big">{medal}</span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {teams.length === 0 && (
          <p className="panel-copy" style={{ textAlign: "center", padding: 24 }}>
            No teams yet. Waiting for the game to begin…
          </p>
        )}
      </section>

      <footer className="spectator-footer">
        <span className="live-dot" /> Auto-updating every 5 seconds
      </footer>
    </main>
  );
}