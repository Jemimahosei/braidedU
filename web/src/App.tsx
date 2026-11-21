import { useEffect, useState } from "react";
import { api, hasClient, isBraider } from "./lib/api";
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
import Account from "./pages/Account";
import BookingPage from "./pages/BookingPage";
import { Privacy, Terms } from "./pages/Legal";

function DashboardRoute() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login?next=/dashboard" replace />;
  return isBraider(user) ? <BraiderRequests /> : <ClientDashboard />;
}

/** Pages that only a signed-in braider can use. */
function BraiderOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(pathname)}`} replace />;
  if (!isBraider(user)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/** Pages that only a signed-in client can use (a dual login qualifies). */
function ClientOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(pathname)}`} replace />;
  if (!hasClient(user)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function useUnread() {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!user) return;
    const load = () => api.unread().then((r) => setUnread(r.unread)).catch(() => {});
    load();
    const t = window.setInterval(load, 60000);
    return () => window.clearInterval(t);
  }, [user]);
  return user ? unread : 0;
}

/** The phone tab bar (mockups: MBrowse, MMessages): four tabs along the bottom. */
function BottomNav({ unread }: { unread: number }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const braider = isBraider(user);
  const client = hasClient(user);
  return (
    <nav className="tabbar" aria-label="Main">
      {braider ? (
        <>
          <NavLink to="/dashboard">Requests</NavLink>
          <NavLink to="/messages">Messages{unread > 0 ? ` (${unread})` : ""}</NavLink>
          <NavLink to="/postings">Postings</NavLink>
          {client && <NavLink to="/my-bookings">Bookings</NavLink>}
        </>
      ) : (
        <>
          <NavLink to="/browse" className={() => (pathname === "/" || pathname.startsWith("/browse") || pathname.startsWith("/braiders") ? "active" : "")}>Find</NavLink>
          <NavLink to="/messages">Messages{unread > 0 ? ` (${unread})` : ""}</NavLink>
          <NavLink to="/dashboard">Bookings</NavLink>
        </>
      )}
      <NavLink to={user ? "/account" : "/login"}>Account</NavLink>
    </nav>
  );
}

function Header({ unread }: { unread: number }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const braider = isBraider(user);
  const client = hasClient(user);
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
              {client && <NavLink to="/my-bookings">My bookings</NavLink>}
            </>
          ) : (
            <>
              <NavLink to="/browse">Find a braider</NavLink>
              <NavLink to="/messages">Messages{user && unread > 0 ? ` (${unread})` : ""}</NavLink>
              <NavLink to="/dashboard">My bookings</NavLink>
              {user && <NavLink to="/join">List your chair</NavLink>}
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

function Shell() {
  const unread = useUnread();
  return (
    <div className="shell">
      <Header unread={unread} />
      <div className="shell-body">
          <Routes>
            <Route path="/" element={<main><Home /></main>} />
            <Route path="/browse" element={<Browse />} />
            <Route path="/braiders/:id" element={<BraiderDetail />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
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
            <Route path="/my-bookings" element={<ClientOnly><ClientDashboard /></ClientOnly>} />
            <Route path="/account" element={<Account />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
      </div>
      <BottomNav unread={unread} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </AuthProvider>
  );
}
