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
import BraiderRequests from "./pages/BraiderRequests";
import Postings from "./pages/Postings";
import PostingForm from "./pages/PostingForm";
import Availability from "./pages/Availability";
import MyPageEdit from "./pages/MyPageEdit";
import Join from "./pages/Join";
import BookingPage from "./pages/BookingPage";

function DashboardRoute() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login?next=/dashboard" replace />;
  return user.role === "braider" ? <BraiderRequests /> : <ClientDashboard />;
}

/** Pages that only a signed-in braider can use. */
function BraiderOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(pathname)}`} replace />;
  if (user.role !== "braider") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
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
              <NavLink to="/dashboard">Requests</NavLink>
              <NavLink to="/messages">Messages{unread > 0 ? ` (${unread})` : ""}</NavLink>
              <NavLink to="/postings">Postings</NavLink>
              <NavLink to="/availability">Availability</NavLink>
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
            <Route path="/bookings/:id" element={<BookingPage />} />
            <Route path="/join" element={<Join />} />
            <Route path="/postings" element={<BraiderOnly><Postings /></BraiderOnly>} />
            <Route path="/postings/new" element={<BraiderOnly><PostingForm /></BraiderOnly>} />
            <Route path="/postings/:id/edit" element={<BraiderOnly><PostingForm /></BraiderOnly>} />
            <Route path="/availability" element={<BraiderOnly><Availability /></BraiderOnly>} />
            <Route path="/my-page" element={<BraiderOnly><MyPageEdit /></BraiderOnly>} />
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
