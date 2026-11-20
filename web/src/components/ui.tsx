import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  campusLabel,
  formatDuration,
  formatPrice,
  initials,
  type Braider,
  type Listing,
} from "../lib/api";

const AVATAR_TONES = ["#1a2a9e", "#15131f", "#7a3b1e", "#1f7a4d", "#8a2a5c", "#3a4a6b"];

export function toneFor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

export function Avatar({ name, large }: { name: string; large?: boolean }) {
  return (
    <span
      className={large ? "avatar avatar-lg" : "avatar"}
      style={{ background: toneFor(name) }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

/** Three strands weaving across the hero. Drawn once on load, never looped. */
export function Strands() {
  const W = 1440;
  const H = 110;
  const make = (phase: number) => {
    const pts: string[] = [];
    for (let x = 0; x <= W; x += 12) {
      const y = H / 2 + 34 * Math.sin((x / W) * Math.PI * 2 * 5 + phase);
      pts.push(`${x === 0 ? "M" : "L"}${x} ${y.toFixed(1)}`);
    }
    return pts.join(" ");
  };
  return (
    <svg
      className="strands"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <path className="s3" pathLength={1} d={make((Math.PI * 4) / 3)} />
      <path className="s2" pathLength={1} d={make((Math.PI * 2) / 3)} />
      <path className="s1" pathLength={1} d={make(0)} />
    </svg>
  );
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

export function BraiderRow({ braider }: { braider: Braider }) {
  const active = braider.listings.filter((l) => l.is_active);
  const from = active.length ? Math.min(...active.map((l) => Number(l.price))) : null;
  const styles = [...new Set(active.map((l) => l.style_name))];
  const where = braider.campus_area ? campusLabel(braider.campus_area) : "On campus";
  return (
    <article className="braider-row">
      <Avatar name={braider.display_name} />
      <div>
        <h3>
          <Link to={`/braiders/${braider.id}`}>{braider.display_name}</Link>
        </h3>
        <div className="styles">{styles.length ? styles.slice(0, 5).map(titleCase).join(", ") : "No styles listed yet"}</div>
        <div className="where">
          {where}
          {braider.years_experience > 0 && `, ${braider.years_experience} yrs braiding`}
          {braider.match_score !== undefined && `, match ${braider.match_score}/100`}
        </div>
        <div style={{ marginTop: "0.3rem" }}>
          {braider.is_demo && <DemoBadge />} <Stars rating={braider.average_rating} />
          {braider.review_count > 0 && <span className="muted"> ({braider.review_count})</span>}
        </div>
      </div>
      <div className="cost">
        {from !== null ? (
          <span className="price">
            <small>from </small>
            {formatPrice(from)}
          </span>
        ) : (
          <span className="small">No prices yet</span>
        )}
        <Link to={`/braiders/${braider.id}`} className="btn btn-ghost btn-sm">
          View profile
        </Link>
      </div>
    </article>
  );
}

export function ListingRow({ listing }: { listing: Listing }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "1rem",
        flexWrap: "wrap",
        padding: "1rem 0",
        borderBottom: "1px solid var(--chalk)",
      }}
    >
      <div>
        <strong>{listing.title}</strong>
        <div className="muted">
          {listing.style_name}, {formatDuration(listing.duration_minutes)}
          {listing.description ? `. ${listing.description}` : ""}
        </div>
      </div>
      <span className="price">{formatPrice(listing.price)}</span>
    </div>
  );
}
