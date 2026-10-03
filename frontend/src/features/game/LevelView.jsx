// frontend/src/features/game/LevelView.jsx
import { useEffect, useState } from "react";

const serverUrl = (import.meta.env.VITE_SERVER_URL || "http://localhost:3000").replace(/\/$/, "");

function formatCountdown(ms) {
  if (ms <= 0) return "00:00";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60).toString().padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function LevelView({ team, levelNumber, onBack }) {
  const [level, setLevel] = useState(null);
  const [clue, setClue] = useState(null);
  const [selected, setSelected] = useState(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [lockUntil, setLockUntil] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch(`${serverUrl}/api/game/level/${levelNumber}?teamId=${team.id}`);
      const json = await res.json();
      setLevel(json);
      setClue(json.clue);
      setLockUntil(json.lockUntil ? new Date(json.lockUntil).getTime() : null);
      setLoading(false);
    })();
  }, [levelNumber, team.id]);

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
      headers: { "Content-Type": "application/json" },
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId: team.id, level: levelNumber, code }),
    });
    const json = await res.json();
    if (!res.ok) return setMessage(json.message || "Wrong code.");
    setMessage("🎉 Level unlocked!");
    setTimeout(onBack, 900);
  }

  if (loading) return <main className="login-page"><p>Loading level…</p></main>;
  if (!level) return <main className="login-page"><p>Could not load level.</p></main>;

  return (
    <main className="level-page">
      <button className="text-button" onClick={onBack}>← Back</button>
      <h1>{level.title}</h1>

      {locked && (
        <div className="lock-banner">
          🔒 Options locked. Try again in <strong>{formatCountdown(lockUntil - now)}</strong>
        </div>
      )}

      {!clue && (
        <section className="level-card-large">
          <h2>{level.mcq.question}</h2>
          <div className="options">
            {level.mcq.options.map((opt, i) => (
              <button
                key={i}
                className={`option ${selected === i ? "selected" : ""}`}
                onClick={() => !locked && setSelected(i)}
                disabled={locked}
              >
                {opt}
              </button>
            ))}
          </div>
          <button className="submit-button" onClick={submitAnswer} disabled={locked}>
            Submit answer <span>→</span>
          </button>
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