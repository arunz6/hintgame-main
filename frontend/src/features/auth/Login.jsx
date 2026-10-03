// frontend/src/features/auth/Login.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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

  if (session?.team) {
    return (
      <main className="login-page">
        <section className="login-panel signed-in-panel" aria-labelledby="welcome-title">
          <div className="brand-mark" aria-hidden="true">H</div>
          <p className="eyebrow">HINTGAME / TEAM ACCESS</p>
          <h1 id="welcome-title">You're in.</h1>
          <p className="panel-copy">
            Signed in as <strong>{session.team.teamName}</strong>.
          </p>
          <div className="team-status">
            <span>Current level</span>
            <strong>{session.team.currentLevel ?? 1}</strong>
          </div>
          <button className="text-button" type="button" onClick={handleSignOut}>
            Sign out
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="brand-mark" aria-hidden="true">H</div>
        <p className="eyebrow">HINTGAME / TEAM ACCESS</p>
        <h1 id="login-title">Ready to play?</h1>
        <p className="panel-copy">Sign in with your team details to continue.</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="team-name">Team name</label>
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

          <label htmlFor="team-password">Password</label>
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

          {error && <p className="login-error" role="alert">{error}</p>}

          <button className="submit-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
            <span aria-hidden="true">→</span>
          </button>
        </form>

        <p className="secure-note">
          <span aria-hidden="true">●</span> Your team progress stays together
        </p>
        <p className="auth-switch">
          Need a team? <Link to="/register">Create one</Link>
        </p>
      </section>
    </main>
  );
}

export default Login;