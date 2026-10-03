// frontend/src/features/admin/Admin.jsx
import { useEffect, useState } from "react";

const serverUrl = (import.meta.env.VITE_SERVER_URL || "http://localhost:3000").replace(/\/$/, "");
const MAX_MEMBERS = 6;
const GROUPS = ["A", "B", "C"];

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

function MemberRow({ teamId, member, onSave, onDelete }) {
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
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState({});
  const [newTeam, setNewTeam] = useState({
    teamName: "",
    teamCode: "",
    password: "",
    group: "A",
    members: ["", "", "", "", ""],
  });

  async function api(path, body) {
    const res = await fetch(`${serverUrl}${path}`, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json", "x-admin-key": key },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.message || "Request failed");
    return json;
  }

  async function load() {
    try {
      const json = await api("/api/admin/overview");
      setTeams(json.teams);
      setAuthed(true);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    if (!authed) return;
    const id = setInterval(() => load(), 5000);
    return () => clearInterval(id);
  }, [authed, key]);

  async function handleAddTeam(e) {
    e.preventDefault();
    try {
      await api("/api/admin/add-team", newTeam);
      setNewTeam({ teamName: "", teamCode: "", password: "", group: "A", members: ["", "", "", "", ""] });
      load();
    } catch (e) {
      alert(e.message);
    }
  }

  function addSixthSlot() {
    if (newTeam.members.length < MAX_MEMBERS)
      setNewTeam({ ...newTeam, members: [...newTeam.members, ""] });
  }
  function removeLastSlot() {
    if (newTeam.members.length > 5)
      setNewTeam({ ...newTeam, members: newTeam.members.slice(0, -1) });
  }

  async function handleDeleteTeam(id, name) {
    if (!confirm(`Delete team "${name}"? This cannot be undone.`)) return;
    try { await api("/api/admin/delete-team", { teamId: id }); load(); }
    catch (e) { alert(e.message); }
  }
  async function handleUpdateTeam(id, patch) {
    try { await api("/api/admin/update-team", { teamId: id, ...patch }); load(); }
    catch (e) { alert(e.message); }
  }
  async function handleResetPassword(id, name) {
    const newPassword = prompt(`Enter a new password for "${name}" (min 6 chars):`);
    if (!newPassword) return;
    if (newPassword.length < 6) return alert("Password must be at least 6 characters.");
    try {
      await api("/api/admin/reset-password", { teamId: id, newPassword });
      alert(`✅ Password reset for "${name}".\n\nNew password: ${newPassword}`);
      load();
    } catch (e) { alert(e.message); }
  }
  async function handleUpdateMember(teamId, memberId, name) {
    try { await api("/api/admin/update-member", { teamId, memberId, name }); load(); }
    catch (e) { alert(e.message); }
  }
  async function handleAddMember(teamId, name) {
    try { await api("/api/admin/add-member", { teamId, name }); load(); }
    catch (e) { alert(e.message); }
  }
  async function handleDeleteMember(teamId, memberId, name) {
    if (!confirm(`Remove member "${name}"?`)) return;
    try { await api("/api/admin/delete-member", { teamId, memberId }); load(); }
    catch (e) { alert(e.message); }
  }
  async function handleDisqualify(id, name) {
    if (!confirm(`Disqualify "${name}"?`)) return;
    try { await api("/api/admin/disqualify", { teamId: id }); load(); }
    catch (e) { alert(e.message); }
  }
  async function handleResetLock(id) {
    try { await api("/api/admin/reset-lock", { teamId: id }); load(); }
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
          <button className="submit-button" onClick={load}>Enter <span>→</span></button>
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
          <p className="panel-copy">{teams.length} teams · live updates every 5s</p>
        </div>
        <a className="text-button" href="/leaderboard">View leaderboard →</a>
      </header>

      <section className="level-card-large">
        <h2>Add a new team (5 members default, 6th optional)</h2>
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
              <input type="text" value={newTeam.password} onChange={(e) => setNewTeam({ ...newTeam, password: e.target.value })} required />
            </div>
          </div>

          <label style={{ marginTop: 14 }}>Members ({newTeam.members.length}/6)</label>
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
            {newTeam.members.length < MAX_MEMBERS ? (
              <button type="button" className="text-button" onClick={addSixthSlot}>
                + Add 6th member (optional)
              </button>
            ) : (
              <button type="button" className="text-button danger" onClick={removeLastSlot}>
                − Remove 6th member
              </button>
            )}
          </div>

          <button className="submit-button" type="submit" style={{ marginTop: 14 }}>
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
                    <span>{t.members.length}/6 members</span>
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
                    <button className="text-button danger" onClick={() => handleDeleteTeam(t.id, t.teamName)}>Delete</button>
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

                    <h3 className="admin-subhead">Members ({t.members.length}/6)</h3>
                    <div className="member-list">
                      {t.members.map((m) => (
                        <MemberRow key={m.id} teamId={t.id} member={m} onSave={handleUpdateMember} onDelete={handleDeleteMember} />
                      ))}
                    </div>

                    {t.members.length < MAX_MEMBERS && (
                      <form
                        className="add-member-row"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const name = e.target.elements.memberName.value.trim();
                          if (name) { handleAddMember(t.id, name); e.target.reset(); }
                        }}
                      >
                        <input name="memberName" placeholder="New member name" />
                        <button className="text-button" type="submit">+ Add member ({t.members.length}/6)</button>
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