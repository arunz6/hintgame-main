// frontend/src/features/game/LevelView.jsx
import { useCallback, useEffect, useRef, useState } from "react";
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
  const [answerCorrect, setAnswerCorrect] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [lockUntil, setLockUntil] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [hunt, setHunt] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [teamEliminated, setTeamEliminated] = useState(false);
  const teamEliminatedRef = useRef(false);
  const levelRequestInProgress = useRef(false);

  const loadLevel = useCallback(async () => {
    if (levelRequestInProgress.current || teamEliminatedRef.current) return;
    levelRequestInProgress.current = true;

    try {
      const res = await fetch(`${serverUrl}/api/game/level/${levelNumber}?teamId=${team.id}`, {
        headers: getTeamSessionHeaders(),
      });
      const json = await res.json();
      if (teamEliminatedRef.current) return;

      if (json.huntNotStarted) {
        setHunt(json.hunt);
        setLevel(null);
        setLoadError("");
        setLoading(false);
        return;
      }
      if (!res.ok) {
        if (json.message === "You have been eliminated.") {
          teamEliminatedRef.current = true;
          setTeamEliminated(true);
        }
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
      if (teamEliminatedRef.current) return;
      setLoadError("Could not connect to the game server.");
      setLoading(false);
    } finally {
      levelRequestInProgress.current = false;
    }
  }, [levelNumber, team.id]);

  const checkHuntStatus = useCallback(async () => {
    try {
      const res = await fetch(`${serverUrl}/api/game/levels/${team.id}`, {
        headers: getTeamSessionHeaders(),
      });
      const json = await res.json();
      if (teamEliminatedRef.current) return;

      if (res.ok && json.hunt?.status) {
        if (json.team?.status === "eliminated") {
          teamEliminatedRef.current = true;
          setTeamEliminated(true);
          setLoadError("You have been eliminated.");
          setLevel(null);
          setLoading(false);
          return;
        }

        if (json.hunt.status === "running") {
          await loadLevel();
        } else {
          setHunt(json.hunt);
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
    if (teamEliminated) return undefined;
    if (hunt?.status === "running") return undefined;
    const id = setInterval(
      hunt?.status === "ended" ? checkHuntStatus : loadLevel,
      hunt?.status === "ended" ? 3000 : 1000,
    );
    return () => clearInterval(id);
  }, [hunt?.status, checkHuntStatus, loadLevel, teamEliminated]);

  useEffect(() => {
    if (teamEliminated) return undefined;
    if (hunt?.status !== "running") return undefined;
    const id = setInterval(checkHuntStatus, 3000);
    return () => clearInterval(id);
  }, [hunt?.status, checkHuntStatus, teamEliminated]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const locked = lockUntil && lockUntil > now;

  async function submitAnswer() {
    if (selected === null || locked) return;
    setMessage("");
    setMessageType("");
    setAnswerCorrect(false);
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
      setMessageType("error");
      return setMessage(json.message || "Wrong.");
    }
    setClue(json.clue);
    setAnswerCorrect(true);
  }

  async function submitCode() {
    setMessage("");
    setMessageType("");
    const res = await fetch(`${serverUrl}/api/game/unlock`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getTeamSessionHeaders(),
      },
      body: JSON.stringify({ teamId: team.id, level: levelNumber, code }),
    });
    const json = await res.json();
    if (!res.ok) {
      setMessageType("error");
      return setMessage(json.message || "Wrong code.");
    }
    setMessageType("success");
    setMessage("🎉 Level unlocked!");
    setTimeout(goBack, 900);
  }

  if (teamEliminated) return <main className="login-page player-state-page"><section className="login-panel player-state-panel"><p className="eyebrow">HINTGAME / EXPEDITION STATUS</p><h1>Team eliminated</h1><p className="panel-copy">Your team has been eliminated from the game.</p><button className="text-button player-state-action" onClick={goBack}>Return to dashboard</button></section></main>;
  if (loading) return <main className="login-page player-state-page"><section className="login-panel player-state-panel"><p className="eyebrow">HINTGAME / LEVEL {levelNumber}</p><h1>Loading your level…</h1></section></main>;
  if (loadError) return <main className="login-page player-state-page"><section className="login-panel player-state-panel"><p className="eyebrow">CONNECTION STATUS</p><h1>Unable to load this level</h1><p className="panel-copy">{loadError}</p><button className="text-button player-state-action" onClick={goBack}>Return to levels</button></section></main>;
  if (hunt?.status !== "running") {
    const seconds = hunt?.startsAt
      ? Math.max(0, Math.ceil((new Date(hunt.startsAt).getTime() - now) / 1000))
      : null;
    return (
      <main className="login-page player-state-page">
        <section className="login-panel player-state-panel" aria-live="polite">
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
  if (!level) return <main className="login-page player-state-page"><section className="login-panel player-state-panel"><p className="eyebrow">HINTGAME / LEVEL {levelNumber}</p><h1>Could not load level</h1><p className="panel-copy">Please return to the dashboard and try again.</p></section></main>;

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
        <section className="level-card-large level-clue-card" aria-labelledby="clue-heading">
          <div className="clue-card-heading">
            <p className="eyebrow" id="clue-heading"><span aria-hidden="true">✦</span> CLUE REVEALED</p>
            <span className="clue-stage">LEVEL {levelNumber}</span>
          </div>

          <div className="clue-display" aria-live="polite">
            <p className="clue-text">{clue}</p>
          </div>

          {answerCorrect && (
            <p className="clue-feedback is-success" role="status">
              ✅ Correct! Here's your clue:
            </p>
          )}

          <div className="clue-entry">
            <label htmlFor="level-code">
              <span aria-hidden="true">⚿</span> Enter the unique code you found
            </label>
            <div className="clue-code-row">
              <input
                id="level-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. LIB123"
                autoComplete="off"
                spellCheck="false"
              />
              <button className="submit-button" onClick={submitCode}>
                Unlock next level <span>→</span>
              </button>
            </div>
          </div>

          {message && (
            <p className={`clue-feedback ${messageType === "error" ? "is-error" : "is-success"}`}
              role={messageType === "error" ? "alert" : "status"}>
              {message}
            </p>
          )}
        </section>
      )}

      {!clue && message && <p className="login-error">{message}</p>}
    </main>
  );
}