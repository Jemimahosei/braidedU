import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  api,
  cap,
  formatDate,
  formatPrice,
  formatTime,
  initials,
  sized,
  SERVICE_PLACES,
  TINTS,
  todayISO,
  type Booking,
} from "../lib/api";

export const CLIENT_STATUS: Record<string, string> = {
  requested: "Requested",
  accepted: "Accepted",
  paid: "Paid",
  confirmed: "Confirmed",
  completed: "Completed",
  declined: "Declined",
  cancelled: "Cancelled",
};

/** The braider's photo (or initials on a tint), as a round avatar at a given size. */
export function PersonDot({
  name,
  src,
  size,
  id,
  faded,
}: {
  name: string;
  src?: string;
  size: number;
  id: number;
  faded?: boolean;
}) {
  const style = { width: size, height: size, opacity: faded ? 0.6 : 1 };
  return src ? (
    <img className="bk-dot" style={style} src={sized(src, size * 2)} alt={name} />
  ) : (
    <span className="bk-dot" style={{ ...style, background: TINTS[id % TINTS.length] }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

const LIVE = ["requested", "accepted", "paid", "confirmed"];
type Tab = "up" | "past" | "canc";

/** Client bookings, with cancel and reschedule (mockup: Bookings.dc.html). */
export default function ClientDashboard() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [tab, setTab] = useState<Tab>("up");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [askCancel, setAskCancel] = useState<number | null>(null);
  const [moveFor, setMoveFor] = useState<number | null>(null);
  const [moveDate, setMoveDate] = useState("");
  const [moveSlots, setMoveSlots] = useState<string[] | null>(null);
  const [moveTime, setMoveTime] = useState("");

  const load = () => {
    api
      .bookings()
      .then(setBookings)
      .catch((e) => {
        setBookings([]);
        setError(e instanceof Error ? e.message : "Could not load bookings.");
      });
  };
  useEffect(load, []);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setError("");
    setNotice("");
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
    setMoveTime("");
    setMoveSlots(null);
    if (d) api.slots(b.braider_id, String(b.listing), d).then((r) => setMoveSlots(r.slots)).catch(() => setMoveSlots([]));
  };

  const all = bookings ?? [];
  const upcoming = all.filter((b) => LIVE.includes(b.status));
  const past = all.filter((b) => b.status === "completed");
  const cancelled = all.filter((b) => b.status === "cancelled" || b.status === "declined");
  const tabs: [Tab, string][] = [
    ["up", "Upcoming"],
    ["past", "Past"],
    ["canc", "Cancelled"],
  ];

  const upCard = (b: Booking) => {
    const free = new Date(b.cancel_deadline);
    const inside = free.getTime() > Date.now();
    const when = free.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const place = b.place === "my_place" ? `${b.braider_name}'s place` : SERVICE_PLACES[b.place] || "";
    return (
      <section key={b.id} className="bk-card">
        <div className="bk-top">
          <PersonDot name={b.braider_name} src={b.braider_photo_url} size={64} id={b.braider_id} />
          <div className="bk-who">
            <div className="bk-name">{b.braider_name}</div>
            <div>
              {cap(b.style_name)}, {formatDate(b.date)}, {formatTime(b.start_time)}
            </div>
          </div>
          <span className={`pill pill-${b.status}`}>{CLIENT_STATUS[b.status]}</span>
        </div>
        <div className="bk-grid">
          {(place || b.address) && (
            <>
              <span>Where</span>
              <span>
                {place}
                {place && b.address ? ". " : ""}
                {b.address}
              </span>
            </>
          )}
          <span>Cancel</span>
          <span>
            {inside ? `Free until ${when}, ${b.cancel_window_hours} hours before` : `Past the free window. ${b.braider_name} may keep any deposit`}
          </span>
          {b.notes && (
            <>
              <span>Notes</span>
              <span>“{b.notes}”</span>
            </>
          )}
        </div>
        <div className="bk-actions">
          {(b.status === "accepted" || b.status === "paid" || b.status === "confirmed") && (
            <Link to={`/bookings/${b.id}`} className="btn btn-sm">
              {b.status === "accepted" ? `Pay ${b.braider_name}` : "View booking"}
            </Link>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setMoveFor(moveFor === b.id ? null : b.id);
              setAskCancel(null);
              setMoveDate("");
              setMoveSlots(null);
              setMoveTime("");
            }}
          >
            Reschedule
          </button>
          {askCancel !== b.id && (
            <button type="button" className="bk-cancel" onClick={() => { setAskCancel(b.id); setMoveFor(null); }}>
              Cancel booking
            </button>
          )}
          <Link to={`/messages/${b.braider_user_id}`} style={{ fontWeight: 600 }}>
            Message {b.braider_name}
          </Link>
        </div>
        {askCancel === b.id && (
          <div className="bk-confirm">
            <strong>Cancel this booking?</strong>
            <div>
              {b.braider_name} gets a message right away.{" "}
              {inside ? "You're inside her free cancel window." : "You're past her free cancel window, so she may keep any deposit."}
            </div>
            <div className="bk-actions" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => run(() => api.bookingAction(b.id, "cancel"), "Booking cancelled.").then(() => setAskCancel(null))}
              >
                Yes, cancel
              </button>
              <button type="button" className="btn btn-light" onClick={() => setAskCancel(null)}>
                Keep it
              </button>
            </div>
          </div>
        )}
        {moveFor === b.id && (
          <div className="bk-resch">
            <strong>Pick a new time</strong>
            <div className="field" style={{ marginTop: 10, maxWidth: 240 }}>
              <label htmlFor={`mv-${b.id}`} className="sr-only">New date</label>
              <input id={`mv-${b.id}`} type="date" min={todayISO()} value={moveDate} onChange={(e) => pickMoveDate(b, e.target.value)} />
            </div>
            {moveDate && moveSlots === null && <p className="hint" style={{ marginTop: 10 }}>Loading times…</p>}
            {moveDate && moveSlots?.length === 0 && <p className="hint" style={{ marginTop: 10 }}>No times open that day.</p>}
            <div className="slot-row" style={{ marginTop: 10 }}>
              {moveSlots?.map((t) => (
                <button key={t} type="button" className="slot on-soft" aria-pressed={moveTime === t} onClick={() => setMoveTime(t)}>
                  {formatTime(t).replace("AM", "am").replace("PM", "pm")}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn"
              style={{ marginTop: 12 }}
              disabled={!moveTime}
              onClick={() =>
                run(() => api.reschedule(b.id, moveDate, moveTime), `Sent to ${b.braider_name}. Your current time stays until she accepts.`).then(() => setMoveFor(null))
              }
            >
              Send new time
            </button>
          </div>
        )}
      </section>
    );
  };

  return (
    <main className="dash-main bk-main">
      <h1>My bookings</h1>
      <div className="bk-tabs" role="tablist" aria-label="Bookings">
        {tabs.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>
      {error && <p className="error" role="alert" style={{ marginTop: 16 }}>{error}</p>}
      {notice && <p className="notice" role="status" style={{ marginTop: 16 }}>{notice}</p>}

      {tab === "up" &&
        (bookings !== null && upcoming.length === 0 ? (
          <section className="bk-empty">
            <strong>Nothing booked yet.</strong>
            <div>Pick a style and see who does it.</div>
            <Link to="/browse" className="btn">
              Find a braider
            </Link>
          </section>
        ) : (
          upcoming.map(upCard)
        ))}

      {tab === "past" &&
        (bookings !== null && past.length === 0 ? (
          <section className="bk-empty small">No past bookings.</section>
        ) : (
          past.map((b) => (
            <section key={b.id} className="bk-card">
              <div className="bk-top">
                <PersonDot name={b.braider_name} src={b.braider_photo_url} size={64} id={b.braider_id} />
                <div className="bk-who">
                  <div className="bk-name">{b.braider_name}</div>
                  <div>
                    {cap(b.style_name)}, {formatDate(b.date)}
                  </div>
                </div>
                <span className="bk-name">{formatPrice(b.price)}</span>
              </div>
              <div className="bk-actions" style={{ gap: 14, marginTop: 18 }}>
                <Link to={`/braiders/${b.braider_id}`} className="btn">
                  Leave a review
                </Link>
                {b.payment_confirmed_at && (
                  <Link to={`/bookings/${b.id}`} style={{ fontWeight: 600 }}>
                    Receipt #{b.id}
                  </Link>
                )}
                <Link to={`/braiders/${b.braider_id}`} style={{ fontWeight: 600 }}>
                  Book again
                </Link>
              </div>
            </section>
          ))
        ))}

      {tab === "canc" &&
        (bookings !== null && cancelled.length === 0 ? (
          <section className="bk-empty small">No cancelled bookings.</section>
        ) : (
          cancelled.map((b) => (
            <section key={b.id} className="bk-card">
              <div className="bk-top">
                <PersonDot name={b.braider_name} src={b.braider_photo_url} size={64} id={b.braider_id} faded />
                <div className="bk-who">
                  <div className="bk-name">{b.braider_name}</div>
                  <div>
                    {cap(b.style_name)}, {formatDate(b.date)},{" "}
                    {b.status === "declined" ? "declined" : `cancelled by ${b.cancelled_by === "braider" ? b.braider_name : "you"}`}
                    {b.cancel_reason ? `: ${b.cancel_reason}` : ""}
                  </div>
                </div>
                <span className={`pill pill-${b.status}`}>{CLIENT_STATUS[b.status]}</span>
              </div>
            </section>
          ))
        ))}
    </main>
  );
}
