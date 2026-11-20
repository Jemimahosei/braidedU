import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  campusLabel,
  formatDuration,
  formatPrice,
  type Braider,
  type Listing,
} from "../lib/api";

const GREEN = "#0a5c36";
const YELLOW = "#ffd60a";
const INK = "#101010";
const WHITE = "#ffffff";

function hash(name: string): number {
  let h = 7;
  for (const ch of name) h = (h * 33 + ch.charCodeAt(0)) % 100003;
  return h;
}

/**
 * Wax-print tile. Stands in for a face: braiders have not uploaded photos and
 * we never fake people. Motif and colourway come from the name, so each
 * braider keeps the same tile everywhere. Fans, circles and bands are the
 * shapes of Ghanaian printed cloth, drawn here as plain SVG.
 */
export function Avatar({ name, large }: { name: string; large?: boolean }) {
  const h = hash(name);
  const ways = [
    [GREEN, YELLOW, INK, WHITE],
    [INK, YELLOW, GREEN, WHITE],
    [YELLOW, INK, GREEN, WHITE],
    [GREEN, WHITE, YELLOW, INK],
  ];
  const [bg, a, b, c] = ways[h % ways.length];
  const motif = Math.floor(h / 7) % 5;
  let art;
  switch (motif) {
    case 0: // concentric circles
      art = (
        <>
          <circle cx="32" cy="32" r="26" fill={a} />
          <circle cx="32" cy="32" r="18" fill={b} />
          <circle cx="32" cy="32" r="10" fill={c} />
          <circle cx="32" cy="32" r="4" fill={a} />
        </>
      );
      break;
    case 1: // four fans from the corners
      art = (
        <>
          <path d="M0 0h32a32 32 0 0 1-32 32z" fill={a} />
          <path d="M64 64H32a32 32 0 0 1 32-32z" fill={a} />
          <path d="M0 0h18a18 18 0 0 1-18 18z" fill={b} />
          <path d="M64 64H46a18 18 0 0 1 18-18z" fill={b} />
          <circle cx="48" cy="16" r="7" fill={c} />
          <circle cx="16" cy="48" r="7" fill={c} />
        </>
      );
      break;
    case 2: // diagonal bands with dots
      art = (
        <>
          <path d="M-8 40L40-8h14L-8 54z" fill={a} />
          <path d="M20 72L72 20v14L34 72z" fill={a} />
          <path d="M-8 62L62-8h6L-8 68z" fill={b} />
          <circle cx="44" cy="44" r="6" fill={c} />
          <circle cx="16" cy="16" r="5" fill={c} />
        </>
      );
      break;
    case 3: // scales: rows of half circles
      art = (
        <>
          {[0, 1, 2, 3].map((row) =>
            [0, 1, 2, 3].map((col) => (
              <path
                key={`${row}-${col}`}
                d={`M${col * 16 + (row % 2) * 8 - 8} ${row * 16 + 16}a8 8 0 0 1 16 0z`}
                fill={(row + col) % 2 ? a : b}
              />
            )),
          )}
          <circle cx="32" cy="32" r="6" fill={c} />
        </>
      );
      break;
    default: // nested diamonds
      art = (
        <>
          <path d="M32 4l28 28-28 28L4 32z" fill={a} />
          <path d="M32 14l18 18-18 18-18-18z" fill={b} />
          <path d="M32 24l8 8-8 8-8-8z" fill={c} />
        </>
      );
  }
  return (
    <svg
      className={large ? "tile tile-lg" : "tile"}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="64" height="64" fill={bg} />
      {art}
    </svg>
  );
}

/** The braidedU mark: one wax-print fan. */
export function Mark() {
  return (
    <svg viewBox="0 0 26 26" aria-hidden="true" focusable="false">
      <rect width="26" height="26" fill={GREEN} />
      <path d="M0 26V0a26 26 0 0 1 26 26z" fill={YELLOW} />
      <path d="M0 26V8a18 18 0 0 1 18 18z" fill={INK} />
      <circle cx="19" cy="7" r="3.5" fill={WHITE} />
    </svg>
  );
}

export function WaxBand() {
  return <div className="wax-band" aria-hidden="true" />;
}

export function DemoBadge() {
  return <span className="pill pill-demo">Demo profile</span>;
}

export function Stars({ rating }: { rating: number | null }) {
  if (rating === null || rating === undefined) {
    return <span className="muted">New, no reviews yet</span>;
  }
  const full = Math.round(rating);
  return (
    <span className="stars" aria-label={`${rating} out of 5 stars`}>
      {"★".repeat(full)}
      <span className="dim">{"★".repeat(5 - full)}</span> {rating.toFixed(1)}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  return <span className={`pill pill-${status}`}>{status}</span>;
}

/**
 * The API runs on a free host that sleeps when idle, so the first request can
 * take about a minute. After a few seconds of waiting, say so instead of
 * leaving the person to wonder (or worse, showing an empty list).
 */
export function useSlow(loading: boolean, afterMs = 3500): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!loading) {
      setSlow(false);
      return;
    }
    const t = window.setTimeout(() => setSlow(true), afterMs);
    return () => window.clearTimeout(t);
  }, [loading, afterMs]);
  return slow;
}

export function WakingNotice() {
  return (
    <p className="waking" role="status">
      The server was asleep and is waking up. The first load can take up to a
      minute, then it stays fast.
    </p>
  );
}

export function RowsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="rows" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton" />
      ))}
    </div>
  );
}

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/** A shelf-edge label: style name, big price, how long it takes. */
export function PriceTag({
  name,
  price,
  meta,
  to,
  index = 0,
  place,
}: {
  name: string;
  price: string | number;
  meta?: string;
  to?: string;
  index?: number;
  place?: boolean;
}) {
  const className = `tag${place ? " place" : ""}`;
  const style = { "--i": index } as React.CSSProperties;
  const body = (
    <>
      <span className="t-name">{titleCase(name)}</span>
      <span className="t-price">{formatPrice(price)}</span>
      {meta && <span className="t-meta">{meta}</span>}
    </>
  );
  return to ? (
    <Link to={to} className={className} style={style}>
      {body}
    </Link>
  ) : (
    <span className={className} style={style}>
      {body}
    </span>
  );
}

export function BraiderRow({ braider }: { braider: Braider }) {
  const active = braider.listings.filter((l) => l.is_active);
  const where = braider.campus_area ? campusLabel(braider.campus_area) : "On campus";
  const shown = active.slice(0, 4);
  return (
    <article className="braider-row">
      <Avatar name={braider.display_name} />
      <div>
        <h3>
          <Link to={`/braiders/${braider.id}`}>{braider.display_name}</Link>
        </h3>
        <div className="where">
          {where}
          {braider.years_experience > 0 && `, ${braider.years_experience} yrs braiding`}
          {braider.match_score !== undefined && `, match ${braider.match_score}/100`}
        </div>
        <div style={{ marginTop: "0.3rem" }}>
          {braider.is_demo && <DemoBadge />} <Stars rating={braider.average_rating} />
          {braider.review_count > 0 && <span className="muted"> ({braider.review_count})</span>}
        </div>
        <div className="labels">
          {shown.length === 0 ? (
            <span className="tag tag-quiet">
              <span className="t-name">No prices listed yet</span>
            </span>
          ) : (
            shown.map((l) => (
              <PriceTag
                key={l.id}
                name={l.style_name}
                price={l.price}
                meta={formatDuration(l.duration_minutes)}
              />
            ))
          )}
          {active.length > shown.length && (
            <span className="muted" style={{ alignSelf: "center" }}>
              +{active.length - shown.length} more
            </span>
          )}
        </div>
      </div>
      <div className="go">
        <Link to={`/braiders/${braider.id}`} className="btn btn-ghost btn-sm">
          View profile
        </Link>
      </div>
    </article>
  );
}

export function ListingRow({ listing }: { listing: Listing }) {
  return (
    <div className="listing">
      <div>
        <strong>{listing.title}</strong>
        <div className="muted">
          {listing.style_name}
          {listing.description ? `. ${listing.description}` : ""}
        </div>
      </div>
      <PriceTag
        name={listing.style_name}
        price={listing.price}
        meta={formatDuration(listing.duration_minutes)}
      />
    </div>
  );
}
