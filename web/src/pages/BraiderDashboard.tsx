import { useEffect, useState } from "react";
import {
  api,
  CAMPUS_AREAS,
  SERVICE_PLACES,
  formatDate as fmtDate,
  type TimeOff,
  formatDate,
  formatPrice,
  formatTime,
  WEEKDAYS,
  type Booking,
  type Braider,
  type BraidStyle,
  type Listing,
} from "../lib/api";
import { Link, useSearchParams } from "react-router-dom";
import { StatusPill, Stars, Avatar } from "../components/ui";
import { PhotoField } from "../components/PhotoField";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export default function BraiderDashboard() {
  const [params] = useSearchParams();
  const wanted = params.get("tab");
  const [tab, setTab] = useState<"requests" | "schedule" | "reviews" | "listings" | "profile">(
    wanted === "listings" || wanted === "profile" || wanted === "schedule" || wanted === "reviews" ? wanted : "requests",
  );
  useEffect(() => {
    setTab(wanted === "listings" || wanted === "profile" || wanted === "schedule" || wanted === "reviews" ? wanted : "requests");
  }, [wanted]);
  const [profile, setProfile] = useState<Braider | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [styles, setStyles] = useState<BraidStyle[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [newTitle, setNewTitle] = useState("");
  const [newStyle, setNewStyle] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newDuration, setNewDuration] = useState("180");
  const [newDesc, setNewDesc] = useState("");
  const [replyId, setReplyId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [cancelWhy, setCancelWhy] = useState("");
  const [timeOff, setTimeOff] = useState<TimeOff[]>([]);
  const [offFrom, setOffFrom] = useState("");
  const [offTo, setOffTo] = useState("");
  const [offNote, setOffNote] = useState("");
  const [newPhoto, setNewPhoto] = useState<string[]>([]);

  const load = () => {
    api.myBraiderProfile().then(setProfile).catch(() => setProfile(null));
    api.bookings().then(setBookings).catch(() => setBookings([]));
    api.timeOff().then(setTimeOff).catch(() => setTimeOff([]));
    api.myListings().then(setListings).catch(() => setListings([]));
    api.styles().then(setStyles).catch(() => setStyles([]));
  };
  useEffect(load, []);

  const act = async (
    id: number,
    action: "accept" | "decline" | "complete" | "payment-received" | "braider-cancel",
    body: Record<string, unknown> = {},
  ) => {
    setError("");
    try {
      await api.bookingAction(id, action, body);
      setNotice(
        action === "accept"
          ? "Booking accepted. It is on your schedule now."
          : action === "decline"
            ? "Booking declined."
            : "Marked complete. Your client can now leave a review.",
      );
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not work.");
    }
  };

  const createListing = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await api.createListing({
        style: Number(newStyle),
        title: newTitle,
        description: newDesc,
        price: newPrice,
        duration_minutes: Number(newDuration),
        photo_url: newPhoto[0] || "",
      });
      setNotice("Listing published.");
      setNewTitle("");
      setNewDesc("");
      setNewPrice("");
      setNewPhoto([]);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the listing.");
    }
  };

  const toggleListing = async (l: Listing) => {
    try {
      await api.updateListing(l.id, { is_active: !l.is_active });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the listing.");
    }
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setError("");
    try {
      const updated = await api.updateBraiderProfile({
        display_name: profile.display_name,
        bio: profile.bio,
        campus_area: profile.campus_area,
        location_detail: profile.location_detail,
        instagram: profile.instagram,
        photo_url: profile.photo_url,
        service_places: profile.service_places,
        private_address: profile.private_address ?? "",
        cancel_window_hours: profile.cancel_window_hours,
        deposit_note: profile.deposit_note,
        policy_text: profile.policy_text,
        reminders_enabled: profile.reminders_enabled,
        buffer_minutes: profile.buffer_minutes,
        venmo_handle: profile.venmo_handle ?? "",
        zelle_contact: profile.zelle_contact ?? "",
        years_experience: profile.years_experience,
        available_days: profile.available_days,
        available_start_time: profile.available_start_time,
        available_end_time: profile.available_end_time,
      });
      setProfile(updated);
      setNotice("Profile saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the profile.");
    }
  };

  const toggleDay = (d: string) => {
    if (!profile) return;
    const days = profile.available_days.includes(d)
      ? profile.available_days.filter((x) => x !== d)
      : [...profile.available_days, d];
    setProfile({ ...profile, available_days: days });
  };

  const requests = bookings.filter((b) => b.status === "requested");
  const schedule = bookings.filter((b) =>
    ["accepted", "paid", "confirmed", "completed"].includes(b.status),
  );
  const done = bookings.filter((b) => b.status === "completed").length;

  return (
    <div className="page">
      <div className="wrap">
        <h1>
          {profile ? `${profile.display_name}’s chair` : "Your chair"}{" "}
          <Stars rating={profile?.average_rating ?? null} />
        </h1>
        <p className="muted">
          {done} completed appointment{done === 1 ? "" : "s"}, {requests.length} request{requests.length === 1 ? "" : "s"} waiting
        </p>
        {error && <p className="error" style={{ marginTop: "1rem" }}>{error}</p>}
        {notice && <p className="notice" style={{ marginTop: "1rem" }}>{notice}</p>}

        <div className="tabs" style={{ marginTop: "1.5rem" }}>
          {(["requests", "schedule", "reviews", "listings", "profile"] as const).map((t) => (
            <button
              key={t}
              type="button"
              className="chip"
              aria-pressed={tab === t}
              onClick={() => {
                setTab(t);
                setError("");
                setNotice("");
              }}
            >
              {t === "requests" ? `Requests (${requests.length})` : t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {tab === "requests" && (
          <div className="grid">
            {requests.length === 0 && <p className="muted">No requests waiting. When a client books you, it lands here.</p>}
            {requests.map((b) => (
              <article key={b.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <h3>{b.client_name}</h3>
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
                <div className="grow" />
                <div className="row" style={{ gap: "0.5rem" }}>
                  <Link to={`/messages/${b.client_user_id}`} className="btn btn-light btn-sm">
                    Message
                  </Link>
                  <button className="btn btn-sm" type="button" onClick={() => act(b.id, "accept")}>
                    Accept
                  </button>
                  <button className="btn btn-ghost btn-sm" type="button" onClick={() => act(b.id, "decline")}>
                    Decline
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {tab === "schedule" && (
          <div className="grid">
            {schedule.length === 0 && <p className="muted">Nothing on the schedule yet.</p>}
            {schedule.map((b) => (
              <article key={b.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <h3>{b.client_name}</h3>
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
                <div className="grow" />
                {b.payment_screenshot_url && (
                  <p>
                    <a href={b.payment_screenshot_url} target="_blank" rel="noreferrer">
                      See their payment screenshot
                    </a>
                  </p>
                )}
                <div className="row" style={{ gap: "0.5rem" }}>
                  <Link to={`/messages/${b.client_user_id}`} className="btn btn-light btn-sm">
                    Message
                  </Link>
                  {(b.status === "accepted" || b.status === "paid") && (
                    <button className="btn btn-sm" type="button" onClick={() => act(b.id, "payment-received")}>
                      Payment received
                    </button>
                  )}
                  {["accepted", "paid", "confirmed"].includes(b.status) && (
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => act(b.id, "complete")}>
                      Mark complete
                    </button>
                  )}
                  {["accepted", "paid", "confirmed"].includes(b.status) && cancelId !== b.id && (
                    <button className="link-btn danger" type="button" onClick={() => setCancelId(b.id)}>
                      Cancel appointment
                    </button>
                  )}
                </div>
                {cancelId === b.id && (
                  <form
                    className="stack"
                    onSubmit={(e) => {
                      e.preventDefault();
                      act(b.id, "braider-cancel", { reason: cancelWhy });
                      setCancelId(null);
                      setCancelWhy("");
                    }}
                  >
                    <label htmlFor={`cw-${b.id}`}>Tell {b.client_name} why (they get an email)</label>
                    <input id={`cw-${b.id}`} value={cancelWhy} onChange={(e) => setCancelWhy(e.target.value)} />
                    <button className="btn btn-sm btn-danger" type="submit">Cancel and tell them</button>
                  </form>
                )}
              </article>
            ))}
          </div>
        )}

        {tab === "reviews" && (
          <div className="stack">
            {(profile?.reviews ?? []).length === 0 && <p className="muted">No reviews yet. They appear here after clients finish an appointment.</p>}
            {(profile?.reviews ?? []).map((r) => (
              <article key={r.id} className="card">
                <div><Stars rating={r.rating} /> <strong>{r.client_name}</strong></div>
                {r.comment && <p>{r.comment}</p>}
                {r.braider_reply ? (
                  <div className="reply"><strong>Your reply</strong><p>{r.braider_reply}</p></div>
                ) : replyId === r.id ? (
                  <form
                    className="stack"
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
                    <button className="btn btn-sm" type="submit">Post reply</button>
                  </form>
                ) : (
                  <button className="link-btn" type="button" onClick={() => setReplyId(r.id)}>Reply publicly</button>
                )}
              </article>
            ))}
          </div>
        )}

        {tab === "listings" && (
          <div className="stack">
            <form onSubmit={createListing} className="panel stack">
              <h2>Add a listing</h2>
              <div className="row">
                <div>
                  <label htmlFor="nl-title">Title</label>
                  <input id="nl-title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Knotless braids, mid-back" required />
                </div>
                <div>
                  <label htmlFor="nl-style">Style</label>
                  <select id="nl-style" value={newStyle} onChange={(e) => setNewStyle(e.target.value)} required>
                    <option value="">Pick a style</option>
                    {styles.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="row">
                <div>
                  <label htmlFor="nl-price">Price ($)</label>
                  <input id="nl-price" type="number" min={0} step="1" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="85" required />
                </div>
                <div>
                  <label htmlFor="nl-dur">Duration (minutes)</label>
                  <input id="nl-dur" type="number" min={15} step={15} value={newDuration} onChange={(e) => setNewDuration(e.target.value)} required />
                </div>
              </div>
              <div>
                <label htmlFor="nl-desc">Description (optional)</label>
                <input id="nl-desc" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Hair included, mid-back length" />
              </div>
              <div>
                <label>Photo of this style (optional)</label>
                <PhotoField kind="work" urls={newPhoto} onChange={setNewPhoto} label="Add photo" />
              </div>
              <button className="btn" type="submit">
                Publish listing
              </button>
            </form>
            <h2>Your listings</h2>
            {listings.length === 0 && <p className="muted">No listings yet. Add your first one above.</p>}
            {listings.map((l) => (
              <div key={l.id} className="panel" style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ display: "flex", gap: "0.9rem", alignItems: "center" }}>
                  {l.photo_url && <Avatar name={l.title} src={l.photo_url} />}
                  <div>
                  <strong>{l.title}</strong>
                  <div className="muted">
                    {l.style_name}, {formatPrice(l.price)}, {l.duration_minutes} min. {l.is_active ? "Live" : "Paused"}
                  </div>
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => toggleListing(l)}>
                  {l.is_active ? "Pause" : "Make live"}
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === "profile" && profile && (
          <form onSubmit={saveProfile} className="panel stack">
            <div>
              <label>Profile photo</label>
              <PhotoField
                kind="profile"
                urls={profile.photo_url ? [profile.photo_url] : []}
                onChange={(u) => setProfile({ ...profile, photo_url: u[0] || "" })}
                label="Add photo"
              />
              <p className="muted" style={{ marginTop: "0.4rem" }}>
                A clear photo of you or your work, only with your say-so. You can remove it any time.
              </p>
            </div>
            <div className="row">
              <div>
                <label htmlFor="pf-name">Display name</label>
                <input id="pf-name" value={profile.display_name} onChange={(e) => setProfile({ ...profile, display_name: e.target.value })} />
              </div>
              <div>
                <label htmlFor="pf-ig">Instagram (optional)</label>
                <input id="pf-ig" value={profile.instagram} onChange={(e) => setProfile({ ...profile, instagram: e.target.value })} placeholder="@your.handle" />
              </div>
            </div>
            <div>
              <label htmlFor="pf-bio">Bio</label>
              <textarea id="pf-bio" rows={3} value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} placeholder="What you do best, how long you have been braiding" />
            </div>
            <div className="row">
              <div>
                <label htmlFor="pf-area">Campus area</label>
                <select id="pf-area" value={profile.campus_area} onChange={(e) => setProfile({ ...profile, campus_area: e.target.value })}>
                  <option value="">Pick an area</option>
                  {Object.entries(CAMPUS_AREAS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="pf-loc">Where clients meet you</label>
                <input id="pf-loc" value={profile.location_detail} onChange={(e) => setProfile({ ...profile, location_detail: e.target.value })} placeholder="Dorm lounge, apartment" />
              </div>
              <div>
                <label htmlFor="pf-yrs">Years braiding</label>
                <input id="pf-yrs" type="number" min={0} value={profile.years_experience} onChange={(e) => setProfile({ ...profile, years_experience: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <label>Days you are usually free</label>
              <div className="day-pills">
                {DAYS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className="day-pill"
                    aria-pressed={profile.available_days.includes(d)}
                    onClick={() => toggleDay(d)}
                  >
                    {WEEKDAYS[d]}
                  </button>
                ))}
              </div>
            </div>
            <div className="row">
              <div>
                <label htmlFor="pf-start">Free from</label>
                <input id="pf-start" type="time" value={profile.available_start_time?.slice(0, 5) || ""} onChange={(e) => setProfile({ ...profile, available_start_time: e.target.value || null })} />
              </div>
              <div>
                <label htmlFor="pf-end">Free until</label>
                <input id="pf-end" type="time" value={profile.available_end_time?.slice(0, 5) || ""} onChange={(e) => setProfile({ ...profile, available_end_time: e.target.value || null })} />
              </div>
            </div>
            <hr className="hr" />
            <div>
              <label>Where you braid</label>
              <div className="chip-row">
                {Object.entries(SERVICE_PLACES).map(([k, v]) => (
                  <button
                    key={k}
                    type="button"
                    className="chip"
                    aria-pressed={profile.service_places.includes(k)}
                    onClick={() =>
                      setProfile({
                        ...profile,
                        service_places: profile.service_places.includes(k)
                          ? profile.service_places.filter((x) => x !== k)
                          : [...profile.service_places, k],
                      })
                    }
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            {profile.service_places.includes("my_place") && (
              <div>
                <label htmlFor="pf-addr">Your address (private)</label>
                <input id="pf-addr" value={profile.private_address ?? ""} onChange={(e) => setProfile({ ...profile, private_address: e.target.value })} placeholder="Street, apartment" />
                <p className="muted" style={{ marginTop: "0.3rem" }}>
                  Never shown on your page. A client sees it only after you accept their booking.
                </p>
              </div>
            )}
            <div className="row">
              <div>
                <label htmlFor="pf-venmo">Venmo handle</label>
                <input id="pf-venmo" value={profile.venmo_handle ?? ""} onChange={(e) => setProfile({ ...profile, venmo_handle: e.target.value })} placeholder="@your-handle" />
              </div>
              <div>
                <label htmlFor="pf-zelle">Zelle email or phone</label>
                <input id="pf-zelle" value={profile.zelle_contact ?? ""} onChange={(e) => setProfile({ ...profile, zelle_contact: e.target.value })} />
              </div>
            </div>
            <p className="muted">Clients see these only after you accept their booking.</p>
            <div className="row">
              <div>
                <label htmlFor="pf-cancel">Free cancellation until (hours before)</label>
                <input id="pf-cancel" type="number" min={0} max={336} value={profile.cancel_window_hours} onChange={(e) => setProfile({ ...profile, cancel_window_hours: Number(e.target.value) })} />
              </div>
              <div>
                <label htmlFor="pf-buffer">Rest time between clients (minutes)</label>
                <input id="pf-buffer" type="number" min={0} max={120} step={5} value={profile.buffer_minutes} onChange={(e) => setProfile({ ...profile, buffer_minutes: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <label htmlFor="pf-dep">Deposit (optional)</label>
              <input id="pf-dep" value={profile.deposit_note} onChange={(e) => setProfile({ ...profile, deposit_note: e.target.value })} placeholder="e.g. $20 to hold the spot" />
            </div>
            <div>
              <label htmlFor="pf-pol">Your rules (optional)</label>
              <textarea id="pf-pol" rows={3} value={profile.policy_text} onChange={(e) => setProfile({ ...profile, policy_text: e.target.value })} placeholder="Late arrivals, hair prep, what to bring" />
            </div>
            <button type="button" className="toggle" aria-pressed={profile.reminders_enabled} onClick={() => setProfile({ ...profile, reminders_enabled: !profile.reminders_enabled })}>
              <i /> Email my clients a reminder the day before
            </button>
            <button className="btn" type="submit">
              Save profile
            </button>
            <hr className="hr" />
            <button
              type="button"
              className="link-btn danger"
              style={{ justifySelf: "start" }}
              onClick={async () => {
                if (!window.confirm("Remove every photo you uploaded, from your page and from storage? This can't be undone.")) return;
                try {
                  const r = await api.deleteAllMyPhotos();
                  setNotice(`Removed ${r.removed} photo${r.removed === 1 ? "" : "s"}.`);
                  load();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Could not remove photos.");
                }
              }}
            >
              Remove all my photos
            </button>
          </form>
        )}

        {tab === "profile" && profile && (
          <div className="panel stack" style={{ marginTop: "1.25rem" }}>
            <h2>Time off</h2>
            <p className="muted">No one can request those days.</p>
            {timeOff.map((t) => (
              <div key={t.id} style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
                <span>
                  {fmtDate(t.start_date)}
                  {t.end_date !== t.start_date && <> to {fmtDate(t.end_date)}</>}
                  {t.note && <span className="muted">, {t.note}</span>}
                </span>
                <button className="link-btn danger" type="button" onClick={async () => { await api.removeTimeOff(t.id); load(); }}>
                  Remove
                </button>
              </div>
            ))}
            <form
              className="row"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await api.addTimeOff({ start_date: offFrom, end_date: offTo || offFrom, note: offNote });
                  setOffFrom(""); setOffTo(""); setOffNote("");
                  load();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Could not add time off.");
                }
              }}
            >
              <div><label htmlFor="to-from">From</label><input id="to-from" type="date" required value={offFrom} onChange={(e) => setOffFrom(e.target.value)} /></div>
              <div><label htmlFor="to-to">To (optional)</label><input id="to-to" type="date" value={offTo} onChange={(e) => setOffTo(e.target.value)} /></div>
              <div><label htmlFor="to-note">Note</label><input id="to-note" value={offNote} onChange={(e) => setOffNote(e.target.value)} placeholder="Finals, travel" /></div>
              <div style={{ alignSelf: "end" }}><button className="btn btn-ghost" type="submit">Add time off</button></div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
