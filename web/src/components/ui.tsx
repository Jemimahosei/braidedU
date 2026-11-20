import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  campusLabel,
  formatDuration,
  formatPrice,
  initials,
  sized,
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
}: {
  name: string;
  src?: string;
  large?: boolean;
}) {
  const cls = large ? "avatar avatar-lg" : "avatar";
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
  const shown = active.slice(0, 3);
  return (
    <article className="braider-card">
      <Link to={`/braiders/${braider.id}`} className="photo-frame" aria-label={`${braider.display_name}'s profile`}>
        {braider.photo_url ? (
          <img src={sized(braider.photo_url, 700)} alt="" loading="lazy" />
        ) : (
          <span className="photo-empty" aria-hidden="true">
            {initials(braider.display_name)}
          </span>
        )}
      </Link>
      <div className="body">
        <h3>
          <Link to={`/braiders/${braider.id}`}>{braider.display_name}</Link>
        </h3>
        <div className="where">
          {where}
          {braider.years_experience > 0 && `, ${braider.years_experience} yrs braiding`}
          {braider.match_score !== undefined && `, match ${braider.match_score}/100`}
        </div>
        <div>
          <Stars rating={braider.average_rating} />
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
    </article>
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
