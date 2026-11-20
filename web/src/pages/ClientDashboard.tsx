import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatDate, formatPrice, formatTime, todayISO, SERVICE_PLACES, type Booking } from "../lib/api";
import { StatusPill } from "../components/ui";
import { PhotoField } from "../components/PhotoField";

export default function ClientDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reviewFor, setReviewFor] = useState<number | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [shot, setShot] = useState<string[]>([]);
  const [moveFor, setMoveFor] = useState<number | null>(null);
  const [moveDate, setMoveDate] = useState("");
  const [moveSlots, setMoveSlots] = useState<string[] | null>(null);
  const [receipt, setReceipt] = useState<Awaited<ReturnType<typeof api.receipt>> | null>(null);
  const [reviewPhotos, setReviewPhotos] = useState<string[]>([]);

  const load = () => {
    api
      .bookings()
      .then(setBookings)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load bookings."));
  };
  useEffect(load, []);

  const cancel = async (id: number) => {
    setError("");
    try {
      await api.bookingAction(id, "cancel");
      setNotice("Booking cancelled.");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel failed.");
    }
  };

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setError("");
    try {
      await fn();
      setNotice(ok);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
    }
  };

  const pickMoveDate = (b: Booking, d: string) => {
    setMoveDate(d);
    setMoveSlots(null);
    if (d) api.slots(b.braider_id, String(b.listing), d).then((r) => setMoveSlots(r.slots)).catch(() => setMoveSlots([]));
  };

  const submitReview = async (id: number) => {
    setError("");
    try {
      await api.reviewBooking(id, rating, comment, reviewPhotos);
      setNotice("Review posted. Thank you.");
      setReviewFor(null);
      setComment("");
      setReviewPhotos([]);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed.");
    }
  };

  const live = ["requested", "accepted", "paid", "confirmed"];
  const upcoming = bookings.filter((b) => live.includes(b.status));
  const past = bookings.filter((b) => !live.includes(b.status));

  const bookingCard = (b: Booking) => (
    <article key={b.id} className="card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
        <h3>
          <Link to={`/braiders/${b.braider_id}`}>{b.braider_name}</Link>
        </h3>
        <StatusPill status={b.status} />
      </div>
      <div className="meta">
        {b.listing_title}, {b.style_name}
      </div>
      <div>
        {formatDate(b.date)}, {formatTime(b.start_time)} to {formatTime(b.end_time)}.{" "}
        {formatPrice(b.price)}
      </div>
      {b.notes && <p className="muted">“{b.notes}”</p>}
      {b.place && <div className="meta">{SERVICE_PLACES[b.place] || b.place}</div>}
      {b.status === "cancelled" && (
        <p className="muted">
          Cancelled by {b.cancelled_by === "braider" ? b.braider_name : "you"}
          {b.cancel_reason ? `: ${b.cancel_reason}` : ""}
        </p>
      )}
      {b.status === "accepted" && b.pay && (
        <div className="panel soft stack">
          <strong>Pay {b.braider_name} to hold your spot</strong>
          <dl className="kv">
            {b.pay.venmo && (<><dt>Venmo</dt><dd>{b.pay.venmo}</dd></>)}
            {b.pay.zelle && (<><dt>Zelle</dt><dd>{b.pay.zelle}</dd></>)}
            {b.pay.deposit_note && (<><dt>Deposit</dt><dd>{b.pay.deposit_note}</dd></>)}
            <dt>Total</dt><dd>{formatPrice(b.price)}</dd>
          </dl>
          <p className="muted">
            Venmo and Zelle have no buyer protection. Only pay the handle shown here, and send it
            to friends and family, not as a purchase.
          </p>
          <div>
            <label>Screenshot of your payment (optional)</label>
            <PhotoField kind="reference" urls={shot} onChange={setShot} label="Add" />
          </div>
          <button className="btn btn-sm" type="button" onClick={() => run(() => api.markPaid(b.id, shot[0] || ""), "Thanks. We told your braider to check.").then(() => setShot([]))}>
            I've paid
          </button>
        </div>
      )}
      {b.status === "paid" && <p className="notice">Waiting for {b.braider_name} to confirm your payment.</p>}
      {b.address && ["accepted", "paid", "confirmed"].includes(b.status) && (
        <p><strong>Where:</strong> {b.address}</p>
      )}
      {(b.status === "confirmed" || b.status === "completed") && b.payment_confirmed_at && (
        <button className="link-btn" type="button" onClick={() => api.receipt(b.id).then(setReceipt).catch(() => setError("Could not load the receipt."))}>
          View receipt
        </button>
      )}
      {receipt && receipt.receipt_no === b.id && (
        <div className="panel soft">
          <strong>Receipt #{receipt.receipt_no}</strong>
          <dl className="kv" style={{ marginTop: "0.5rem" }}>
            <dt>Service</dt><dd>{receipt.service}</dd>
            <dt>Braider</dt><dd>{receipt.braider}</dd>
            <dt>When</dt><dd>{formatDate(receipt.date)}, {formatTime(receipt.start_time)}</dd>
            <dt>Paid</dt><dd>${Number(receipt.amount).toFixed(2)}</dd>
          </dl>
        </div>
      )}
      <div className="grow" />
      <div className="row" style={{ gap: "0.5rem" }}>
        <Link to={`/messages/${b.braider_user_id}`} className="btn btn-light btn-sm">
          Message
        </Link>
        {live.includes(b.status) && (
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setMoveFor(moveFor === b.id ? null : b.id)}>
            Change time
          </button>
        )}
        {live.includes(b.status) && (
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => cancel(b.id)}>
            Cancel booking
          </button>
        )}
        {b.status === "completed" && reviewFor !== b.id && (
          <button className="btn btn-sm" type="button" onClick={() => setReviewFor(b.id)}>
            Leave a review
          </button>
        )}
      </div>
      {live.includes(b.status) && (
        <p className="muted">
          Free to cancel or move until {new Date(b.cancel_deadline).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.
          After that, {b.braider_name} may keep any deposit.
        </p>
      )}
      {moveFor === b.id && (
        <div className="stack">
          <div>
            <label htmlFor={`mv-${b.id}`}>New date</label>
            <input id={`mv-${b.id}`} type="date" min={todayISO()} value={moveDate} onChange={(e) => pickMoveDate(b, e.target.value)} />
          </div>
          {moveDate && moveSlots === null && <p className="muted">Loading times…</p>}
          {moveDate && moveSlots?.length === 0 && <p className="muted">No times open that day.</p>}
          <div className="chip-row">
            {moveSlots?.map((t) => (
              <button key={t} type="button" className="chip" onClick={() => run(() => api.reschedule(b.id, moveDate, t), "Asked to move it. She will confirm the new time.").then(() => setMoveFor(null))}>
                {formatTime(t)}
              </button>
            ))}
          </div>
        </div>
      )}
      {reviewFor === b.id && (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            submitReview(b.id);
          }}
        >
          <div>
            <label>Rating</label>
            <div className="chip-row">
              {[5, 4, 3, 2, 1].map((n) => (
                <button
                  key={n}
                  type="button"
                  className="chip"
                  aria-pressed={rating === n}
                  onClick={() => setRating(n)}
                >
                  {"★".repeat(n)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor={`c-${b.id}`}>What should the next person know?</label>
            <textarea
              id={`c-${b.id}`}
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Neat parts, on time, gentle hands"
            />
          </div>
          <div>
            <label>Photos of the finished look (optional)</label>
            <PhotoField kind="review" urls={reviewPhotos} onChange={setReviewPhotos} max={4} />
          </div>
          <button className="btn btn-sm" type="submit">
            Post review
          </button>
        </form>
      )}
    </article>
  );

  return (
    <div className="page">
      <div className="wrap">
        <h1>Your appointments</h1>
        {error && <p className="error" style={{ marginTop: "1rem" }}>{error}</p>}
        {notice && <p className="notice" style={{ marginTop: "1rem" }}>{notice}</p>}
        <h2 style={{ marginTop: "1.5rem" }}>Upcoming</h2>
        {upcoming.length === 0 ? (
          <p className="muted">
            Nothing booked yet. <Link to="/browse">Find a braider</Link>
          </p>
        ) : (
          <div className="grid" style={{ marginTop: "1rem" }}>{upcoming.map(bookingCard)}</div>
        )}
        <h2 style={{ marginTop: "2rem" }}>Past</h2>
        {past.length === 0 ? (
          <p className="muted">No past appointments.</p>
        ) : (
          <div className="grid" style={{ marginTop: "1rem" }}>{past.map(bookingCard)}</div>
        )}
        <p className="muted" style={{ marginTop: "1rem" }}>
          Reviews open once your braider marks a booking complete.
        </p>
      </div>
    </div>
  );
}
