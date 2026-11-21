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

/** The single centered card from the mockup, with the Sign up / Log in switch on top. */
function AuthCard({
  tab,
  children,
  next,
}: {
  tab?: "signup" | "login";
  children: React.ReactNode;
  next?: string;
}) {
  const q = next && next !== "/dashboard" ? `?next=${encodeURIComponent(next)}` : "";
  return (
    <main className="auth-main">
      <section className="auth-card">
        {tab && (
          <div className="seg auth-seg" role="tablist" aria-label="Sign up or log in">
            <Link to={`/signup${q}`} role="tab" aria-selected={tab === "signup"}>
              Sign up
            </Link>
            <Link to={`/login${q}`} role="tab" aria-selected={tab === "login"}>
              Log in
            </Link>
          </div>
        )}
        {children}
      </section>
    </main>
  );
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
    <AuthCard tab="login" next={next}>
      <h1>Welcome back</h1>
      <form onSubmit={submit} className="auth-form">
        <div className="field">
          <label htmlFor="li-email">Cornell email</label>
          <input id="li-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="netid@cornell.edu" required autoComplete="username" />
        </div>
        <div className="field">
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
        <Link to="/forgot" className="auth-link">
          Forgot your password?
        </Link>
        <button className="btn btn-block" type="submit" disabled={busy}>
          {busy ? "Logging in…" : "Log in"}
        </button>
      </form>
    </AuthCard>
  );
}

export function Signup() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const role: "braider" | "client" = params.get("role") === "braider" ? "braider" : "client";
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [emailSent, setEmailSent] = useState(true);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await api.register(email.trim().toLowerCase(), password, role, displayName.trim());
      setEmailSent(res.email_sent);
      setSentTo(res.email);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Sign-up failed.");
    } finally {
      setBusy(false);
    }
  };

  if (sentTo) {
    return (
      <AuthCard>
        <h1>Check your inbox</h1>
        <p className="auth-lede">
          {emailSent
            ? `We sent a confirmation link to ${sentTo}. Open it to finish signing up. It can take a minute, and it may land in spam.`
            : `Your account is created, but we couldn't send the confirmation email to ${sentTo}. Email sending isn't fully set up on this site yet, so please tell the site owner.`}
        </p>
        <Link to="/login" className="btn btn-ghost auth-back">
          Back to log in
        </Link>
      </AuthCard>
    );
  }

  const typed = email.trim();
  const bad = typed.length > 0 && !/@cornell\.edu$/i.test(typed);

  return (
    <AuthCard tab="signup" next={params.get("next") || undefined}>
      <h1>{role === "braider" ? "List your chair" : "Create your account"}</h1>
      <form onSubmit={submit} className="auth-form" noValidate>
        <div className="field">
          <label htmlFor="su-display">First name</label>
          <input id="su-display" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required autoComplete="given-name" />
        </div>
        <div className="field">
          <label htmlFor="su-email">Cornell email</label>
          <input id="su-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="netid@cornell.edu" required autoComplete="username" />
          <span className="hint" role="status" style={bad ? { color: "var(--bad)" } : undefined}>
            {bad ? "Use your @cornell.edu email." : "We'll email a link to confirm it's yours."}
          </span>
        </div>
        <div className="field">
          <label htmlFor="su-pass">Password</label>
          <input id="su-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
          <span className="hint">8 or more characters.</span>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn-block" type="submit" disabled={busy || bad}>
          {busy ? "Creating…" : "Create account"}
        </button>
      </form>
      <p className="auth-foot">
        {role === "braider" ? (
          <>
            Want to book instead? <Link to="/signup">Create a client account</Link>
          </>
        ) : (
          <>
            Do you braid? <Link to="/signup?role=braider">List your chair</Link>
          </>
        )}
      </p>
    </AuthCard>
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
      .then((res) => goIn(res, res.role === "braider" ? "/join" : "/browse"))
      .catch((err) => setError(err instanceof ApiError ? err.detail : "Could not confirm."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <AuthCard>
      {error ? (
        <>
          <h1>That link didn't work</h1>
          <p className="error" style={{ marginTop: 14 }}>{error}</p>
          <Link to="/login" className="btn btn-ghost auth-back">Log in to get a new link</Link>
        </>
      ) : (
        <>
          <h1>Confirming your email</h1>
          <p className="auth-lede" role="status">One moment…</p>
        </>
      )}
    </AuthCard>
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

  if (done) {
    return (
      <AuthCard>
        <h1>Check your inbox</h1>
        <p className="auth-lede" role="status">{done}</p>
        <Link to="/login" className="btn btn-ghost auth-back">
          Back to log in
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <h1>Reset your password</h1>
      <p className="auth-lede">Enter your Cornell email and we'll send you a link.</p>
      <form onSubmit={submit} className="auth-form">
        <div className="field">
          <label htmlFor="fp-email">Cornell email</label>
          <input id="fp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="netid@cornell.edu" required />
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn-block" type="submit">Send reset link</button>
        <Link to="/login" className="auth-link">
          Back to log in
        </Link>
      </form>
    </AuthCard>
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
    <AuthCard>
      <h1>Choose a new password</h1>
      <form onSubmit={submit} className="auth-form">
        <div className="field">
          <label htmlFor="rp-pass">New password</label>
          <input id="rp-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
          <span className="hint">8 or more characters.</span>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn-block" type="submit">Save and log in</button>
        <p className="auth-foot" style={{ margin: 0 }}>
          Link expired? <Link to="/forgot">Ask for a new one</Link>.
        </p>
      </form>
    </AuthCard>
  );
}
