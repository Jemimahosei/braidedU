import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { api, sized, type Conversation, type Thread } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Avatar } from "../components/ui";
import { usePhotoUpload } from "../components/PhotoField";
import { ReportForm, useSafety } from "../components/SafetyMenu";

/** Header of an open thread: name, View profile, Report, Block, and the banner under it. */
function ThreadHead({ thread, onBlockChange }: { thread: Thread; onBlockChange: (b: boolean) => void }) {
  const s = useSafety(thread.user_id, thread.name, thread.blocked, onBlockChange);
  return (
    <>
      <header className="chat-head">
        <Link to="/messages" className="chat-back">‹ All</Link>
        <strong className="chat-title">{thread.name}</strong>
        <span className="chat-tools">
          {thread.profile_id && (
            <Link to={`/braiders/${thread.profile_id}`} style={{ fontWeight: 600 }}>
              View profile
            </Link>
          )}
          <button type="button" className="text-btn" onClick={() => s.setOpen(!s.open)}>
            Report
          </button>
          <button type="button" className="text-btn danger" onClick={s.toggleBlock}>
            {thread.blocked ? "Unblock" : "Block"}
          </button>
        </span>
      </header>
      {s.msg && (
        <div className="chat-flag" role="status">
          <span>{s.msg}</span>
          {thread.blocked && (
            <button type="button" onClick={s.toggleBlock}>
              Undo
            </button>
          )}
        </div>
      )}
      <ReportForm userId={thread.user_id} s={s} />
    </>
  );
}

/** Messages (mockup: Messages.dc.html). */
export default function Messages() {
  const { user } = useAuth();
  const { userId } = useParams();
  const [convos, setConvos] = useState<Conversation[] | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState("");
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const attach = usePhotoUpload("message", setPhoto);

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
      await api.sendMessage(userId!, text, photo);
      setText("");
      setPhoto("");
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send.");
    }
  };

  return (
    <main className="msg-main">
      <h1>Messages</h1>
      <div className="msg-shell">
        <nav className={`msg-list${userId ? " chat-hide-mobile" : ""}`} aria-label="Conversations">
          {convos === null ? (
            <p className="hint" style={{ padding: 12 }}>Loading…</p>
          ) : convos.length === 0 ? (
            <div className="msg-none">
              <strong>No messages yet</strong>
              <div>Message a braider from her page to ask a question before you book.</div>
              <Link to="/browse" className="btn btn-sm">Find a braider</Link>
            </div>
          ) : (
            convos.map((c) => (
              <Link key={c.user_id} to={`/messages/${c.user_id}`} className="msg-row" aria-current={String(c.user_id) === userId ? "true" : undefined}>
                <Avatar name={c.name} src={c.photo_url} small />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <strong style={{ display: "block" }}>{c.name}</strong>
                  <span className="msg-last">{c.last}</span>
                </span>
                {c.unread > 0 && <span className="pill pill-requested">{c.unread}</span>}
              </Link>
            ))
          )}
        </nav>

        <section className={`msg-thread${userId ? "" : " chat-hide-mobile"}`} aria-label="Conversation">
          {!userId ? (
            <p className="hint" style={{ padding: 24 }}>Pick a conversation.</p>
          ) : !thread ? (
            error ? <p className="error" role="alert" style={{ margin: 24 }}>{error}</p> : <p className="hint" style={{ padding: 24 }}>Loading…</p>
          ) : (
            <>
              <ThreadHead thread={thread} onBlockChange={(b) => setThread({ ...thread, blocked: b })} />
              <div className="msg-body" role="log">
                {thread.messages.length === 0 && <p className="hint">Say hi. They also get an email.</p>}
                {thread.messages.map((m) => (
                  <div key={m.id} className={`msg-line ${m.mine ? "mine" : "theirs"}`}>
                    <span className="bubble">
                      {m.body && <span style={{ whiteSpace: "pre-wrap" }}>{m.body}</span>}
                      {m.photo_url && (
                        <a href={m.photo_url} target="_blank" rel="noreferrer">
                          <img src={sized(m.photo_url, 500)} alt="Shared photo" loading="lazy" />
                        </a>
                      )}
                    </span>
                  </div>
                ))}
                <div ref={end} />
              </div>
              {thread.can_reply ? (
                <form onSubmit={send} className="msg-form">
                  <button type="button" className="msg-attach" aria-label="Attach a photo" disabled={attach.busy} onClick={attach.open}>
                    {photo ? <img src={sized(photo, 100)} alt="Photo ready to send" /> : "+"}
                  </button>
                  {attach.field}
                  <label htmlFor="msg" className="sr-only">Message</label>
                  <input id="msg" value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message" />
                  <button type="submit" className="btn msg-send" disabled={!text.trim() && !photo}>
                    Send
                  </button>
                </form>
              ) : (
                <p className="notice" style={{ margin: 16 }}>You can't send messages in this conversation.</p>
              )}
              {(error || attach.err) && <p className="error" role="alert" style={{ margin: "0 24px 16px" }}>{error || attach.err}</p>}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
