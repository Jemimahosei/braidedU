import { useEffect, useState } from "react";
import { api } from "./lib/api";
import { HashRouter, Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { Mark } from "./components/ui";
import Home from "./pages/Home";
import Browse from "./pages/Browse";
import BraiderDetail from "./pages/BraiderDetail";
import { Confirm, Forgot, Login, Reset, Signup } from "./pages/Auth";
import ClientDashboard from "./pages/ClientDashboard";
import Messages from "./pages/Messages";
import BraiderDashboard from "./pages/BraiderDashboard";

function DashboardRoute() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login?next=/dashboard" replace />;
  return user.role === "braider" ? <BraiderDashboard /> : <ClientDashboard />;
}

/** A braider nav link to one dashboard tab; current only when that tab is showing. */
function DashLink({ tab, children }: { tab: string; children: React.ReactNode }) {
  const { pathname, search } = useLocation();
  const current = new URLSearchParams(search).get("tab") || "requests";
  const on = pathname === "/dashboard" && current === tab;
  return (
    <Link to={tab === "requests" ? "/dashboard" : `/dashboard?tab=${tab}`} aria-current={on ? "page" : undefined}>
      {children}
    </Link>
  );
}

function Header() {
  const { user, signOut } = useAuth();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!user) return;
    const load = () => api.unread().then((r) => setUnread(r.unread)).catch(() => {});
    load();
    const t = window.setInterval(load, 60000);
    return () => window.clearInterval(t);
  }, [user]);
  const navigate = useNavigate();
  const braider = user?.role === "braider";
  return (
    <header className="site-header">
      <div className="wrap">
        <Link className="brand" to="/">
          <Mark />
          braidedU
        </Link>
        <nav className="nav">
          {braider ? (
            <>
              <DashLink tab="requests">Requests</DashLink>
              <NavLink to="/messages">Messages{unread > 0 ? ` (${unread})` : ""}</NavLink>
              <DashLink tab="listings">Postings</DashLink>
              <DashLink tab="profile">Availability</DashLink>
              {user?.profile_id && <NavLink to={`/braiders/${user.profile_id}`}>My page</NavLink>}
            </>
          ) : (
            <>
              <NavLink to="/browse">Find a braider</NavLink>
              <NavLink to="/messages">Messages{user && unread > 0 ? ` (${unread})` : ""}</NavLink>
              <NavLink to="/dashboard">My bookings</NavLink>
            </>
          )}
          {user ? (
            <>
              <span className="who">{user.username}</span>
              <button
                type="button"
                className="nav-link"
                onClick={() => {
                  signOut();
                  navigate("/");
                }}
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login">Log in</NavLink>
              <Link to="/signup" className="btn">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Header />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/browse" element={<Browse />} />
            <Route path="/braiders/:id" element={<BraiderDetail />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/confirm" element={<Confirm />} />
            <Route path="/forgot" element={<Forgot />} />
            <Route path="/reset" element={<Reset />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/messages/:userId" element={<Messages />} />
            <Route path="/dashboard" element={<DashboardRoute />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <footer className="site-footer">
          <div className="wrap">A Cornell student project</div>
        </footer>
      </HashRouter>
    </AuthProvider>
  );
}
