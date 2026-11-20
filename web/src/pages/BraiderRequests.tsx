import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  api,
  cap,
  formatDate,
  formatPrice,
  formatTime,
  initials,
  TINTS,
  type Booking,
  type Braider,
} from "../lib/api";

/** Status pill wording from the braider mockup (Dashboard.dc.html). */
const LOOK: Record<string, string> = {
  requested: "New request",
  accepted: "Accepted, awaiting payment",
  paid: "Client says paid",
  confirmed: "Paid, receipt sent",
  completed: "Completed",
  declined: "Declined",
  cancelled: "Cancelled",
};
const ORDER = ["requested", "paid", "accepted", "confirmed", "completed", "declined", "cancelled"];

export default function BraiderRequests() {
  const [profile, setProfile] = useState<Braider | null>(null);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [cancelWhy, setCancelWhy] = useState("");
  const [replyId, setReplyId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");

  const load = () => {
    api.myBraiderProfile().then(setProfile).catch(() => setProfile(null));
    api.bookings().then(setBookings).catch((e) => {
      setBookings([]);
      setError(e instanceof Error ? e.message : "Could not load requests.");
    });
  };
  useEffect(load, []);

  const act = async (
    id: number,
    action: "accept" | "decline" | "complete" | "payment-received" | "braider-cancel",
    body: Record<string, unknown> = {},
  ) => {
    setError("");
    setNotice("");
    try {
      await api.bookingAction(id, action, body);
      setNotice(
        action === "accept"
          ? "Booking accepted. It is on your schedule now."
          : action === "decline"
            ? "Booking declined."
            : action === "payment-received"
              ? "Marked paid. Your client gets a receipt."
              : action === "braider-cancel"
                ? "Appointment cancelled. Your client has been told."
                : "Marked complete. Your client can now leave a review.",
      );
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not work.");
    }
  };

  const items = [...(bookings ?? [])].sort(
    (a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || a.date.localeCompare(b.date),
  );
  const reviews = profile?.reviews ?? [];

  return (
    <main className="dash-main">
      <h1>Requests</h1>
      {error && <p className="error" role="alert" style={{ marginTop: 16 }}>{error}</p>}
      {notice && <p className="notice" role="status" style={{ marginTop: 16 }}>{notice}</p>}

      <div className="dash-list">
        {bookings !== null && items.length === 0 && (
          <div className="empty-card" style={{ marginTop: 0 }}>
            <strong>No requests yet.</strong>
            <div>When a client books you, it lands here.</div>
          </div>
        )}
        {items.map((b, i) => (
          <article key={b.id} className="req-card">
            <div className="req-top">
              <div className="req-avatar" style={{ background: TINTS[i % TINTS.length] }} aria-hidden="true">
                {initials(b.client_name)}
              </div>
              <div className="req-who">
                <strong>{b.client_name}</strong>
                <div>
                  {cap(b.style_name)}, {formatDate(b.date)}, {formatTime(b.start_time)}
                </div>
              </div>
              <span className={`pill pill-${b.status}`}>{LOOK[b.status] || b.status}</span>
              <span className="req-price">{formatPrice(b.price)}</span>
            </div>
            {b.notes && <p className="req-notes">“{b.notes}”</p>}
            {b.payment_screenshot_url && (
              <p className="req-notes">
                <a href={b.payment_screenshot_url} target="_blank" rel="noreferrer">
                  See their payment screenshot
                </a>
              </p>
            )}
            <div className="req-actions">
              {b.status === "requested" && (
                <>
                  <button type="button" className="btn btn-sm" onClick={() => act(b.id, "accept")}>
                    Accept
                  </button>
                  <button type="button" className="btn btn-light btn-sm" onClick={() => act(b.id, "decline")}>
                    Decline
                  </button>
                </>
              )}
              {(b.status === "accepted" || b.status === "paid") && (
                <button type="button" className="btn btn-sm" onClick={() => act(b.id, "payment-received")}>
                  Payment received
                </button>
              )}
              {["accepted", "paid", "confirmed"].includes(b.status) && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => act(b.id, "complete")}>
                  Mark complete
                </button>
              )}
              <Link to={`/messages/${b.client_user_id}`} className="req-link">
                Message client
              </Link>
              {["accepted", "paid", "confirmed"].includes(b.status) && cancelId !== b.id && (
                <button type="button" className="link-btn danger" onClick={() => setCancelId(b.id)}>
                  Cancel appointment
                </button>
              )}
            </div>
            {cancelId === b.id && (
              <form
                className="cancel-box"
                onSubmit={(e) => {
                  e.preventDefault();
                  act(b.id, "braider-cancel", { reason: cancelWhy });
                  setCancelId(null);
                  setCancelWhy("");
                }}
              >
                <label htmlFor={`cw-${b.id}`}>Tell {b.client_name} why (they get an email)</label>
                <input id={`cw-${b.id}`} value={cancelWhy} onChange={(e) => setCancelWhy(e.target.value)} />
                <div className="req-actions" style={{ marginTop: 12 }}>
                  <button className="btn btn-danger" type="submit">
                    Cancel and tell them
                  </button>
                  <button className="btn btn-light btn-sm" type="button" onClick={() => setCancelId(null)}>
                    Keep it
                  </button>
                </div>
              </form>
            )}
          </article>
        ))}
      </div>

      <h2 className="dash-h2">Reviews</h2>
      {reviews.length === 0 ? (
        <p className="muted" style={{ marginTop: 12 }}>
          No reviews yet. They appear here after clients finish an appointment.
        </p>
      ) : (
        <div className="rv-list" style={{ marginTop: 12 }}>
          {reviews.map((r) => (
            <div key={r.id} className="rv-card">
              <div className="rv-top">
                <strong>{r.client_name.split(" ")[0]}</strong>
                <span>{new Date(r.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
              </div>
              <div className="rv-stars" role="img" aria-label={`${r.rating} out of 5 stars`}>
                {"★".repeat(r.rating)}
                <span className="dim">{"★".repeat(5 - r.rating)}</span>
              </div>
              {r.comment && <p className="rv-text">{r.comment}</p>}
              {r.braider_reply ? (
                <div className="rv-reply">
                  <strong>Your reply</strong> <span>{r.braider_reply}</span>
                </div>
              ) : replyId === r.id ? (
                <form
                  className="cancel-box"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      await api.replyToReview(r.id, replyText);
                      setReplyId(null);
                      setReplyText("");
                      load();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Could not post the reply.");
                    }
                  }}
                >
                  <label htmlFor={`rr-${r.id}`}>Your public reply</label>
                  <textarea id={`rr-${r.id}`} rows={2} value={replyText} onChange={(e) => setReplyText(e.target.value)} required />
                  <button className="btn btn-sm" type="submit" style={{ marginTop: 12 }}>
                    Post reply
                  </button>
                </form>
              ) : (
                <button className="link-btn" type="button" style={{ marginTop: 10 }} onClick={() => setReplyId(r.id)}>
                  Reply publicly
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
