import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import Admin from "../features/admin/Admin";
import Login from "../features/auth/Login";
import Dashboard from "../features/game/Dashboard";
import Leaderboard from "../features/game/Leaderboard";
import LevelView from "../features/game/LevelView";

const SESSION_KEY = "hintgame.session";

function getTeamSession() {
  try {
    const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    const team = session?.team;
    return team && (team.id || team._id) ? team : null;
  } catch {
    return null;
  }
}

function RequireTeam({ children }) {
  const team = getTeamSession();

  if (!team) {
    return <Navigate to="/login" replace />;
  }

  return children(team);
}

function ProtectedDashboard() {
  return (
    <RequireTeam>
      {(team) => <Dashboard team={team} />}
    </RequireTeam>
  );
}

function ProtectedLevel() {
  const navigate = useNavigate();
  const { levelNumber } = useParams();
  const parsedLevelNumber = Number(levelNumber);

  if (!Number.isInteger(parsedLevelNumber) || parsedLevelNumber < 1) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <RequireTeam>
      {(team) => (
        <LevelView
          team={team}
          levelNumber={parsedLevelNumber}
          onBack={() => navigate("/dashboard")}
        />
      )}
    </RequireTeam>
  );
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<ProtectedDashboard />} />
      <Route path="/game/level/:levelNumber" element={<ProtectedLevel />} />
      <Route path="/leaderboard" element={<Leaderboard />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/register" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
