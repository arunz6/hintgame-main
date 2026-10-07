// frontend/src/features/game/LevelView.jsx
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getTeamSessionHeaders } from "../../app/team-session";
import { serverUrl } from "../../app/api-config";

function formatCountdown(ms) {
  if (ms <= 0) return "00:00";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60).toString().padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function LevelView({ team, levelNumber, onBack }) {
  const navigate = useNavigate();
  const goBack = onBack || (() => navigate("/dashboard"));
  const [level, setLevel] = useState(null);
  const [clue, setClue] = useState(null);
  const [selected, setSelected] = useState(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [lockUntil, setLockUntil] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [hunt, setHunt] = useState(null);
  const [loadError, setLoadError] = useState("");

  const loadLevel = useCallback(async () => {
    try {
      const res = await fetch(`${serverUrl}/api/game/level/${levelNumber}?teamId=${team.id}`, {
        headers: getTeamSessionHeaders(),
      });
      const json = await res.json();
      if (json.huntNotStarted) {
        setHunt(json.hunt);
        setLevel(null);
        setLoadError("");
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setLoadError(json.message || "Could not load level.");
        setLevel(null);
        setLoading(false);
        return;
      }
      setLevel(json);
      setHunt({ status: "running" });
      setClue(json.clue);
      setLockUntil(json.lockUntil ? new Date(json.lockUntil).getTime() : null);
      setLoadError("");
      setLoading(false);
    } catch {
      setLoadError("Could not connect to the game server.");
      setLoading(false);
    }
  }, [levelNumber, team.id]);

  const checkHuntStatus = useCallback(async () => {
    try {
      const res = await fetch(`${serverUrl}/api/game/levels/${team.id}`, {
        headers: getTeamSessionHeaders(),
      });
      const json = await res.json();
      if (res.ok && json.hunt?.status) {
        setHunt(json.hunt);
        if (json.hunt.status === "running") {
          setLoadError("");
          await loadLevel();
        } else {
          setLevel(null);
        }
      }
    } catch (error) {
      console.error("Could not refresh hunt status:", error);
    }
  }, [loadLevel, team.id]);

  useEffect(() => {
    loadLevel();
  }, [loadLevel]);

  useEffect(() => {
    if (hunt?.status === "running") return undefined;
    const id = setInterval(
      hunt?.status === "ended" ? checkHuntStatus : loadLevel,
      hunt?.status === "ended" ? 3000 : 1000,
    );
    return () => clearInterval(id);
  }, [hunt?.status, checkHuntStatus, loadLevel]);

  useEffect(() => {
    if (hunt?.status !== "running") return undefined;
    const id = setInterval(checkHuntStatus, 3000);
    return () => clearInterval(id);
  }, [hunt?.status, checkHuntStatus]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const locked = lockUntil && lockUntil > now;

  async function submitAnswer() {
    if (selected === null || locked) return;
    setMessage("");
    const res = await fetch(`${serverUrl}/api/game/answer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getTeamSessionHeaders(),
      },
      body: JSON.stringify({ teamId: team.id, level: levelNumber, answerIndex: selected }),
    });
    const json = await res.json();
    if (!res.ok) {
      if (json.lockUntil) setLockUntil(new Date(json.lockUntil).getTime());
      return setMessage(json.message || "Wrong.");
    }
    setClue(json.clue);
    setMessage("✅ Correct! Here's your clue:");
  }

  async function submitCode() {
    setMessage("");
    const res = await fetch(`${serverUrl}/api/game/unlock`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getTeamSessionHeaders(),
      },
      body: JSON.stringify({ teamId: team.id, level: levelNumber, code }),
    });
    const json = await res.json();
    if (!res.ok) return setMessage(json.message || "Wrong code.");
    setMessage("🎉 Level unlocked!");
    setTimeout(goBack, 900);
  }

  if (loading) return <main className="login-page"><p>Loading level…</p></main>;
  if (loadError) return <main className="login-page"><p>{loadError}</p></main>;
  if (hunt?.status !== "running") {
    const seconds = hunt?.startsAt
      ? Math.max(0, Math.ceil((new Date(hunt.startsAt).getTime() - now) / 1000))
      : null;
    return (
      <main className="login-page">
        <section className="login-panel" aria-live="polite">
          <p className="eyebrow">HINTGAME / {hunt?.status === "ended" ? "GAME ENDED" : "GET READY"}</p>
          <h1>
            {hunt?.status === "countdown"
              ? "The game is starting!"
              : hunt?.status === "ended"
                ? "Game ended"
                : "Waiting for the hunt to start"}
          </h1>
          <p className="panel-copy">
            {hunt?.status === "ended"
              ? "The administrator ended the game. Your team progress and results have been preserved."
              : seconds === null
              ? "The administrator will start the hunt shortly."
              : `Your game starts in ${seconds} seconds. Stay on this page.`}
          </p>
        </section>
      </main>
    );
  }
  if (!level) return <main className="login-page"><p>Could not load level.</p></main>;

  return (
    <main className="level-page">
      <header className="level-heading">
        <button className="text-button level-back-button" onClick={goBack}>← Back</button>
        <h1>{level.title}</h1>
        <span className="level-heading-rule" aria-hidden="true">
          <span>◎</span>
        </span>
      </header>

      {locked && (
        <div className="lock-banner">
          🔒 Options locked. Try again in <strong>{formatCountdown(lockUntil - now)}</strong>
        </div>
      )}

      {!clue && (
        <section className="level-card-large level-question-card">
          <h2 id="level-question">{level.mcq.question}</h2>
          <fieldset className="options" aria-labelledby="level-question" disabled={Boolean(locked)}>
            <legend className="visually-hidden">{level.mcq.question}</legend>
            {level.mcq.options.map((opt, i) => (
              <label
                key={i}
                className={`option ${selected === i ? "selected" : ""}`}
              >
                <span className="option-marker" aria-hidden="true">{String.fromCharCode(65 + i)}</span>
                <span className="option-copy">{opt}</span>
                <input
                  className="option-radio"
                  type="radio"
                  name="level-answer"
                  value={i}
                  checked={selected === i}
                  onChange={() => setSelected(i)}
                />
              </label>
            ))}
          </fieldset>
          <div className="level-actions">
            <button className="submit-button" onClick={submitAnswer} disabled={locked || selected === null}>
              Submit answer <span>→</span>
            </button>
          </div>
        </section>
      )}

      {clue && (
        <section className="level-card-large">
          <p className="eyebrow">🔎 CLUE</p>
          <p className="clue-text">{clue}</p>
          <label>Enter the unique code you found:</label>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. LIB123" />
          <button className="submit-button" onClick={submitCode}>
            Unlock next level <span>→</span>
          </button>
        </section>
      )}

      {message && <p className="login-error">{message}</p>}
    </main>
  );
}