import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, cap, formatDate, formatPrice, sized, TINTS, type Booking, type Listing } from "../lib/api";

const hrs = (m: number) => {
  const h = Math.round((m / 60) * 10) / 10;
  return `${h} ${h === 1 ? "hr" : "hrs"}`;
};

/** Braider postings and earnings (mockup: Postings.dc.html). */
export default function Postings() {
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [asking, setAsking] = useState<number | null>(null);
  const [error, setError] = useState("");

  const load = () => {
    api.myListings().then(setListings).catch(() => setListings([]));
    api.bookings().then(setBookings).catch(() => setBookings([]));
  };
  useEffect(load, []);

  const toggle = async (l: Listing) => {
    setError("");
    try {
      await api.updateListing(l.id, { is_active: !l.is_active });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the posting.");
    }
  };
  const remove = async (l: Listing) => {
    setError("");
    try {
      await api.deleteListing(l.id);
      setAsking(null);
      load();
    } catch (e) {
      setAsking(null);
      setError(e instanceof Error ? e.message : "Could not delete the posting.");
    }
  };

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const paid = bookings.filter((b) => b.status === "confirmed" || b.status === "completed");
  const thisMonth = paid.filter((b) => b.date.startsWith(monthKey)).reduce((n, b) => n + Number(b.price), 0);
  const braided = bookings.filter((b) => b.status === "completed").length;
  const waiting = bookings.filter((b) => b.status === "accepted" || b.status === "paid").reduce((n, b) => n + Number(b.price), 0);
  const receipts = [...paid].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  return (
    <main className="dash-main wide">
      <div className="dash-head">
        <h1>Postings</h1>
        <Link to="/postings/new" className="btn">
          New posting
        </Link>
      </div>

      <div className="stat-row">
        <div className="stat">
          <div>This month</div>
          <b>{formatPrice(thisMonth)}</b>
        </div>
        <div className="stat">
          <div>Braided</div>
          <b>{braided}</b>
        </div>
        <div className="stat">
          <div>Waiting on payment</div>
          <b>{formatPrice(waiting)}</b>
        </div>
      </div>

      {error && <p className="error" role="alert" style={{ marginTop: 16 }}>{error}</p>}

      <div className="dash-list" style={{ marginTop: 22 }}>
        {listings?.map((l, i) => (
          <article key={l.id} className="post-row" style={{ opacity: l.is_active ? 1 : 0.7 }}>
            <div className="post-thumb" style={{ background: TINTS[i % TINTS.length] }}>
              {l.photo_url && <img src={sized(l.photo_url, 160)} alt="" />}
            </div>
            <div className="post-info">
              <div style={{ fontWeight: 600 }}>
                {cap(l.style_name)}
                {l.title && l.title.toLowerCase() !== l.style_name.toLowerCase() ? `: ${l.title}` : ""}
              </div>
              <div className="work-price">
                <span>{formatPrice(l.price)}</span>
                <small>{hrs(l.duration_minutes)}</small>
              </div>
            </div>
            <button type="button" className="switch" aria-pressed={l.is_active} onClick={() => toggle(l)}>
              <i />
              <span>{l.is_active ? "Taking bookings" : "Unavailable"}</span>
            </button>
            <Link to={`/postings/${l.id}/edit`} style={{ fontWeight: 600 }}>
              Edit
            </Link>
            {asking === l.id ? (
              <span className="post-ask">
                <span>Delete this posting?</span>
                <button type="button" className="btn btn-danger btn-xs" onClick={() => remove(l)}>
                  Delete
                </button>
                <button type="button" className="btn btn-light btn-xs" onClick={() => setAsking(null)}>
                  Keep
                </button>
              </span>
            ) : (
              <button type="button" className="link-btn danger nounder" onClick={() => setAsking(l.id)}>
                Delete
              </button>
            )}
          </article>
        ))}
        {listings !== null && listings.length === 0 && (
          <div className="empty-card" style={{ marginTop: 0, padding: 32 }}>
            <strong style={{ fontSize: 17 }}>No postings yet.</strong>
            <div>Add your first style and clients can start booking.</div>
            <Link to="/postings/new" className="btn" style={{ marginTop: 14 }}>
              New posting
            </Link>
          </div>
        )}
      </div>

      <h2 className="dash-h2">Recent receipts</h2>
      <div className="receipt-card">
        {receipts.length === 0 && <p className="muted" style={{ padding: "14px 0" }}>Receipts show up here once a client has paid.</p>}
        {receipts.map((b) => (
          <div key={b.id} className="receipt-line">
            <span>
              <strong>{b.client_name}</strong>{" "}
              <span style={{ color: "var(--ink-3)" }}>
                {cap(b.style_name)}, {formatDate(b.date)}
              </span>
            </span>
            <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{formatPrice(b.price)}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
