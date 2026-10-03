// frontend/src/app/App.jsx
import { useState, useEffect } from "react";
import Login from "../features/auth/Login";
import Dashboard from "../features/game/Dashboard";
import Leaderboard from "../features/game/Leaderboard";
import Admin from "../features/admin/Admin";

const SESSION_KEY = "hintgame.session";

function App() {
  const [team, setTeam] = useState(null);

  useEffect(() => {
    const check = () => {
      try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed?.team) setTeam(parsed.team);
        else setTeam(null);
      } catch { setTeam(null); }
    };
    check();
    const id = setInterval(check, 500);
    return () => clearInterval(id);
  }, []);

  const path = window.location.pathname;
  if (path === "/admin") return <Admin />;
  if (path === "/leaderboard") return <Leaderboard />;
  if (team) return <Dashboard team={team} onLogout={() => setTeam(null)} />;
  return <Login />;
}

export default App;