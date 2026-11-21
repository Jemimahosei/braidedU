import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, cap, formatPrice, todayISO, type Braider, type BraidStyle } from "../lib/api";
import { BraiderRow, RowsSkeleton, WakingNotice, useSlow } from "../components/ui";
import { useAuth } from "../lib/auth";

export default function Home() {
  const { user } = useAuth();
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
          <p className="lede">Braiders on campus, their work, their prices.</p>

          <form className="searchbar phone-hide" onSubmit={search}>
            <div>
              <label htmlFor="h-style">Style</label>
              <select id="h-style" value={style} onChange={(e) => setStyle(e.target.value)}>
                <option value="">Any style</option>
                {styles.map((s) => (
                  <option key={s.id} value={s.name}>
                    {cap(s.name)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="h-day">Day</label>
              <input
                id="h-day"
                type="date"
                min={todayISO()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <button className="btn" type="submit">
              Show braiders
            </button>
          </form>

          <p className="shelf-note phone-hide">Starting prices by style</p>
          {loading ? (
            <div className="shelf phone-hide" aria-hidden="true" style={{ minHeight: "46px" }} />
          ) : shelf.length === 0 ? (
            <div className="shelf phone-hide">
              <span className="muted">No prices are listed yet.</span>
            </div>
          ) : (
            <div className="shelf phone-hide">
              {shelf.map(({ style: s, from }) => (
                <Link key={s.id} to={`/browse?style=${encodeURIComponent(s.name)}`} className="shelf-pill">
                  <b>{cap(s.name)}</b>
                  <span>{formatPrice(from)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="wrap" style={{ paddingTop: 32, paddingBottom: 24 }}>
        <div className="section-head">
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
            No braiders are listed yet. <Link to={user ? "/join" : "/signup?role=braider"}>List your chair</Link> to be the first.
          </p>
        ) : (
          <div className="rows rows-home">
            {braiders.slice(0, 6).map((b) => (
              <BraiderRow key={b.id} braider={b} />
            ))}
          </div>
        )}
      </section>

      <section className="wrap phone-hide" style={{ paddingTop: 24, paddingBottom: 24 }}>
        <h2 className="home-h2" style={{ marginBottom: 20 }}>
          How booking works
        </h2>
        <div className="steps">
          <div className="step">
            <div className="n">1</div>
            <h3>Pick a braider</h3>
            <p>Browse by style, see prices and past work.</p>
          </div>
          <div className="step">
            <div className="n">2</div>
            <h3>Request a day</h3>
            <p>They accept or decline. You both see the booking.</p>
          </div>
          <div className="step">
            <div className="n">3</div>
            <h3>Leave a review</h3>
            <p>After your appointment, tell the next person.</p>
          </div>
        </div>
      </section>

      <section className="wrap" style={{ paddingTop: 24, paddingBottom: 16 }}>
        <div className="band">
          <h2>Something else in mind?</h2>
          <Link to="/browse" className="btn">
            Request a custom style
          </Link>
        </div>
      </section>

      <section className="wrap" style={{ paddingBottom: 32 }}>
        <div className="band band-sand">
          <h2>You braid? List your chair.</h2>
          <Link to={user ? "/join" : "/signup?role=braider"} className="btn btn-ink">
            Sign up as a braider
          </Link>
        </div>
      </section>
    </>
  );
}
