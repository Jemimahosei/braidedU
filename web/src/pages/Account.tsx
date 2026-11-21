import { Link, Navigate, useNavigate } from "react-router-dom";
import { hasClient, isBraider } from "../lib/api";
import { useAuth } from "../lib/auth";

/** The phone's Account tab: who you are, a few links, log out. */
export default function Account() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  if (!user) return <Navigate to="/login" replace />;
  const braider = isBraider(user);
  const client = hasClient(user);
  const who = braider && client ? "braider and client" : braider ? "braider" : "client";
  return (
    <main className="auth-main">
      <section className="auth-card">
        <h1>Account</h1>
        <p className="auth-lede">
          {user.username}, {who}
        </p>
        <div className="acct-links">
          {braider && (
            <>
              <Link to="/availability">Availability and rules</Link>
              <Link to="/my-page">Edit my page</Link>
              {user.profile_id && <Link to={`/braiders/${user.profile_id}`}>See my page</Link>}
            </>
          )}
          {client && (
            <>
              <Link to="/browse">Find a braider</Link>
              <Link to="/my-bookings">My bookings</Link>
            </>
          )}
          {!braider && <Link to="/join">List your chair</Link>}
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-block"
          style={{ marginTop: 20 }}
          onClick={() => {
            signOut();
            navigate("/");
          }}
        >
          Log out
        </button>
      </section>
    </main>
  );
}
