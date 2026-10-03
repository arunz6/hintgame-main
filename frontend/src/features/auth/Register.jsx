import { useState } from "react";
import { Link } from "react-router-dom";

const serverUrl = (
  import.meta.env.VITE_SERVER_URL || "http://localhost:3000"
).replace(/\/$/, "");

function Register() {
  const [teamName, setTeamName] = useState("");
  const [teamCode, setTeamCode] = useState("");
  const [password, setPassword] = useState("");
  const [members, setMembers] = useState(["", ""]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredTeam, setRegisteredTeam] = useState("");

  function updateMember(index, value) {
    setMembers((currentMembers) =>
      currentMembers.map((member, memberIndex) =>
        memberIndex === index ? value : member,
      ),
    );
  }

  function addMember() {
    setMembers((currentMembers) =>
      currentMembers.length < 5 ? [...currentMembers, ""] : currentMembers,
    );
  }

  function removeMember(index) {
    setMembers((currentMembers) =>
      currentMembers.length > 2
        ? currentMembers.filter((_, memberIndex) => memberIndex !== index)
        : currentMembers,
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (members.length < 2 || members.length > 5) {
      setError("A team must have 2 to 5 members.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${serverUrl}/api/teams/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          teamName: teamName.trim(),
          teamCode: teamCode.trim().toUpperCase(),
          password,
          members: members.map((name) => name.trim()),
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Could not create your team.");
      }

      setRegisteredTeam(result.team?.teamName || teamName.trim());
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

  if (registeredTeam) {
    return (
      <main className="login-page">
        <section className="login-panel" aria-labelledby="registered-title">
          <div className="brand-mark" aria-hidden="true">
            H
          </div>
          <p className="eyebrow">HINTGAME / TEAM ACCESS</p>
          <h1 id="registered-title">Team created.</h1>
          <p className="panel-copy">
            <strong>{registeredTeam}</strong> is ready. Sign in to continue.
          </p>
          <Link className="submit-button link-button" to="/login">
            Go to sign in <span aria-hidden="true">→</span>
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="login-page register-page">
      <section
        className="login-panel register-panel"
        aria-labelledby="register-title"
      >
        <div className="brand-mark" aria-hidden="true">
          H
        </div>
        <p className="eyebrow">HINTGAME / TEAM ACCESS</p>
        <h1 id="register-title">Create your team</h1>
        <p className="panel-copy">
          Add your team details and players to get started.
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="register-team-name">Team name</label>
          <input
            id="register-team-name"
            name="teamName"
            type="text"
            autoComplete="organization"
            placeholder="e.g. The Bright Sparks"
            value={teamName}
            onChange={(event) => setTeamName(event.target.value)}
            required
            disabled={isSubmitting}
          />

          <label htmlFor="register-team-code">Team code</label>
          <input
            id="register-team-code"
            name="teamCode"
            type="text"
            autoComplete="off"
            placeholder="Create a unique team code"
            value={teamCode}
            onChange={(event) => setTeamCode(event.target.value.toUpperCase())}
            required
            disabled={isSubmitting}
          />

          <label htmlFor="register-password">Password</label>
          <input
            id="register-password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            disabled={isSubmitting}
          />

          <div className="members-heading">
            <span>Team members</span>
            <span className="member-count">{members.length} / 5 members (minimum 2)</span>
          </div>
          <div className="member-fields">
            {members.map((member, index) => (
              <div className="member-row" key={index}>
                <label className="visually-hidden" htmlFor={`member-${index}`}>
                  Member {index + 1} name
                </label>
                <input
                  id={`member-${index}`}
                  name={`member-${index + 1}`}
                  type="text"
                  autoComplete="off"
                  placeholder={`Member ${index + 1} name`}
                  value={member}
                  onChange={(event) => updateMember(index, event.target.value)}
                  required
                  disabled={isSubmitting}
                />
                {members.length > 2 && (
                  <button
                    className="remove-member"
                    type="button"
                    aria-label={`Remove member ${index + 1}`}
                    onClick={() => removeMember(index)}
                    disabled={isSubmitting}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          {members.length < 5 && (
            <button
              className="add-member"
              type="button"
              onClick={addMember}
              disabled={isSubmitting}
            >
              + Add another member
            </button>
          )}

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <button
            className="submit-button"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating team..." : "Create team"}
            <span aria-hidden="true">→</span>
          </button>
        </form>

        <p className="auth-switch">
          Already have a team? <Link to="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}

export default Register;
