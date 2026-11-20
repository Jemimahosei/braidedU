import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { api, sized, type Conversation, type Thread } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Avatar } from "../components/ui";
import { PhotoField } from "../components/PhotoField";
import { SafetyMenu } from "../components/SafetyMenu";

export default function Messages() {
  const { user } = useAuth();
  const { userId } = useParams();
  const [convos, setConvos] = useState<Conversation[] | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<string[]>([]);
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);

  const refresh = useCallback(() => {
    api.conversations().then(setConvos).catch(() => setConvos([]));
    if (userId) api.thread(userId).then(setThread).catch((e) => setError(e instanceof Error ? e.message : "Could not load."));
  }, [userId]);

  useEffect(() => {
    if (!user) return;
    refresh();
    // New messages arrive by email too; refresh now and then while the page is open.
    const t = window.setInterval(refresh, 20000);
    return () => window.clearInterval(t);
  }, [user, refresh]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [thread?.messages.length]);

  if (!user) return <Navigate to="/login?next=/messages" replace />;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await api.sendMessage(userId!, text, photo[0] || "");
      setText("");
      setPhoto([]);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send.");
    }
  };

  return (
    <div className="page">
      <div className="wrap">
        <h1>Messages</h1>
        <div className="chat-layout">
          <nav className={`chat-list${userId ? " chat-hide-mobile" : ""}`} aria-label="Conversations">
            {convos === null ? (
              <p className="muted">Loading…</p>
            ) : convos.length === 0 ? (
              <div className="empty">
                <strong>No messages yet</strong>
                Message a braider from her page to ask a question before you book.
                <br />
                <Link to="/browse" className="btn btn-sm">Find a braider</Link>
              </div>
            ) : (
              convos.map((c) => (
                <Link key={c.user_id} to={`/messages/${c.user_id}`} className="chat-row" aria-current={String(c.user_id) === userId ? "true" : undefined}>
                  <Avatar name={c.name} src={c.photo_url} />
                  <span className="grow">
                    <strong>{c.name}</strong>
                    <span className="meta" style={{ display: "block" }}>{c.last}</span>
                  </span>
                  {c.unread > 0 && <span className="pill pill-requested">{c.unread}</span>}
                </Link>
              ))
            )}
          </nav>

          <section className={`chat-thread${userId ? "" : " chat-hide-mobile"}`} aria-label="Conversation">
            {!userId ? (
              <p className="muted">Pick a conversation.</p>
            ) : !thread ? (
              error ? <p className="error" role="alert">{error}</p> : <p className="muted">Loading…</p>
            ) : (
              <>
                <header className="chat-head">
                  <Link to="/messages" className="chat-back">‹ All</Link>
                  <Avatar name={thread.name} src={thread.photo_url} />
                  <strong>{thread.name}</strong>
                </header>
                <div className="chat-msgs" role="log">
                  {thread.messages.length === 0 && <p className="muted">Say hi. They also get an email.</p>}
                  {thread.messages.map((m) => (
                    <div key={m.id} className={`bubble ${m.mine ? "mine" : "theirs"}`}>
                      {m.body && <p>{m.body}</p>}
                      {m.photo_url && (
                        <a href={m.photo_url} target="_blank" rel="noreferrer">
                          <img src={sized(m.photo_url, 500)} alt="Shared photo" loading="lazy" />
                        </a>
                      )}
                    </div>
                  ))}
                  <div ref={end} />
                </div>
                {thread.can_reply ? (
                  <form onSubmit={send} className="stack">
                    <textarea aria-label="Your message" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message" />
                    <PhotoField kind="message" urls={photo} onChange={setPhoto} label="Photo" />
                    {error && <p className="error" role="alert">{error}</p>}
                    <button className="btn" type="submit" disabled={!text.trim() && photo.length === 0}>Send</button>
                  </form>
                ) : (
                  <p className="notice">You can't send messages in this conversation.</p>
                )}
                <hr className="hr" />
                <SafetyMenu userId={thread.user_id} name={thread.name} blocked={thread.blocked} onBlockChange={(b) => setThread({ ...thread, blocked: b })} />
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
