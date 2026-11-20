import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError, type Session } from "../lib/api";
import { useAuth } from "../lib/auth";

function useSignIn() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  return (res: Session, next = "/dashboard") => {
    signIn(res.token, { username: res.username, role: res.role, profile_id: res.profile_id });
    navigate(next);
  };
}

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const goIn = useSignIn();
  const [params] = useSearchParams();
  const next = params.get("next") || "/dashboard";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setUnconfirmed(false);
    setBusy(true);
    try {
      goIn(await api.login(email.trim(), password), next);
    } catch (err) {
      setUnconfirmed(err instanceof ApiError && err.status === 403);
      setError(err instanceof ApiError ? err.detail : "Login failed.");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    try {
      setInfo((await api.resendConfirmation(email.trim())).detail);
    } catch {
      setInfo("Could not send that just now. Try again in a minute.");
    }
  };

  return (
    <div className="page">
      <div className="wrap" style={{ maxWidth: "560px" }}>
        <h1>Log in</h1>
        <form onSubmit={submit} className="panel stack" style={{ marginTop: "1.5rem" }}>
          <div>
            <label htmlFor="li-email">Cornell email</label>
            <input id="li-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="netid@cornell.edu" required autoComplete="username" />
          </div>
          <div>
            <label htmlFor="li-pass">Password</label>
            <input id="li-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          {unconfirmed && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={resend}>
              Send me a new confirmation link
            </button>
          )}
          {info && <p className="notice" role="status">{info}</p>}
          <button className="btn" type="submit" disabled={busy}>
            {busy ? "Logging in…" : "Log in"}
          </button>
          <p className="muted">
            <Link to="/forgot">Forgot your password?</Link>
          </p>
          <p className="muted">
            No account yet? <Link to="/signup">Sign up free</Link>.
          </p>
        </form>
      </div>
    </div>
  );
}

export function Signup() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"braider" | "client">(
    params.get("role") === "braider" ? "braider" : "client",
  );
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await api.register(email.trim().toLowerCase(), password, role, displayName.trim());
      setSentTo(res.email);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Sign-up failed.");
    } finally {
      setBusy(false);
    }
  };

  if (sentTo) {
    return (
      <div className="page">
        <div className="wrap" style={{ maxWidth: "560px" }}>
          <div className="panel stack">
            <h1>Check your email</h1>
            <p>
              We sent a confirmation link to <strong>{sentTo}</strong>. Open it to finish signing
              up. It can take a minute, and it may land in spam.
            </p>
            <p className="muted">
              Wrong address? <Link to="/signup">Start again</Link>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="wrap" style={{ maxWidth: "560px" }}>
        <h1>Create your account</h1>
        <p className="lede">Free, and only for people with a Cornell email. An account is either a client or a braider.</p>
        <form onSubmit={submit} className="panel stack" style={{ marginTop: "1.5rem" }}>
          <div>
            <label>I am here to</label>
            <div className="chip-row">
              <button type="button" className="chip" aria-pressed={role === "client"} onClick={() => setRole("client")}>
                Get my hair braided
              </button>
              <button type="button" className="chip" aria-pressed={role === "braider"} onClick={() => setRole("braider")}>
                Braid hair for others
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="su-display">Name people will see</label>
            <input id="su-display" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={role === "braider" ? "e.g. Erica" : "e.g. Maya"} required />
          </div>
          <div>
            <label htmlFor="su-email">Cornell email</label>
            <input id="su-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="netid@cornell.edu" required autoComplete="username" />
          </div>
          <div>
            <label htmlFor="su-pass">Password (8 or more characters)</label>
            <input id="su-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn" type="submit" disabled={busy}>
            {busy ? "Creating…" : role === "braider" ? "Create braider account" : "Create client account"}
          </button>
          <p className="muted">
            Already have an account? <Link to="/login">Log in</Link>.
          </p>
        </form>
      </div>
    </div>
  );
}

export function Confirm() {
  const [params] = useSearchParams();
  const [error, setError] = useState("");
  const goIn = useSignIn();
  const token = params.get("token") || "";

  useEffect(() => {
    api
      .confirmEmail(token)
      .then((res) => goIn(res, res.role === "braider" ? "/dashboard" : "/browse"))
      .catch((err) => setError(err instanceof ApiError ? err.detail : "Could not confirm."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="page">
      <div className="wrap" style={{ maxWidth: "560px" }}>
        {error ? (
          <div className="panel stack">
            <h1>That link didn't work</h1>
            <p className="error">{error}</p>
            <Link to="/login" className="btn">Log in to get a new link</Link>
          </div>
        ) : (
          <p className="muted" role="status">Confirming your email…</p>
        )}
      </div>
    </div>
  );
}

export function Forgot() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState("");
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      setDone((await api.forgotPassword(email.trim())).detail);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Something went wrong.");
    }
  };

  return (
    <div className="page">
      <div className="wrap" style={{ maxWidth: "560px" }}>
        <h1>Forgot your password?</h1>
        <form onSubmit={submit} className="panel stack" style={{ marginTop: "1.5rem" }}>
          <div>
            <label htmlFor="fp-email">Cornell email</label>
            <input id="fp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="netid@cornell.edu" required />
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          {done && <p className="notice" role="status">{done}</p>}
          <button className="btn" type="submit">Send reset link</button>
        </form>
      </div>
    </div>
  );
}

export function Reset() {
  const [params] = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const goIn = useSignIn();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      goIn(await api.resetPassword(params.get("token") || "", password));
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Something went wrong.");
    }
  };

  return (
    <div className="page">
      <div className="wrap" style={{ maxWidth: "560px" }}>
        <h1>Choose a new password</h1>
        <form onSubmit={submit} className="panel stack" style={{ marginTop: "1.5rem" }}>
          <div>
            <label htmlFor="rp-pass">New password (8 or more characters)</label>
            <input id="rp-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn" type="submit">Save and log in</button>
          <p className="muted">
            Link expired? <Link to="/forgot">Ask for a new one</Link>.
          </p>
        </form>
      </div>
    </div>
  );
}
