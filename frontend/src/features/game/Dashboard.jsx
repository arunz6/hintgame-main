// frontend/src/features/game/Dashboard.jsx
import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getTeamSessionHeaders } from "../../app/team-session";
import { serverUrl } from "../../app/api-config";

export default function Dashboard({ team }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sneaky, setSneaky] = useState(null);
  const refreshCalled = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${serverUrl}/api/game/levels/${team.id}`, {
        headers: getTeamSessionHeaders(),
      });
      const json = await res.json();
      if (!res.ok || !json.team || !Array.isArray(json.levels)) {
        setLoadError(json.message || "Could not load team and level data.");
        setData(null);
        return;
      }
      setLoadError("");
      setData(json);
    } catch {
      setLoadError("Could not connect to the game server.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [team.id]);

  // Called ONCE per page load
  useEffect(() => {
    if (refreshCalled.current) return;
    refreshCalled.current = true;
    (async () => {
      try {
        const res = await fetch(`${serverUrl}/api/game/refresh`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getTeamSessionHeaders(),
          },
          body: JSON.stringify({ teamId: team.id }),
        });
        const json = await res.json();
        if (json.applied) {
          setSneaky(json.message);
          setTimeout(() => setSneaky(null), 8000);
        }
      } catch {}
      load();
    })();
  }, [load, team.id]);

  // Poll every 5s (no penalty)
  useEffect(() => {
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  function handleLogout() {
    fetch(`${serverUrl}/api/teams/logout`, {
      method: "POST",
      headers: getTeamSessionHeaders(),
    }).catch((error) => console.error("Could not invalidate team session:", error));
    sessionStorage.removeItem("hintgame.session");
    navigate("/login", { replace: true });
  }

  if (loading) return <main className="login-page"><p>Loading…</p></main>;
  if (loadError) return <main className="login-page"><p>{loadError}</p></main>;
  if (!data) return <main className="login-page"><p>Could not load levels.</p></main>;

  if (data.team?.status === "eliminated") {
    return (
      <main className="login-page">
        <section className="login-panel">
          <h1>You lose 😔</h1>
          <p className="panel-copy">Your team has been eliminated from the Hint Game. Better luck next time.</p>
          <button className="text-button" onClick={handleLogout}>Sign out</button>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-page">
      <header className="dash-header">
        <div>
          <p className="eyebrow">HINTGAME / TEAM DASHBOARD</p>
          <h1>{data.team.teamName}</h1>
          <p className="panel-copy">
            Team code: <strong>{data.team.teamCode}</strong> · Level {data.team.currentLevel}
          </p>
        </div>
        <button className="text-button" onClick={handleLogout}>Sign out</button>
      </header>

      {sneaky && <div className="warning-banner sneaky">{sneaky}</div>}
      {data.warning && <div className="warning-banner">{data.warning}</div>}

      <section className="levels-grid">
        {data.levels?.length ? data.levels.map((lv) => (
          <button
            key={lv.number}
            className={`level-card ${lv.locked ? "locked" : ""} ${lv.completed ? "completed" : ""}`}
            disabled={lv.locked}
            onClick={() => navigate(`/game/level/${lv.number}`)}
          >
            <span className="level-number">0{lv.number}</span>
            <span className="level-title">{lv.title}</span>
            <span className="level-status">
              {lv.completed ? "✅ Completed" : lv.locked ? "🔒 Locked" : "▶ Play"}
            </span>
          </button>
        )) : <p>No levels found. Add level data to the hintgame database.</p>}
      </section>
    </main>
  );
}