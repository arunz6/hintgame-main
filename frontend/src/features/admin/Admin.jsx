// frontend/src/features/admin/Admin.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { serverUrl } from "../../app/api-config";

const MIN_MEMBERS = 2;
const MAX_MEMBERS = 5;
const GROUPS = ["A", "B", "C", "D"];
const canEditSetup = (status) => status === "setup" || status === "ended";

function EditableField({ label, value, onSave }) {
  const [draft, setDraft] = useState(value);
  const changed = draft !== value;
  useEffect(() => setDraft(value), [value]);

  return (
    <div className="edit-field">
      {label && <label>{label}</label>}
      <div className="edit-row">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button className="ok-button" disabled={!changed} onClick={() => onSave(draft)}>
          OK
        </button>
      </div>
    </div>
  );
}

function EditableGroup({ value, onSave }) {
  const [draft, setDraft] = useState(value);
  const changed = draft !== value;
  useEffect(() => setDraft(value), [value]);

  return (
    <div className="edit-field">
      <label>Group</label>
      <div className="edit-row">
        <select value={draft} onChange={(e) => setDraft(e.target.value)}>
          {GROUPS.map((g) => (
            <option key={g} value={g}>Group {g}</option>
          ))}
        </select>
        <button className="ok-button" disabled={!changed} onClick={() => onSave(draft)}>
          OK
        </button>
      </div>
    </div>
  );
}

function MemberRow({ teamId, member, onSave, onDelete, canDelete }) {
  const [draft, setDraft] = useState(member.name);
  const changed = draft.trim() && draft !== member.name;
  useEffect(() => setDraft(member.name), [member.name]);

  return (
    <div className="member-row-admin">
      <input value={draft} onChange={(e) => setDraft(e.target.value)} />
      <button
        className="ok-button"
        disabled={!changed}
        onClick={() => onSave(teamId, member.id, draft.trim())}
      >
        OK
      </button>
      <button
        className="text-button danger"
        onClick={() => onDelete(teamId, member.id, member.name)}
        disabled={!canDelete}
        title={canDelete ? "Remove member" : `A team must keep at least ${MIN_MEMBERS} members`}
      >
        ✕
      </button>
    </div>
  );
}

export default function Admin() {
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [teams, setTeams] = useState([]);
  const [levelDocs, setLevelDocs] = useState([]);
  const [setStatuses, setSetStatuses] = useState([]);
  const [hunt, setHunt] = useState({ status: "setup", startedAt: null });
  const [readinessProblems, setReadinessProblems] = useState([]);
  const [startingHunt, setStartingHunt] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [selectedSet, setSelectedSet] = useState("A");
  const [setDrafts, setSetDrafts] = useState([]);
  const [levelMessage, setLevelMessage] = useState("");
  const [levelSaveFailed, setLevelSaveFailed] = useState(false);
  const [savingLevel, setSavingLevel] = useState(false);
  const [finalizingSet, setFinalizingSet] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState({});
  const [newTeam, setNewTeam] = useState({
    teamName: "",
    teamCode: "",
    password: "",
    group: "A",
    members: ["", ""],
  });

  async function api(path, body) {
    let res;
    try {
      res = await fetch(`${serverUrl}${path}`, {
        method: body !== undefined ? "POST" : "GET",
        headers: { "Content-Type": "application/json", "x-admin-key": key },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (requestError) {
      if (requestError instanceof TypeError) {
        throw new Error(`Cannot reach the backend at ${serverUrl}. Check that it is running and connected to MongoDB.`);
      }
      throw requestError;
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.message || `Request failed (${res.status}).`);
    return json;
  }

  async function load(includeLevels = false) {
    try {
      const overview = await api("/api/admin/overview");
      setTeams(overview.teams);
      setHunt(overview.hunt || { status: "setup", startedAt: null });
      setReadinessProblems(overview.readinessProblems || []);
      if (includeLevels) {
        const levelData = await api("/api/admin/levels");
        setLevelDocs(levelData.levels);
        setSetStatuses(levelData.setStatuses);
      }
      setAuthed(true);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    setSetDrafts([1, 2, 3, 4].map((number) => {
      const level = levelDocs.find((item) => item.number === number);
      const setData = level?.groups?.[selectedSet];
      const mcq = setData?.mcq?.question ? setData.mcq : level?.mcq;
      return {
        number,
        question: mcq?.question || "",
        options: Array.from({ length: 4 }, (_, index) => mcq?.options?.[index] || ""),
        correctIndex: Number.isInteger(mcq?.correctIndex) ? mcq.correctIndex : 0,
        clue: setData?.clue || "",
        secretCode: setData?.secretCode || "",
      };
    }));
    setLevelMessage("");
  }, [levelDocs, selectedSet]);

  const selectedSetStatus = setStatuses.find((status) => status.group === selectedSet);
  const selectedSetFinalized = [1, 2, 3, 4].every((number) =>
    levelDocs.find((level) => level.number === number)?.groups?.[selectedSet]?.finalized === true
  );
  const setupEditable = canEditSetup(hunt.status);

  function updateLevelDraft(number, patch) {
    setSetDrafts((drafts) => drafts.map((draft) =>
      draft.number === number ? { ...draft, ...patch } : draft
    ));
  }

  async function handleSaveQuestionSet(event) {
    event.preventDefault();
    setLevelMessage("");
    setSavingLevel(true);
    try {
      const levels = setDrafts.map((draft) => {
        const lastOption = draft.options.reduce(
          (last, option, index) => option.trim() ? index : last,
          -1,
        );
        if (draft.options.slice(0, lastOption + 1).some((option) => !option.trim())) {
          throw new Error(`Level ${draft.number}: fill answer options in order without gaps.`);
        }
        return {
          number: draft.number,
          title: `Level ${draft.number}`,
          question: draft.question,
          options: draft.options.slice(0, lastOption + 1),
          correctIndex: draft.correctIndex,
          clue: draft.clue,
          secretCode: draft.secretCode,
        };
      });
      const saved = await api("/api/admin/levels/sets", {
        group: selectedSet,
        levels,
      });
      setLevelDocs(saved.levels);
      const status = await api("/api/admin/levels");
      setSetStatuses(status.setStatuses);
      await load();
      setLevelSaveFailed(false);
      setLevelMessage(saved.message);
    } catch (saveError) {
      setLevelSaveFailed(true);
      setLevelMessage(saveError.message);
    } finally {
      setSavingLevel(false);
    }
  }

  async function handleFinalizeSet(finalized) {
    setLevelMessage("");
    setFinalizingSet(true);
    try {
      const result = await api("/api/admin/levels/sets/finalize", {
        group: selectedSet,
        finalized,
      });
      const levelData = await api("/api/admin/levels");
      setLevelDocs(levelData.levels);
      setSetStatuses(levelData.setStatuses);
      await load();
      setLevelSaveFailed(false);
      setLevelMessage(result.message);
    } catch (statusError) {
      setLevelSaveFailed(true);
      setLevelMessage(statusError.message);
    } finally {
      setFinalizingSet(false);
    }
  }

  async function handleStartHunt() {
    const isNewGame = hunt.status === "ended";
    const confirmation = isNewGame
      ? "Start a new game now? All teams' game progress, levels, penalties, and ranks will be reset. Team accounts and questions will be kept."
      : "Start the game now? Teams will be able to play immediately.";
    if (!confirm(confirmation)) return;
    setStartingHunt(true);
    try {
      await api("/api/admin/start-hunt", {});
      await load(true);
    } catch (startError) {
      alert(startError.message);
    } finally {
      setStartingHunt(false);
    }
  }

  async function handleEndHunt() {
    if (!confirm("End the game now? Gameplay will stop, team progress and results will be kept, and the game cannot be restarted.")) return;
    setStartingHunt(true);
    try {
      await api("/api/admin/end-hunt", {});
      await load(true);
    } catch (endError) {
      alert(endError.message);
    } finally {
      setStartingHunt(false);
    }
  }

  useEffect(() => {
    if (!authed) return;
    const interval = hunt.status === "countdown" ? 1000 : 5000;
    const id = setInterval(() => load(), interval);
    return () => clearInterval(id);
  }, [authed, key, hunt.status]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  async function handleAddTeam(e) {
    e.preventDefault();
    try {
      await api("/api/admin/add-team", newTeam);
      setNewTeam({ teamName: "", teamCode: "", password: "", group: "A", members: ["", ""] });
      await load(true);
    } catch (e) {
      alert(e.message);
    }
  }

  function addMemberSlot() {
    if (newTeam.members.length < MAX_MEMBERS)
      setNewTeam({ ...newTeam, members: [...newTeam.members, ""] });
  }
  function removeMemberSlot() {
    if (newTeam.members.length > MIN_MEMBERS)
      setNewTeam({ ...newTeam, members: newTeam.members.slice(0, -1) });
  }

  async function handleDeleteTeam(id, name) {
    if (!confirm(`Delete team "${name}"? This cannot be undone.`)) return;
    try { await api("/api/admin/delete-team", { teamId: id }); await load(true); }
    catch (e) { alert(e.message); }
  }
  async function handleUpdateTeam(id, patch) {
    try { await api("/api/admin/update-team", { teamId: id, ...patch }); await load(Boolean(patch.group)); }
    catch (e) { alert(e.message); }
  }
  async function handleResetPassword(id, name) {
    const newPassword = prompt(`Enter a new password for "${name}" (min 6 chars):`);
    if (!newPassword) return;
    if (newPassword.length < 6) return alert("Password must be at least 6 characters.");
    try {
      await api("/api/admin/reset-password", { teamId: id, newPassword });
      alert(`✅ Password reset for "${name}".\n\nNew password: ${newPassword}`);
      await load();
    } catch (e) { alert(e.message); }
  }
  async function handleUpdateMember(teamId, memberId, name) {
    try { await api("/api/admin/update-member", { teamId, memberId, name }); await load(); }
    catch (e) { alert(e.message); }
  }
  async function handleAddMember(teamId, name) {
    try {
      await api("/api/admin/add-member", { teamId, name });
      await load();
      return true;
    } catch (e) {
      alert(e.message);
      return false;
    }
  }
  async function handleDeleteMember(teamId, memberId, name) {
    if (!confirm(`Remove member "${name}"?`)) return;
    try { await api("/api/admin/delete-member", { teamId, memberId }); await load(); }
    catch (e) { alert(e.message); }
  }
  async function handleDisqualify(id, name) {
    if (!confirm(`Disqualify "${name}"?`)) return;
    try { await api("/api/admin/disqualify", { teamId: id }); await load(); }
    catch (e) { alert(e.message); }
  }
  async function handleResetLock(id) {
    try { await api("/api/admin/reset-lock", { teamId: id }); await load(); }
    catch (e) { alert(e.message); }
  }

  if (!authed) {
    return (
      <main className="login-page">
        <section className="login-panel">
          <p className="eyebrow">HINTGAME / ADMIN</p>
          <h1>Admin access</h1>
          <input
            className="admin-key-input"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Admin key"
            type="password"
          />
          <button className="submit-button" onClick={() => load(true)}>Enter <span>→</span></button>
          {error && <p className="login-error">{error}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-page admin-page">
      <header className="dash-header">
        <div>
          <p className="eyebrow">HINTGAME / ADMIN</p>
          <h1>Control Panel</h1>
          <p className="panel-copy">{teams.length} teams · live updates</p>
        </div>
        <Link className="text-button" to="/leaderboard">View leaderboard →</Link>
      </header>

      {error && <p className="login-error" role="alert">{error}</p>}

      <section className="level-card-large">
        <h2>Hunt control</h2>
        {hunt.status === "running" ? (
          <>
            <p className="panel-copy">
              Game is live{hunt.startedAt ? ` since ${new Date(hunt.startedAt).toLocaleString()}` : ""}.
            </p>
            <button className="submit-button danger" type="button" onClick={handleEndHunt} disabled={startingHunt}>
              {startingHunt ? "Ending game..." : "End Game"}
            </button>
          </>
        ) : hunt.status === "countdown" ? (
          <>
            <p className="panel-copy" aria-live="polite">
              The game starts in{" "}
              <strong>
                {Math.max(0, Math.ceil((new Date(hunt.startsAt).getTime() - now) / 1000))} seconds
              </strong>
              . Give teams time to get ready.
            </p>
            <button className="submit-button danger" type="button" onClick={handleEndHunt} disabled={startingHunt}>
              {startingHunt ? "Ending game..." : "End Game"}
            </button>
          </>
        ) : hunt.status === "ended" ? (
          <>
            <p className="panel-copy" role="status">
              Game ended{hunt.endedAt ? ` at ${new Date(hunt.endedAt).toLocaleString()}` : ""}. Team progress and results are preserved until you start a new game.
            </p>
            {readinessProblems.length > 0 && (
              <ul role="status">
                {readinessProblems.map((problem) => <li key={problem}>{problem}</li>)}
              </ul>
            )}
            <button
              className="submit-button"
              type="button"
              onClick={handleStartHunt}
              disabled={startingHunt || readinessProblems.length > 0}
            >
              {startingHunt ? "Starting new game..." : "Start New Game"}
              <span>→</span>
            </button>
          </>
        ) : (
          <>
            <p className="panel-copy">
              Complete and finalize all four levels for every group assigned to a team before starting.
            </p>
            {readinessProblems.length > 0 && (
              <ul role="status">
                {readinessProblems.map((problem) => <li key={problem}>{problem}</li>)}
              </ul>
            )}
            <button
              className="submit-button"
              type="button"
              onClick={handleStartHunt}
              disabled={startingHunt || readinessProblems.length > 0}
            >
              {startingHunt ? "Starting game..." : "Start Game"}
              <span>→</span>
            </button>
          </>
        )}
      </section>

      <section className="level-card-large">
        <h2>Manage all questions for a set</h2>
        <p className="panel-copy">
          Enter all four levels for one set, save them together, then finalize the set to make it playable.
        </p>
        <div className="team-admin-list" aria-label="Question set readiness">
          {GROUPS.map((group) => {
            const status = setStatuses.find((item) => item.group === group);
            return (
              <div className="team-admin-card" key={group}>
                <strong>Set {group}</strong>
                <span>{status?.ready ? "Ready — finalized" : "Needs setup"}</span>
                <span>{status?.assignedTeams ?? 0} assigned teams</span>
                {!status?.ready && status?.missingLevels?.length > 0 && (
                  <span>Levels to complete: {status.missingLevels.join(", ")}</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="admin-form">
          <label htmlFor="question-set">Question set</label>
          <select
            id="question-set"
            value={selectedSet}
            onChange={(event) => {
              setLevelMessage("");
              setSelectedSet(event.target.value);
            }}
          >
            {GROUPS.map((group) => (
              <option key={group} value={group}>Set {group}</option>
            ))}
          </select>
          <p className="panel-copy">
            Status: <strong>
              {selectedSetStatus?.ready
                ? "Ready for gameplay (finalized and locked)"
                : `Not ready — complete Levels ${selectedSetStatus?.missingLevels?.join(", ") || "1–4"}`}
            </strong>
          </p>
          <form onSubmit={handleSaveQuestionSet}>
            {setDrafts.map((draft) => (
              <fieldset className="level-card-large" key={draft.number} disabled={!setupEditable || selectedSetFinalized || savingLevel}>
                <legend>Level {draft.number}</legend>
                <label htmlFor={`question-${draft.number}`}>Question</label>
                <textarea
                  id={`question-${draft.number}`}
                  value={draft.question}
                  onChange={(event) => updateLevelDraft(draft.number, { question: event.target.value })}
                  required
                  rows={2}
                />
                <label>Answer options (2–4)</label>
                {draft.options.map((option, index) => (
                  <div className="admin-grid-4" key={index}>
                    <label>
                      <input
                        type="radio"
                        name={`correct-${draft.number}`}
                        checked={draft.correctIndex === index}
                        onChange={() => updateLevelDraft(draft.number, { correctIndex: index })}
                      />
                      Correct
                    </label>
                    <input
                      aria-label={`Level ${draft.number} option ${index + 1}`}
                      value={option}
                      onChange={(event) => {
                        const options = [...draft.options];
                        options[index] = event.target.value;
                        updateLevelDraft(draft.number, { options });
                      }}
                      required={index < 2}
                    />
                  </div>
                ))}
                <label htmlFor={`clue-${draft.number}`}>Clue</label>
                <textarea
                  id={`clue-${draft.number}`}
                  value={draft.clue}
                  onChange={(event) => updateLevelDraft(draft.number, { clue: event.target.value })}
                  required
                  rows={2}
                />
                <label htmlFor={`code-${draft.number}`}>Secret code</label>
                <input
                  id={`code-${draft.number}`}
                  value={draft.secretCode}
                  onChange={(event) => updateLevelDraft(draft.number, { secretCode: event.target.value.toUpperCase() })}
                  required
                />
              </fieldset>
            ))}
            {levelMessage && (
              <p className={levelSaveFailed ? "login-error" : "panel-copy"} role="status">
                {levelMessage}
              </p>
            )}
            {!selectedSetFinalized && setupEditable && (
              <button className="submit-button" type="submit" disabled={savingLevel || finalizingSet}>
                {savingLevel ? "Saving all 4 levels..." : `Save all 4 levels in Set ${selectedSet}`}
                <span>→</span>
              </button>
            )}
          </form>
          <button
            className="submit-button"
            type="button"
            onClick={() => handleFinalizeSet(!selectedSetFinalized)}
            disabled={!setupEditable || savingLevel || finalizingSet}
          >
            {finalizingSet
              ? "Updating set..."
              : selectedSetFinalized
                ? `Reopen Set ${selectedSet} for editing`
                : `Finalize and lock Set ${selectedSet}`}
            <span>→</span>
          </button>
        </div>
      </section>

      <section className="level-card-large">
        <h2>Add a new team (2 to 5 members)</h2>
        <form onSubmit={handleAddTeam} className="admin-form">
          <div className="admin-grid-4">
            <div>
              <label>Team name</label>
              <input value={newTeam.teamName} onChange={(e) => setNewTeam({ ...newTeam, teamName: e.target.value })} required />
            </div>
            <div>
              <label>Team code</label>
              <input value={newTeam.teamCode} onChange={(e) => setNewTeam({ ...newTeam, teamCode: e.target.value })} required />
            </div>
            <div>
              <label>Group</label>
              <select value={newTeam.group} onChange={(e) => setNewTeam({ ...newTeam, group: e.target.value })}>
                {GROUPS.map((g) => <option key={g} value={g}>Group {g}</option>)}
              </select>
            </div>
            <div>
              <label>Password (min 6 chars)</label>
              <input type="password" autoComplete="new-password" minLength={6} value={newTeam.password} onChange={(e) => setNewTeam({ ...newTeam, password: e.target.value })} required />
            </div>
          </div>

          <label style={{ marginTop: 14 }}>Members ({newTeam.members.length}/5, minimum 2)</label>
          <div className="admin-grid-5">
            {newTeam.members.map((m, i) => (
              <input
                key={i}
                value={m}
                placeholder={`Member ${i + 1}`}
                onChange={(e) => {
                  const copy = [...newTeam.members];
                  copy[i] = e.target.value;
                  setNewTeam({ ...newTeam, members: copy });
                }}
                required
              />
            ))}
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 10, alignItems: "center" }}>
            {newTeam.members.length < MAX_MEMBERS && (
              <button type="button" className="text-button" onClick={addMemberSlot}>
                + Add member
              </button>
            )}
            {newTeam.members.length > MIN_MEMBERS && (
              <button type="button" className="text-button danger" onClick={removeMemberSlot}>
                − Remove last member
              </button>
            )}
          </div>

          <button className="submit-button" type="submit" style={{ marginTop: 14 }} disabled={!setupEditable}>
            Create team <span>+</span>
          </button>
        </form>
      </section>

      <section className="level-card-large">
        <h2>All teams</h2>
        {teams.length === 0 && <p className="panel-copy">No teams yet.</p>}

        <div className="team-admin-list">
          {teams.map((t) => {
            const open = expanded[t.id];
            return (
              <div key={t.id} className={`team-admin-card ${t.status === "eliminated" ? "elim" : ""}`}>
                <div className="team-admin-head">
                  <div>
                    <strong>{t.teamName}</strong>
                    <span className="team-code-badge">{t.teamCode}</span>
                    <span className={`group-badge group-${t.group}`}>Group {t.group}</span>
                  </div>
                  <div className="team-admin-meta">
                    <span>Lv {t.currentLevel}</span>
                    <span>·</span>
                    <span>{t.status}</span>
                    <span>·</span>
                    <span>{t.members.length}/5 members</span>
                    {t.lockedNow && (
                      <>
                        <span>·</span>
                        <span className="lock-pill">🔒 until {new Date(t.lockUntil).toLocaleTimeString()}</span>
                      </>
                    )}
                  </div>
                  <div className="team-admin-actions">
                    <button className="text-button" onClick={() => setExpanded({ ...expanded, [t.id]: !open })}>
                      {open ? "Close" : "Manage"}
                    </button>
                    <button className="text-button" onClick={() => handleResetPassword(t.id, t.teamName)}>
                      Reset password
                    </button>
                    <button className="text-button" onClick={() => handleResetLock(t.id)}>Unlock</button>
                    <button className="text-button danger" onClick={() => handleDisqualify(t.id, t.teamName)}>Disqualify</button>
                    <button className="text-button danger" onClick={() => handleDeleteTeam(t.id, t.teamName)} disabled={!setupEditable}>Delete</button>
                  </div>
                </div>

                {open && (
                  <div className="team-admin-body">
                    <div className="edit-grid-3">
                      <EditableField label="Team name" value={t.teamName} onSave={(v) => v !== t.teamName && handleUpdateTeam(t.id, { teamName: v })} />
                      <EditableField label="Team code" value={t.teamCode} onSave={(v) => {
                        const up = v.toUpperCase();
                        up !== t.teamCode && handleUpdateTeam(t.id, { teamCode: up });
                      }} />
                      <EditableGroup value={t.group} onSave={(v) => v !== t.group && handleUpdateTeam(t.id, { group: v })} />
                    </div>

                    <h3 className="admin-subhead">Members ({t.members.length}/5)</h3>
                    <div className="member-list">
                      {t.members.map((m) => (
                        <MemberRow
                          key={m.id}
                          teamId={t.id}
                          member={m}
                          onSave={handleUpdateMember}
                          onDelete={handleDeleteMember}
                          canDelete={t.members.length > MIN_MEMBERS}
                        />
                      ))}
                    </div>

                    {t.members.length < MAX_MEMBERS && (
                      <form
                        className="add-member-row"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const name = e.target.elements.memberName.value.trim();
                          if (name && await handleAddMember(t.id, name)) e.target.reset();
                        }}
                      >
                        <input name="memberName" placeholder="New member name" required maxLength={80} />
                        <button className="text-button" type="submit">+ Add member ({t.members.length}/5)</button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}