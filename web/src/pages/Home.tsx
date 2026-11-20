import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, todayISO, type Braider, type BraidStyle } from "../lib/api";
import { BraiderRow, PriceTag, RowsSkeleton, WakingNotice, useSlow } from "../components/ui";

export default function Home() {
  const [styles, setStyles] = useState<BraidStyle[]>([]);
  const [braiders, setBraiders] = useState<Braider[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [style, setStyle] = useState("");
  const [date, setDate] = useState("");
  const navigate = useNavigate();
  const slow = useSlow(loading);

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    Promise.all([api.styles(), api.braiders({})])
      .then(([s, b]) => {
        setStyles(s);
        setBraiders(b);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  // The shelf: each style with the lowest price any braider lists for it.
  const shelf = useMemo(() => {
    return styles
      .map((s) => {
        const prices = braiders.flatMap((b) =>
          b.listings.filter((l) => l.is_active && l.style_name === s.name).map((l) => Number(l.price)),
        );
        return { style: s, from: prices.length ? Math.min(...prices) : null };
      })
      .filter((x) => x.from !== null) as { style: BraidStyle; from: number }[];
  }, [styles, braiders]);

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    const q = new URLSearchParams();
    if (style) q.set("style", style);
    if (date) q.set("date", date);
    navigate(`/browse${q.toString() ? `?${q}` : ""}`);
  };

  return (
    <>
      <section className="hero">
        <div className="wrap">
          <h1>Every braid, priced before you ask.</h1>
          <p className="lede">
            Student braiders on campus list their styles, prices and hours.
            Pick a style and a day. The booking lives in one place, not in a
            pile of DMs.
          </p>

          <form className="searchbar" onSubmit={search}>
            <div>
              <label htmlFor="h-style">Style</label>
              <select id="h-style" value={style} onChange={(e) => setStyle(e.target.value)}>
                <option value="">Any style</option>
                {styles.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="h-date">Day</label>
              <input
                id="h-date"
                type="date"
                min={todayISO()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <button className="btn btn-gold" type="submit">
              Show braiders
            </button>
          </form>

          <p className="shelf-note">Or start from what it costs. Lowest price listed for each style:</p>
          {loading ? (
            <div className="shelf" aria-hidden="true" style={{ minHeight: "92px" }} />
          ) : shelf.length === 0 ? (
            <div className="shelf">
              <span className="muted">No prices are listed yet.</span>
            </div>
          ) : (
            <div className="shelf">
              {shelf.map(({ style: s, from }, i) => (
                <PriceTag
                  key={s.id}
                  name={s.name}
                  price={from}
                  meta="and up"
                  to={`/browse?style=${encodeURIComponent(s.name)}`}
                  index={i}
                  place
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section" style={{ paddingTop: "1.5rem" }}>
        <div className="wrap">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "end",
              flexWrap: "wrap",
              gap: "1rem",
              marginBottom: "1.25rem",
            }}
          >
            <h2>Braiders on campus</h2>
            <Link to="/browse">See everyone</Link>
          </div>
          {slow && loading && <WakingNotice />}
          {loading ? (
            <RowsSkeleton />
          ) : failed ? (
            <div className="error" role="alert">
              <p>Couldn't reach the server. Check your connection and try again.</p>
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: "0.6rem" }} onClick={load}>
                Try again
              </button>
            </div>
          ) : braiders.length === 0 ? (
            <p className="muted">
              No braiders are listed yet. <Link to="/signup?role=braider">List your chair</Link> to be the first.
            </p>
          ) : (
            <div className="rows">
              {braiders.slice(0, 3).map((b) => (
                <BraiderRow key={b.id} braider={b} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <h2>How booking works</h2>
          <div className="steps" style={{ marginTop: "1.5rem" }}>
            <div className="step">
              <span className="n">1</span>
              <h3>Find your braider</h3>
              <p>Browse by style, area and budget. Every listing shows the price and how long it takes.</p>
            </div>
            <div className="step">
              <span className="n">2</span>
              <h3>Request a day</h3>
              <p>Pick a date and a start time. Your braider accepts or declines, and you both see the same booking.</p>
            </div>
            <div className="step">
              <span className="n">3</span>
              <h3>Show up, then review</h3>
              <p>After your appointment, leave a review so the next person knows what to expect.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-band">
        <div className="wrap">
          <div>
            <h2>You braid? List your chair.</h2>
            <p>
              Put your styles and prices up, take requests on your own schedule,
              and get found by the whole campus.
            </p>
          </div>
          <Link to="/signup?role=braider" className="btn">
            Sign up as a braider
          </Link>
        </div>
      </section>
    </>
  );
}
