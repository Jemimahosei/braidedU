import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  api,
  cap,
  campusLabel,
  formatDate,
  formatPrice,
  formatTime,
  hasClient,
  todayISO,
  WEEKDAYS,
  sized,
  TINTS,
  type Booking,
  type Braider,
  type Listing,
  type Review,
} from "../lib/api";
import { useAuth } from "../lib/auth";
import { Avatar } from "../components/ui";
import { PhotoField } from "../components/PhotoField";
import { ReportForm, useSafety, SafetyMenu } from "../components/SafetyMenu";

const hrs = (m: number) => {
  const h = Math.round((m / 60) * 10) / 10;
  return `${h} ${h === 1 ? "hr" : "hrs"}`;
};

const instagramUrl = (h: string) =>
  /^https?:\/\//.test(h) ? h : `https://instagram.com/${h.replace(/^@/, "").replace(/^instagram\.com\//, "")}`;

const monthOf = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });

/** Five stars, the ones beyond the rating dimmed. */
function StarRow({ rating }: { rating: number }) {
  return (
    <div className="rv-stars" role="img" aria-label={`${rating} out of 5 stars`}>
      {"★".repeat(rating)}
      <span className="dim">{"★".repeat(5 - rating)}</span>
    </div>
  );
}

/** One review on a braider's page: style and month, the reply, and a Report link. */
function ReviewCard({ r, braiderName }: { r: Review; braiderName: string }) {
  const first = r.client_name.split(" ")[0];
  const s = useSafety(r.client_user_id, first, undefined, undefined, `Review on ${braiderName}'s page.`);
  return (
    <div className="rv-card">
      <div className="rv-top">
        <strong>{first}</strong>
        <span>
          {r.style_name ? `${cap(r.style_name)}, ` : ""}
          {monthOf(r.created_at)}{" "}
          <button type="button" className="text-btn" onClick={() => s.setOpen(!s.open)}>
            Report
          </button>
        </span>
      </div>
      <StarRow rating={r.rating} />
      {r.comment && <p className="rv-text">{r.comment}</p>}
      {r.braider_reply && (
        <div className="rv-reply">
          <strong>{braiderName} replied</strong> <span>{r.braider_reply}</span>
        </div>
      )}
      {r.photo_urls?.length > 0 && (
        <div className="rv-photos">
          {r.photo_urls.map((u) => (
            <a key={u} href={u} target="_blank" rel="noreferrer">
              <img src={sized(u, 240)} alt="Photo from this review" loading="lazy" />
            </a>
          ))}
        </div>
      )}
      <ReportForm userId={r.client_user_id} s={s} />
      {s.msg && (
        <p className="notice" role="status" style={{ marginTop: 10 }}>
          {s.msg}
        </p>
      )}
    </div>
  );
}

function ReviewForm({
  braider,
  booking,
  onPosted,
}: {
  braider: Braider;
  booking: Booking | null;
  onPosted: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking) return;
    setErr("");
    try {
      await api.reviewBooking(booking.id, rating, text, photos);
      setDone(true);
      onPosted();
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Review failed.");
    }
  };

  return (
    <form className="review-form" onSubmit={submit}>
      <h3>Leave a review</h3>
      <div className="star-pick" role="group" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            aria-pressed={n <= rating}
            style={n <= rating ? { background: "var(--sand)" } : undefined}
            onClick={() => setRating(n)}
          >
            ★
          </button>
        ))}
      </div>
      <label htmlFor="rv-text">Your review</label>
      <textarea
        id="rv-text"
        rows={3}
        value={text}
        placeholder={`What should the next person know about ${braider.display_name}?`}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="review-actions">
        <PhotoField kind="review" urls={photos} onChange={setPhotos} max={4} variant="slots" label="Add photos" />
        <button type="submit" className="btn" disabled={!booking || rating === 0 || done}>
          Post review
        </button>
      </div>
      {err && <p className="error" role="alert">{err}</p>}
      {done && <p className="notice" role="status">Review posted. Thank you.</p>}
      <p className="form-note">Only people with a completed booking can review.</p>
    </form>
  );
}

export default function BraiderDetail() {
  const { id } = useParams();
  const [braider, setBraider] = useState<Braider | null>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"book" | "custom">("book");
  const [panelOpen, setPanelOpen] = useState(false);
  const [listingId, setListingId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState<string[] | null>(null);
  const [notes, setNotes] = useState("");
  const [place, setPlace] = useState("");
  const [bookingMsg, setBookingMsg] = useState("");
  const [bookingErr, setBookingErr] = useState("");
  const [mine, setMine] = useState<Booking[]>([]);
  const [customText, setCustomText] = useState("");
  const [customBudget, setCustomBudget] = useState("");
  const [customPhoto, setCustomPhoto] = useState<string[]>([]);
  const [customMsg, setCustomMsg] = useState("");
  const [customErr, setCustomErr] = useState("");
  const { user } = useAuth();
  const navigate = useNavigate();

  const load = () => {
    if (!id) return;
    api
      .braider(id)
      .then((b) => {
        setBraider(b);
        const first = b.listings.find((l) => l.is_active);
        setListingId((cur) => cur || (first ? String(first.id) : ""));
        setPlace((cur) => cur || b.service_places?.[0] || "");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load this braider."));
  };
  useEffect(load, [id]);

  // A client with a finished booking here can review it from this page.
  useEffect(() => {
    if (user?.role !== "client" || !id) {
      setMine([]);
      return;
    }
    api.bookings("completed").then((r) => setMine(r.filter((b) => String(b.braider_id) === id))).catch(() => setMine([]));
  }, [user, id]);

  useEffect(() => {
    setTime("");
    if (!id || !listingId || !date) {
      setSlots(null);
      return;
    }
    let live = true;
    api
      .slots(id, listingId, date)
      .then((r) => live && setSlots(r.slots))
      .catch(() => live && setSlots([]));
    return () => {
      live = false;
    };
  }, [id, listingId, date]);

  const book = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingErr("");
    setBookingMsg("");
    if (!user) {
      navigate(`/login?next=/braiders/${id}`);
      return;
    }
    if (!hasClient(user)) {
      setBookingErr("Only client accounts can book. Log in as a client to request this appointment.");
      return;
    }
    try {
      const booking = await api.createBooking({
        listing: Number(listingId),
        date,
        start_time: time,
        notes,
        place,
      });
      setBookingMsg(
        `Request sent for ${formatDate(booking.date)} at ${formatTime(booking.start_time)}. ${braider?.display_name} will accept or decline. Watch your bookings for the answer.`,
      );
    } catch (err) {
      setBookingErr(err instanceof Error ? err.message : "Booking failed.");
    }
  };

  const sendCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomErr("");
    setCustomMsg("");
    if (!user) {
      navigate(`/login?next=/braiders/${id}`);
      return;
    }
    if (!hasClient(user)) {
      setCustomErr("Only client accounts can send a custom request.");
      return;
    }
    try {
      const body = `Custom request: ${customText.trim()}${customBudget ? `\nBudget: $${customBudget}` : ""}`;
      await api.sendMessage(braider!.user_id, body, customPhoto[0] || "");
      setCustomMsg(`Sent. ${braider!.display_name} can reply with a price in Messages.`);
      setCustomText("");
      setCustomBudget("");
      setCustomPhoto([]);
    } catch (err) {
      setCustomErr(err instanceof Error ? err.message : "Could not send.");
    }
  };

  if (error) return <main className="wrap profile-wrap"><p className="error">{error}</p></main>;
  if (!braider) return <main className="wrap profile-wrap"><p className="muted">Loading…</p></main>;

  const name = braider.display_name;
  const activeListings = braider.listings.filter((l) => l.is_active);
  const chosen: Listing | undefined = activeListings.find((l) => String(l.id) === listingId);
  const days = braider.available_days.map((d) => WEEKDAYS[d] || d).join(", ");
  const reviewed = new Set(braider.reviews.map((r) => r.booking));
  const reviewable = mine.find((b) => !reviewed.has(b.id)) || null;
  const placeLabel = (p: string) =>
    p === "my_place" ? `${name}'s place` : p === "client_place" ? "Your place" : p === "campus_space" ? "Campus space" : p;
  const isSelf = user?.username === braider.username;

  return (
    <main className="wrap profile-wrap">
      <div className="profile-main">
        <div className="profile-head">
          <Avatar name={name} src={braider.photo_url} large />
          <div>
            <h1>{name}</h1>
            <div className="profile-meta">
              <span>
                {braider.campus_area ? campusLabel(braider.campus_area) : "On campus"}
                {braider.location_detail ? `, ${braider.location_detail}` : ""}
              </span>
              <span>
                {braider.average_rating !== null
                  ? `★ ${braider.average_rating.toFixed(1)} (${braider.review_count} ${braider.review_count === 1 ? "review" : "reviews"})`
                  : "New, no reviews yet"}
              </span>
              {braider.instagram && (
                <a href={instagramUrl(braider.instagram)} target="_blank" rel="noreferrer" className="ig-meta">
                  Instagram
                </a>
              )}
            </div>
            <div className="profile-btns">
              {isSelf ? (
                <Link to="/my-page" className="btn btn-msg">
                  Edit my page
                </Link>
              ) : (
                <Link to={user ? `/messages/${braider.user_id}` : `/login?next=/messages/${braider.user_id}`} className="btn btn-msg">
                  <span className="full-name">Message {name}</span>
                  <span className="short-name">Message</span>
                </Link>
              )}
              {braider.instagram && (
                <a href={instagramUrl(braider.instagram)} target="_blank" rel="noreferrer" className="btn btn-ghost btn-msg ig-btn">
                  Instagram
                </a>
              )}
            </div>
          </div>
        </div>
        {braider.bio && <p className="profile-bio">{braider.bio}</p>}

        <h2 className="profile-h2" style={{ marginTop: 32 }}>Their work</h2>
        {activeListings.length === 0 ? (
          <p className="muted">No listings yet.</p>
        ) : (
          <div className="work-grid">
            {activeListings.map((l, i) => (
              <div key={l.id} className="work-card">
                <div className="work-photo" style={{ background: TINTS[(braider.id + i) % TINTS.length] }}>
                  {l.photo_url ? <img src={sized(l.photo_url, 600)} alt={l.title} loading="lazy" /> : <span className="photo-none">No photo yet</span>}
                </div>
                <div className="work-body">
                  <div className="work-name">{cap(l.style_name)}</div>
                  {l.title && l.title.toLowerCase() !== l.style_name.toLowerCase() && <div className="work-sub">{l.title}</div>}
                  <div className="work-price">
                    <span>{formatPrice(l.price)}</span>
                    <small>{hrs(l.duration_minutes)}</small>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <h2 className="profile-h2" style={{ marginTop: 40 }}>Reviews</h2>
        {braider.reviews.length === 0 ? (
          <p className="muted">No reviews yet. Book an appointment and be the first.</p>
        ) : (
          <div className="rv-list">
            {braider.reviews.map((r) => (
              <ReviewCard key={r.id} r={r} braiderName={name} />
            ))}
          </div>
        )}
        <p className="profile-note-mobile">
          Address shared after {name} accepts. Free to cancel until {braider.cancel_window_hours} hours before.
        </p>

        {user && !isSelf && (
          <div style={{ marginTop: 16 }}>
            <SafetyMenu userId={braider.user_id} name={name} />
          </div>
        )}

        <ReviewForm braider={braider} booking={reviewable} onPosted={load} />
      </div>

      <aside className={`book-panel${panelOpen ? " open" : ""}`} id="book-panel">
        <div className="seg" role="tablist" aria-label="Request type">
          <button type="button" role="tab" aria-selected={mode === "book"} onClick={() => setMode("book")}>
            Book
          </button>
          <button type="button" role="tab" aria-selected={mode === "custom"} onClick={() => setMode("custom")}>
            Custom
          </button>
        </div>

        {mode === "book" ? (
          activeListings.length === 0 ? (
            <p className="muted" style={{ marginTop: 20 }}>This braider has no bookable listings right now.</p>
          ) : (
            <form onSubmit={book} className="book-form">
              <div className="field">
                <label htmlFor="r-style">Style</label>
                <select id="r-style" value={listingId} onChange={(e) => setListingId(e.target.value)}>
                  {activeListings.map((l) => (
                    <option key={l.id} value={l.id}>
                      {cap(l.style_name)}
                      {l.title && l.title.toLowerCase() !== l.style_name.toLowerCase() ? `: ${l.title}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="r-date">Date</label>
                <input id="r-date" type="date" required min={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="field">
                <span className="lbl" id="bk-time-l">Time</span>
                {!date ? (
                  <span className="hint">Pick a date to see open times.</span>
                ) : slots === null ? (
                  <span className="hint">Loading times…</span>
                ) : slots.length === 0 ? (
                  <span className="hint">No times open that day. Try another date.</span>
                ) : (
                  <div className="slot-row" role="group" aria-labelledby="bk-time-l">
                    {slots.map((t) => (
                      <button key={t} type="button" className="slot" aria-pressed={time === t} onClick={() => setTime(t)}>
                        {formatTime(t).replace("AM", "am").replace("PM", "pm")}
                      </button>
                    ))}
                  </div>
                )}
                <span className="hint">Only times that fit this style are shown.</span>
              </div>
              {braider.service_places?.length > 0 && (
                <div className="field">
                  <label htmlFor="r-where">Where</label>
                  <select id="r-where" required value={place} onChange={(e) => setPlace(e.target.value)}>
                    {braider.service_places.map((p) => (
                      <option key={p} value={p}>{placeLabel(p)}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="field">
                <label htmlFor="r-notes">Notes for {name} (optional)</label>
                <textarea id="r-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Length, color, inspo. Anything she should know." />
              </div>
              <div className="total">
                <span>Total</span>
                <span>{chosen ? formatPrice(chosen.price) : ""}</span>
              </div>
              {bookingErr && <p className="error">{bookingErr}</p>}
              {bookingMsg && <p className="notice">{bookingMsg}</p>}
              <button className="btn btn-block" type="submit" disabled={!time}>
                Send request
              </button>
              {!user && (
                <p className="hint">
                  New here? <Link to={`/signup?role=client&next=/braiders/${id}`}>Create a free client account</Link>.
                </p>
              )}
            </form>
          )
        ) : (
          <form onSubmit={sendCustom} className="book-form">
            <div className="field">
              <label htmlFor="c-desc">What do you have in mind?</label>
              <textarea id="c-desc" rows={4} required value={customText} onChange={(e) => setCustomText(e.target.value)} placeholder="Style, length, color, anything she should know." />
            </div>
            <div className="field">
              <span className="lbl">Reference photo</span>
              <PhotoField kind="reference" urls={customPhoto} onChange={setCustomPhoto} variant="slots" label="Add a photo" max={1} />
            </div>
            <div className="field">
              <label htmlFor="c-budget">Budget ($)</label>
              <input id="c-budget" type="number" min={0} value={customBudget} onChange={(e) => setCustomBudget(e.target.value)} placeholder="Optional" />
            </div>
            {customErr && <p className="error">{customErr}</p>}
            {customMsg && <p className="notice">{customMsg}</p>}
            <button className="btn btn-block" type="submit" disabled={!customText.trim()}>
              Send custom request
            </button>
          </form>
        )}

        <div className="book-notes">
          <span>Address shared after {name} accepts.</span>
          <span>Free to cancel until {braider.cancel_window_hours} hours before.</span>
          <span>Bring: hair washed and detangled.</span>
          {mode === "custom" && <span>Custom tab: a description, a reference photo and a budget.</span>}
          {days && (
            <span>
              Usually free {days}
              {braider.available_start_time && braider.available_end_time
                ? `, ${formatTime(braider.available_start_time.slice(0, 5))} to ${formatTime(braider.available_end_time.slice(0, 5))}`
                : ""}
              .
            </span>
          )}
          {braider.deposit_note && <span>Deposit: {braider.deposit_note}</span>}
          {braider.policy_text && <span>Her rules: {braider.policy_text}</span>}
          {braider.years_experience > 0 && (
            <span>{braider.years_experience} {braider.years_experience === 1 ? "year" : "years"} braiding.</span>
          )}
        </div>
      </aside>

      <div className="book-bar">
        <div style={{ flex: 1 }}>
          <div className="book-bar-style">{chosen ? cap(chosen.style_name) : name}</div>
          <div className="book-bar-price">{chosen ? formatPrice(chosen.price) : ""}</div>
        </div>
        <button
          type="button"
          className="btn"
          aria-expanded={panelOpen}
          aria-controls="book-panel"
          disabled={activeListings.length === 0}
          onClick={() => {
            setPanelOpen(true);
            window.setTimeout(() => document.getElementById("book-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
          }}
        >
          Book
        </button>
      </div>
    </main>
  );
}
