import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, cap, CAMPUS_AREAS, todayISO, type Braider, type BraidStyle } from "../lib/api";
import { BraiderRow, RowsSkeleton, WakingNotice, useSlow } from "../components/ui";

export default function Browse() {
  const [params, setParams] = useSearchParams();
  const [styles, setStyles] = useState<BraidStyle[]>([]);
  const [results, setResults] = useState<Braider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const slow = useSlow(loading);

  const style = params.get("style") || "";
  const date = params.get("date") || "";
  const campus = params.get("campus_area") || "";
  const maxPrice = params.get("max_price") || "";

  useEffect(() => {
    api.styles().then(setStyles).catch(() => setStyles([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError("");
    const run = async () => {
      try {
        if (style && date) {
          const ranked = await api.recommended({
            style,
            date,
            ...(maxPrice ? { max_price: maxPrice } : {}),
          });
          // The ranked endpoint has no area filter, so apply it here.
          setResults(campus ? ranked.filter((b) => b.campus_area === campus) : ranked);
        } else {
          const q: Record<string, string> = {};
          if (style) q.style = style;
          if (campus) q.campus_area = campus;
          const list = await api.braiders(q);
          setResults(
            maxPrice ? list.filter((b) => b.listings.some((l) => l.is_active && Number(l.price) <= Number(maxPrice))) : list,
          );
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load braiders.");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [style, date, campus, maxPrice]);

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  const count = loading
    ? ""
    : `${results.length} ${results.length === 1 ? "braider" : "braiders"}${style ? ` for ${cap(style)}` : ""}`;
  const hasMore = Boolean(date || campus || maxPrice);

  return (
    <main className="wrap browse">
      <h1>Find a braider</h1>
      <p className="sub">
        {style && date
          ? `Ranked for ${cap(style)} on ${date}. Availability, reviews, price and experience all count.`
          : "Choose a style to see who does it."}
      </p>

      <div className="chip-row filters" role="group" aria-label="Style">
        <button type="button" className="chip" aria-pressed={!style} onClick={() => set("style", "")}>
          All
        </button>
        {styles.map((s) => (
          <button
            key={s.id}
            type="button"
            className="chip"
            aria-pressed={style === s.name}
            onClick={() => set("style", s.name)}
          >
            {cap(s.name)}
          </button>
        ))}
      </div>

      <details className="more-filters" open={hasMore}>
        <summary>Day, place and budget</summary>
        <div className="row" style={{ marginTop: "0.9rem" }}>
          <div>
            <label htmlFor="f-date">Day</label>
            <input id="f-date" type="date" min={todayISO()} value={date} onChange={(e) => set("date", e.target.value)} />
          </div>
          <div>
            <label htmlFor="f-area">Campus area</label>
            <select id="f-area" value={campus} onChange={(e) => set("campus_area", e.target.value)}>
              <option value="">Anywhere on campus</option>
              {Object.entries(CAMPUS_AREAS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="f-price">Max price ($)</label>
            <input
              id="f-price"
              type="number"
              min={0}
              placeholder="No limit"
              value={maxPrice}
              onChange={(e) => set("max_price", e.target.value)}
            />
          </div>
        </div>
      </details>

      {error && <p className="error" style={{ marginTop: "1rem" }}>{error}</p>}
      {slow && loading && <div style={{ marginTop: "1rem" }}><WakingNotice /></div>}
      <p className="result-count" role="status">{count}</p>
      <h2 className="sr-only">Matching braiders</h2>
      {loading ? (
        <div style={{ marginTop: 12 }}><RowsSkeleton /></div>
      ) : results.length === 0 ? (
        <div className="empty-card">
          <strong>No one does this style yet.</strong>
          <div>Send a custom request and braiders can offer a price.</div>
          <Link className="btn" to="/browse">Make a custom request</Link>
        </div>
      ) : (
        <div className="rows" style={{ marginTop: 12 }}>
          {results.map((b) => (
            <BraiderRow key={b.id} braider={b} style={style || undefined} />
          ))}
        </div>
      )}
    </main>
  );
}
