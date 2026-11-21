import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, cap, formatPrice, sized, TINTS, WEEKDAYS, type BraidStyle } from "../lib/api";
import { PhotoField } from "../components/PhotoField";

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DEFAULT_DAYS = ["mon", "tue", "wed", "thu", "fri"];

/** New posting / edit posting: the braider sets the price (mockup: Posting.dc.html). */
export default function PostingForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [styles, setStyles] = useState<BraidStyle[]>([]);
  const [style, setStyle] = useState("");
  const [photo, setPhoto] = useState<string[]>([]);
  const [price, setPrice] = useState("");
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");
  const [days, setDays] = useState<string[]>(DEFAULT_DAYS);
  const [daysTouched, setDaysTouched] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.styles().then((s) => {
      setStyles(s);
      if (!id) setStyle((cur) => cur || String(s[0]?.id ?? ""));
    }).catch(() => setStyles([]));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    api
      .listing(id)
      .then((l) => {
        setStyle(String(l.style));
        setPhoto(l.photo_url ? [l.photo_url] : []);
        setPrice(String(Number(l.price)));
        setHours(String(Math.round((l.duration_minutes / 60) * 100) / 100));
        setNote(l.description);
        if (l.available_days?.length) setDays(l.available_days);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load this posting."));
  }, [id]);

  const chosen = styles.find((s) => String(s.id) === style);
  const minutes = Math.round(Number(hours) * 60);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!chosen || !price || !minutes) {
      setError("Pick a style and add a price and how many hours it takes.");
      return;
    }
    setBusy(true);
    const data: Record<string, unknown> = {
      style: chosen.id,
      title: cap(chosen.name),
      description: note,
      price,
      duration_minutes: minutes,
      photo_url: photo[0] || "",
    };
    // A new posting takes the picked days; an edit keeps the old ones
    // unless the braider changed them.
    if (!id || daysTouched) data.available_days = days;
    try {
      if (id) await api.updateListing(Number(id), data);
      else await api.createListing(data);
      navigate("/postings");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the posting.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="dash-main xwide">
      <h1>{id ? "Edit posting" : "New posting"}</h1>
      <div className="posting-layout">
        <form className="posting-form" onSubmit={submit}>
          <section className="join-card stack-14">
            <div className="field">
              <label htmlFor="p-style">Style</label>
              <select id="p-style" value={style} onChange={(e) => setStyle(e.target.value)} required>
                {styles.map((s) => (
                  <option key={s.id} value={s.id}>
                    {cap(s.name)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Photos of this style</label>
              <PhotoField kind="work" urls={photo} onChange={setPhoto} label="Add" />
            </div>
          </section>

          <section className="join-card price-card">
            <div className="field" style={{ flex: "1 1 180px" }}>
              <label htmlFor="p-price">Your price</label>
              <div className="big-input">
                <span>$</span>
                <input id="p-price" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))} />
              </div>
            </div>
            <div className="field" style={{ flex: "1 1 140px" }}>
              <label htmlFor="p-hrs">Hours it takes</label>
              <input id="p-hrs" className="hours-input" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value.replace(/[^0-9.]/g, ""))} />
            </div>
          </section>

          <section className="join-card stack-14">
            <div className="field">
              <label htmlFor="p-note">Note for clients</label>
              <textarea id="p-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Hair included? What should they bring?" />
            </div>
            <div className="field">
              <span className="lbl" id="p-days-l">Days you take this</span>
              <div className="day-pills" role="group" aria-labelledby="p-days-l">
                {DAY_KEYS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className="day-pill"
                    aria-pressed={days.includes(d)}
                    onClick={() => {
                      setDaysTouched(true);
                      setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
                    }}
                  >
                    {WEEKDAYS[d]}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" className="btn btn-block" style={{ padding: 16 }} disabled={busy}>
            {id ? "Save posting" : "Publish posting"}
          </button>
          <Link to="/postings" className="auth-link">
            Back to postings
          </Link>
        </form>

        <aside className="posting-preview">
          <div className="preview-label">How it will look</div>
          <div className="preview-card">
            <div className="preview-photo" style={{ background: TINTS[(chosen?.id ?? 0) % TINTS.length] }}>
              {photo[0] ? <img src={sized(photo[0], 700)} alt="" /> : <span className="photo-none">Your photo</span>}
            </div>
            <div className="preview-body">
              <div style={{ fontWeight: 600 }}>{chosen ? cap(chosen.name) : "Style"}</div>
              <div className="preview-price">
                <span>{price ? formatPrice(price) : "$"}</span>
                <small>{hours ? `${hours} ${Number(hours) === 1 ? "hr" : "hrs"}` : "hrs"}</small>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
