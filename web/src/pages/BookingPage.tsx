import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { api, cap, formatDate, formatPrice, formatTime, SERVICE_PLACES, type Booking } from "../lib/api";
import { useAuth } from "../lib/auth";
import { PhotoField } from "../components/PhotoField";
import { CLIENT_STATUS, PersonDot } from "./ClientDashboard";

type Receipt = Awaited<ReturnType<typeof api.receipt>>;
const STEPS = ["requested", "accepted", "paid", "confirmed"];

/** One booking: progress, details, how to pay, receipt (mockup: Booking.dc.html). */
export default function BookingPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [b, setB] = useState<Booking | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [shot, setShot] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [askCancel, setAskCancel] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => {
    if (!id) return;
    api.booking(id).then(setB).catch((e) => setError(e instanceof Error ? e.message : "Could not load this booking."));
  };
  useEffect(load, [id]);

  useEffect(() => {
    if (b && (b.status === "confirmed" || b.status === "completed") && b.payment_confirmed_at) {
      api.receipt(b.id).then(setReceipt).catch(() => setReceipt(null));
    }
  }, [b]);

  if (!user) return <Navigate to={`/login?next=/bookings/${id}`} replace />;

  if (error) return <main className="dash-main"><h1>Your booking</h1><p className="error" style={{ marginTop: 16 }}>{error}</p></main>;
  if (!b) return <main className="dash-main"><h1>Your booking</h1><p className="muted" style={{ marginTop: 16 }}>Loading…</p></main>;

  const mine =
    user.user_id != null ? user.user_id === b.client_user_id : user.role === "client";
  const step = STEPS.indexOf(b.status === "completed" ? "confirmed" : b.status);
  const place = b.place === "my_place" ? `${b.braider_name}'s place` : SERVICE_PLACES[b.place] || "";
  const free = new Date(b.cancel_deadline).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const venmoHref = b.pay?.venmo ? `https://venmo.com/u/${b.pay.venmo.replace(/^@/, "")}` : "";

  const markPaid = async () => {
    setError("");
    try {
      setB(await api.markPaid(b.id, shot[0] || ""));
      setShot([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
    }
  };

  /** The braider's actions on this booking, from her side of the page. */
  const braiderAct = async (action: "accept" | "decline" | "payment-received") => {
    setError("");
    setBusy(true);
    try {
      setB(await api.bookingAction(b.id, action));
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setError("");
    setBusy(true);
    try {
      await api.bookingAction(b.id, "cancel");
      navigate("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
      setBusy(false);
    }
  };

  const download = () => {
    if (!receipt) return;
    const text = [
      `braidedU receipt #${receipt.receipt_no}`,
      `Braider: ${receipt.braider}`,
      `Style: ${receipt.service}`,
      `Appointment: ${formatDate(receipt.date)}, ${formatTime(receipt.start_time)}`,
      `Paid on: ${formatDate(receipt.paid_on.slice(0, 10))}`,
      `Total: $${Number(receipt.amount).toFixed(2)}`,
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    a.download = `braidedu-receipt-${receipt.receipt_no}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <main className="dash-main">
      <h1>Your booking</h1>

      {["declined", "cancelled"].includes(b.status) ? (
        <div className="steps-row">
          <span className={`pill pill-${b.status}`}>{CLIENT_STATUS[b.status]}</span>
        </div>
      ) : (
        <div className="steps-row" aria-label="Progress">
          {STEPS.map((s, i) => (
            <span key={s} className="step-pill" aria-current={i === step ? "step" : undefined} data-done={i <= step}>
              {CLIENT_STATUS[s]}
            </span>
          ))}
        </div>
      )}

      <section className="bk-card big">
        <div className="bk-top" style={{ gap: 16 }}>
          <PersonDot name={mine ? b.braider_name : b.client_name} src={mine ? b.braider_photo_url : undefined} size={64} id={mine ? b.braider_id : b.client} />
          <div className="bk-who" style={{ flex: 1 }}>
            <div className="bk-name">{mine ? b.braider_name : b.client_name}</div>
            <div>
              {cap(b.style_name)}, {formatDate(b.date)}, {formatTime(b.start_time)}
            </div>
          </div>
          <div className="bk-name" style={{ fontSize: 30 }}>{formatPrice(b.price)}</div>
        </div>
        <div className="bk-grid">
          <span>Where</span>
          <span>
            {place || "To be agreed"}
            {b.address ? `. ${b.address}` : b.place === "my_place" || !b.place ? `. Address shared once ${b.braider_name} accepts.` : ""}
          </span>
          <span>Cancel</span>
          <span>Free until {free}, {b.cancel_window_hours} hours before</span>
          {b.pay?.deposit_note && (
            <>
              <span>Deposit</span>
              <span>
                {b.pay.deposit_note}
                {/^\$\d+/.test(b.pay.deposit_note) ? ", part of the total" : ""}
              </span>
            </>
          )}
          <span>Reminder</span>
          <span>We email you both the day before</span>
          {b.notes && (
            <>
              <span>Notes</span>
              <span>“{b.notes}”</span>
            </>
          )}
        </div>
      </section>

      {mine && b.status === "accepted" && b.pay && (
        <section className="bk-card big">
          <h2 className="bk-h2">Pay {b.braider_name}</h2>
          <p className="bk-lede">
            Goes straight to her. Venmo and Zelle can't refund you if something goes wrong.
          </p>
          <div className="pay-grid">
            {b.pay.venmo &&
              (venmoHref ? (
                <a href={venmoHref} target="_blank" rel="noreferrer" className="pay-tile venmo">
                  <strong>Venmo</strong>
                  <span>{b.pay.venmo}</span>
                </a>
              ) : null)}
            {b.pay.zelle && (
              <div className="pay-tile">
                <strong>Zelle</strong>
                <span>{b.pay.zelle}</span>
              </div>
            )}
          </div>
          <div style={{ marginTop: 18, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            <PhotoField kind="reference" urls={shot} onChange={setShot} variant="slots" label="Add a screenshot" max={1} />
            <button type="button" className="btn" onClick={markPaid}>
              I've paid
            </button>
          </div>
        </section>
      )}

      {mine && b.status === "paid" && (
        <section className="bk-wait">
          <strong>Waiting for {b.braider_name} to confirm she got it.</strong>
        </section>
      )}

      {receipt && (
        <section className="bk-card big">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h2 className="bk-h2" style={{ margin: 0 }}>Receipt</h2>
            <span style={{ color: "var(--ink-3)", fontSize: 15 }}>#{receipt.receipt_no}</span>
          </div>
          <div className="bk-grid" style={{ gap: "8px 24px" }}>
            <span>Braider</span>
            <span>{receipt.braider}</span>
            <span>Style</span>
            <span>{cap(receipt.service)}</span>
            <span>Appointment</span>
            <span>
              {formatDate(receipt.date)}, {formatTime(receipt.start_time)}
            </span>
            <span>Paid on</span>
            <span>{formatDate(receipt.paid_on.slice(0, 10))}</span>
            <strong style={{ color: "var(--ink)" }}>Total</strong>
            <strong>${Number(receipt.amount).toFixed(2)}</strong>
          </div>
          <button type="button" className="btn btn-ink" style={{ marginTop: 18, padding: "12px 24px" }} onClick={download}>
            Download receipt
          </button>
        </section>
      )}

      {!mine && (
        <section className="bk-wait">
          <strong>{b.braider_name}'s view</strong>
          <div className="bk-actions" style={{ marginTop: 12 }}>
            {b.status === "requested" && (
              <>
                <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => braiderAct("accept")}>
                  Accept request
                </button>
                <button type="button" className="link-btn danger" disabled={busy} onClick={() => braiderAct("decline")}>
                  Decline
                </button>
              </>
            )}
            {b.status === "paid" && (
              <button type="button" className="btn" disabled={busy} onClick={() => braiderAct("payment-received")}>
                Payment received
              </button>
            )}
            {b.status === "accepted" && <span className="muted">Waiting for the client to pay.</span>}
            <Link to={`/messages/${b.client_user_id}`} style={{ fontWeight: 600 }}>
              Message {b.client_name}
            </Link>
          </div>
        </section>
      )}

      {mine && ["requested", "accepted", "paid", "confirmed"].includes(b.status) && !askCancel && (
        <button type="button" className="phone-cancel" onClick={() => setAskCancel(true)}>
          Cancel booking
        </button>
      )}
      {mine && askCancel && (
        <div className="bk-confirm">
          <strong>Cancel this booking?</strong>
          <div>
            {b.braider_name} gets a message right away.{" "}
            {new Date(b.cancel_deadline).getTime() > Date.now()
              ? "You're inside her free cancel window."
              : "You're past her free cancel window, so she may keep any deposit."}
          </div>
          <div className="bk-actions" style={{ marginTop: 12 }}>
            <button type="button" className="btn btn-danger" disabled={busy} onClick={cancel}>
              Yes, cancel
            </button>
            <button type="button" className="btn btn-light" onClick={() => setAskCancel(false)}>
              Keep it
            </button>
          </div>
        </div>
      )}
      <p style={{ marginTop: 24 }}>
        <Link to="/dashboard" style={{ fontWeight: 600 }}>
          {mine ? "Back to my bookings" : "Back to requests"}
        </Link>
      </p>
    </main>
  );
}
