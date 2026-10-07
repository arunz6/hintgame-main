// frontend/src/features/auth/Login.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { serverUrl } from "../../app/api-config";

const SESSION_KEY = "hintgame.session";

function readSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function Login() {
  const navigate = useNavigate();
  const [session, setSession] = useState(readSession);
  const [teamName, setTeamName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`${serverUrl}/api/teams/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ teamName: teamName.trim(), password }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Could not sign in. Please try again.");
      }

      sessionStorage.setItem(SESSION_KEY, JSON.stringify(result));
      setSession(result);
      navigate("/dashboard", { replace: true });
    } catch (requestError) {
      setError(
        requestError instanceof TypeError
          ? "Can't reach the server. Check your connection and try again."
          : requestError.message,
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSignOut() {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
    setPassword("");
  }

  return (
    <main className="login-page final-clue-page">
      <div className="final-clue-shell">
        <header className="final-clue-header">
          <div className="final-clue-starline" aria-hidden="true">
            <span />
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2 14.2 9.8 22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2L12 2Z" />
            </svg>
            <span />
          </div>
          <h1>THE FINAL CLUE</h1>
          <div className="final-clue-rule" aria-hidden="true"><span /></div>
        </header>

        <section
          className="login-panel final-clue-card"
          aria-labelledby={session?.team ? "welcome-title" : "login-title"}
        >
          <span className="final-clue-corner corner-top-left" aria-hidden="true" />
          <span className="final-clue-corner corner-top-right" aria-hidden="true" />
          <span className="final-clue-corner corner-bottom-left" aria-hidden="true" />
          <span className="final-clue-corner corner-bottom-right" aria-hidden="true" />
          <svg className="final-clue-compass" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="45" />
            <path d="M50 5 55 45 95 50 55 55 50 95 45 55 5 50 45 45Z" />
          </svg>

          {session?.team ? (
            <div className="final-clue-content">
              <p className="eyebrow final-clue-eyebrow">ACCESS CONFIRMED</p>
              <h2 id="welcome-title">You're in.</h2>
              <p className="panel-copy">
                Signed in as <strong>{session.team.teamName}</strong>.
              </p>
              <div className="team-status final-clue-status">
                <span>Current level</span>
                <strong>{session.team.currentLevel ?? 1}</strong>
              </div>
              <button className="final-clue-signout" type="button" onClick={handleSignOut}>
                Sign out
              </button>
            </div>
          ) : (
            <div className="final-clue-content">
              <div className="final-clue-card-heading">
                <p className="eyebrow final-clue-eyebrow">HINTGAME / TEAM ACCESS</p>
                <h2 id="login-title">Ready to play?</h2>
                <p>Sign in with your team details to continue.</p>
              </div>

              <form className="login-form final-clue-form" onSubmit={handleSubmit}>
                <div className="final-clue-field">
                  <label htmlFor="team-name">Team name</label>
                  <div className="final-clue-input-wrap">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 18c3 1.5 5 1.5 9 0s6-1.5 9 0M5 16l1.5-7h11L19 16M12 3v6m0-5c2.5 0 4 1.5 4 3h-4M8 6c1.5 0 3 1 4 2" />
                    </svg>
                    <input
                      id="team-name"
                      name="teamName"
                      type="text"
                      autoComplete="username"
                      placeholder="Enter your team name"
                      value={teamName}
                      onChange={(event) => setTeamName(event.target.value)}
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="final-clue-field">
                  <label htmlFor="team-password">Password</label>
                  <div className="final-clue-input-wrap">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <rect x="4" y="10" width="16" height="11" rx="2" />
                      <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3" />
                    </svg>
                    <input
                      id="team-password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                {error && <p className="login-error" role="alert">{error}</p>}

                <button className="submit-button final-clue-submit" type="submit" disabled={isSubmitting}>
                  <span>{isSubmitting ? "Signing in..." : "Sign in"}</span>
                  <span className="final-clue-submit-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 3 2 6 5 1-5 2-2 5-2-5-5-2 5-1 2-6Z" />
                    </svg>
                    <span>→</span>
                  </span>
                </button>
              </form>

              <footer className="final-clue-footer">
                <p>
                  <span aria-hidden="true">✦</span>
                  Your team progress stays together
                </p>
                <p>
                  <span aria-hidden="true">◉</span>
                  Team access is available only to invited teams.
                </p>
              </footer>
            </div>
          )}
        </section>

        <p className="final-clue-caption">
          <span aria-hidden="true">•</span>
          EXPEDITION ACCESS PORTAL
          <span aria-hidden="true">•</span>
        </p>
      </div>
    </main>
  );
}

export default Login;