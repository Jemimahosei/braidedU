import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  campusLabel,
  cap,
  TINTS,
  formatDuration,
  formatPrice,
  initials,
  sized,
  sizedFace,
  type Braider,
  type Listing,
} from "../lib/api";

/**
 * Profile picture: the braider's own uploaded photo, or their initials on
 * sand when they have not added one. We never invent a face.
 */
export function Avatar({
  name,
  src,
  large,
  small,
}: {
  name: string;
  src?: string;
  large?: boolean;
  small?: boolean;
}) {
  const cls = large ? "avatar avatar-lg" : small ? "avatar avatar-sm" : "avatar";
  if (src) {
    return <img className={cls} src={sized(src, large ? 400 : 200)} alt={name} loading="lazy" />;
  }
  return (
    <span className={cls} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

/** The braidedU mark: a front-facing silhouette with a braided bun. */
export function Mark() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="mk-c">
          <circle cx="50" cy="50" r="48" />
        </clipPath>
        <clipPath id="mk-f">
          <path d="M8 100 C12 88 28 82 42 79 L42 66 L58 66 L58 79 C72 82 88 88 92 100 Z" />
          <ellipse cx="50" cy="50" rx="15.5" ry="19" />
          <path d="M33 50 C32 30 40 24 50 24 C60 24 68 30 67 50 C64 38 58 34 50 34 C42 34 36 38 33 50Z" />
          <circle cx="50" cy="16" r="12" />
        </clipPath>
      </defs>
      <circle cx="50" cy="50" r="48" fill="#3f6b57" />
      <g clipPath="url(#mk-c)">
        <g fill="#efd9a3">
          <path d="M8 100 C12 88 28 82 42 79 L42 66 L58 66 L58 79 C72 82 88 88 92 100 Z" />
          <ellipse cx="50" cy="50" rx="15.5" ry="19" />
          <path d="M33 50 C32 30 40 24 50 24 C60 24 68 30 67 50 C64 38 58 34 50 34 C42 34 36 38 33 50Z" />
          <circle cx="50" cy="16" r="12" />
        </g>
        <g clipPath="url(#mk-f)" fill="none" stroke="#3f6b57" strokeWidth="2.8" strokeLinecap="round">
          <path d="M50 35 C50 29 50 25 50 22" />
          <path d="M44 36 C44 30 46 26 47 22" />
          <path d="M56 36 C56 30 54 26 53 22" />
          <path d="M39 39 C39 32 42 27 44 23" />
          <path d="M61 39 C61 32 58 27 56 23" />
          <path d="M50 6 C60 6 63 16 56 21 C50 25 42 20 45 14 C47 10 53 11 53 15" />
        </g>
      </g>
    </svg>
  );
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

const STATUS_LABEL: Record<string, string> = {
  requested: "Requested",
  accepted: "Accepted, awaiting payment",
  paid: "Says paid",
  confirmed: "Paid",
  declined: "Declined",
  cancelled: "Cancelled",
  completed: "Completed",
};

export function StatusPill({ status }: { status: string }) {
  return <span className={`pill pill-${status}`}>{STATUS_LABEL[status] || status}</span>;
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

/** Retry a read a few times before giving up. The free server sleeps when
 *  idle, and the first request can fail while it wakes — a page should wait
 *  for it instead of showing an error on the first try. */
export async function retryRead<T>(fn: () => Promise<T>, tries = 4, waitMs = 10000): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (i < tries - 1) await new Promise((r) => window.setTimeout(r, waitMs));
    }
  }
  throw last;
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

/** A braider card, as in the mockup: photo, name and rating, area or price line, style chips. */
export function BraiderRow({
  braider,
  style,
}: {
  braider: Braider;
  /** The style being browsed, if any: shows "Style from $X" and highlights its chip. */
  style?: string;
}) {
  const active = braider.listings.filter((l) => l.is_active);
  const names = Array.from(new Set(active.map((l) => l.style_name)));
  const picked = style ? active.filter((l) => l.style_name === style) : [];
  const from = picked.length ? Math.min(...picked.map((l) => Number(l.price))) : null;
  const where = braider.campus_area ? campusLabel(braider.campus_area) : "On campus";
  const line =
    style && from !== null
      ? `${cap(style)} from ${formatPrice(from)}`
      : where;
  const rating =
    braider.average_rating !== null && braider.average_rating !== undefined
      ? `★ ${braider.average_rating.toFixed(1)}${braider.review_count > 0 ? ` (${braider.review_count})` : ""}`
      : "New";
  return (
    <Link to={`/braiders/${braider.id}`} className="braider-card">
      <div className="photo-frame" style={{ background: TINTS[braider.id % TINTS.length] }}>
        {braider.photo_url ? (
          <img src={sizedFace(braider.photo_url, 700, 525)} alt={braider.display_name} loading="lazy" />
        ) : (
          <span className="photo-none">No photo yet</span>
        )}
      </div>
      <div className="body">
        <div className="name-row">
          <h3>{braider.display_name}</h3>
          <span className="rating">{rating}</span>
        </div>
        <div className="where">{line}</div>
        <div className="labels">
          {names.length === 0 ? (
            <span className="style-chip">No prices listed yet</span>
          ) : (
            names.map((n) => (
              <span key={n} className={`style-chip${style && n === style ? " on" : ""}`}>
                {cap(n)}
              </span>
            ))
          )}
        </div>
      </div>
    </Link>
  );
}

export function ListingRow({ listing }: { listing: Listing }) {
  return (
    <div className="listing">
      {listing.photo_url ? (
        <img className="thumb" src={sized(listing.photo_url, 240)} alt="" loading="lazy" />
      ) : (
        <span className="thumb" aria-hidden="true" />
      )}
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
