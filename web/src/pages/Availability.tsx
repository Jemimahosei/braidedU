import { useEffect, useState } from "react";
import { api, formatDate, SERVICE_PLACES, type Braider, type TimeOff } from "../lib/api";

const DAYS: [string, string][] = [
  ["mon", "Monday"],
  ["tue", "Tuesday"],
  ["wed", "Wednesday"],
  ["thu", "Thursday"],
  ["fri", "Friday"],
  ["sat", "Saturday"],
  ["sun", "Sunday"],
];

const PLACE_LABEL: Record<string, string> = {
  my_place: "My place",
  client_place: "Client's place",
  campus_space: "Campus space",
};

const clock = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${h >= 12 ? "pm" : "am"}`;
};
const hourly = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => `${String(from + i).padStart(2, "0")}:00`);

/** Include the saved value even when it is not on the hourly list. */
const withCurrent = (opts: string[], cur: string) => (cur && !opts.includes(cur) ? [...opts, cur].sort() : opts);

const BUFFERS: [number, string][] = [
  [30, "30 minutes"],
  [60, "1 hour"],
  [0, "None"],
];
const CANCEL: [number, string][] = [
  [24, "24 hours before"],
  [48, "48 hours before"],
  [72, "72 hours before"],
];

/** Braider availability and rules (mockup: Availability.dc.html). */
export default function Availability() {
  const [p, setP] = useState<Braider | null>(null);
  const [off, setOff] = useState<TimeOff[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = () => {
    api.myBraiderProfile().then(setP).catch((e) => setError(e instanceof Error ? e.message : "Could not load."));
    api.timeOff().then(setOff).catch(() => setOff([]));
  };
  useEffect(load, []);

  if (!p) return <main className="dash-main"><h1>Availability and rules</h1>{error ? <p className="error">{error}</p> : <p className="muted" style={{ marginTop: 16 }}>Loading…</p>}</main>;

  const set = (patch: Partial<Braider>) => setP({ ...p, ...patch });
  const start = p.available_start_time?.slice(0, 5) || "10:00";
  const end = p.available_end_time?.slice(0, 5) || "18:00";
  const toggleDay = (d: string) =>
    set({ available_days: p.available_days.includes(d) ? p.available_days.filter((x) => x !== d) : [...p.available_days, d] });
  const togglePlace = (k: string) =>
    set({ service_places: p.service_places.includes(k) ? p.service_places.filter((x) => x !== k) : [...p.service_places, k] });

  const save = async () => {
    setError("");
    setNotice("");
    try {
      const updated = await api.updateBraiderProfile({
        service_places: p.service_places,
        private_address: p.private_address ?? "",
        available_days: p.available_days,
        available_start_time: start,
        available_end_time: end,
        buffer_minutes: p.buffer_minutes,
        cancel_window_hours: p.cancel_window_hours,
        deposit_note: p.deposit_note,
        policy_text: p.policy_text,
        reminders_enabled: p.reminders_enabled,
      });
      setP(updated);
      setNotice("Saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    }
  };

  const block = async () => {
    setError("");
    if (!from) {
      setError("Pick the first day to block.");
      return;
    }
    try {
      await api.addTimeOff({ start_date: from, end_date: to || from, note });
      setFrom("");
      setTo("");
      setNote("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add time off.");
    }
  };
  const offLabel = (t: TimeOff) =>
    `${t.note ? `${t.note}, ` : ""}${formatDate(t.start_date)}${t.end_date !== t.start_date ? ` to ${formatDate(t.end_date)}` : ""}`;

  const starts = withCurrent(hourly(6, 14), start);
  const ends = withCurrent(hourly(15, 22), end);
  const bufferOpts = BUFFERS.some(([m]) => m === p.buffer_minutes) ? BUFFERS : [...BUFFERS, [p.buffer_minutes, `${p.buffer_minutes} minutes`] as [number, string]];
  const cancelOpts = CANCEL.some(([h]) => h === p.cancel_window_hours) ? CANCEL : [...CANCEL, [p.cancel_window_hours, `${p.cancel_window_hours} hours before`] as [number, string]];

  return (
    <main className="dash-main avail">
      <h1>Availability and rules</h1>

      <section className="join-card">
        <h2>Where you braid</h2>
        <div className="pick-row">
          {Object.keys(SERVICE_PLACES).map((k) => (
            <button key={k} type="button" className="pick" aria-pressed={p.service_places.includes(k)} onClick={() => togglePlace(k)}>
              {PLACE_LABEL[k] || SERVICE_PLACES[k]}
            </button>
          ))}
        </div>
        {p.service_places.includes("my_place") && (
          <div className="field" style={{ marginTop: 16 }}>
            <label htmlFor="a-addr">Address</label>
            <input id="a-addr" value={p.private_address ?? ""} onChange={(e) => set({ private_address: e.target.value })} placeholder="Street, building or room" />
            <span className="hint">Clients only see this after you accept their request.</span>
          </div>
        )}
      </section>

      <section className="join-card">
        <h2>Weekly hours</h2>
        <div className="week">
          {DAYS.map(([k, label]) => {
            const on = p.available_days.includes(k);
            return (
              <div key={k} className="week-row">
                <button type="button" className="day-btn" aria-pressed={on} onClick={() => toggleDay(k)}>
                  {label}
                </button>
                <span style={{ opacity: on ? 1 : 0.5 }}>
                  <select aria-label={`${label} from`} disabled={!on} value={start} onChange={(e) => set({ available_start_time: e.target.value })}>
                    {starts.map((t) => (
                      <option key={t} value={t}>{clock(t)}</option>
                    ))}
                  </select>
                </span>
                <span style={{ color: "var(--ink-3)" }}>to</span>
                <span style={{ opacity: on ? 1 : 0.5 }}>
                  <select aria-label={`${label} until`} disabled={!on} value={end} onChange={(e) => set({ available_end_time: e.target.value })}>
                    {ends.map((t) => (
                      <option key={t} value={t}>{clock(t)}</option>
                    ))}
                  </select>
                </span>
                <span className="week-note">{on ? "" : "Not taking clients"}</span>
              </div>
            );
          })}
        </div>
        <div className="field" style={{ marginTop: 18, maxWidth: 280 }}>
          <label htmlFor="a-buf">Break between clients</label>
          <select id="a-buf" value={p.buffer_minutes} onChange={(e) => set({ buffer_minutes: Number(e.target.value) })}>
            {bufferOpts.map(([m, l]) => (
              <option key={m} value={m}>{l}</option>
            ))}
          </select>
        </div>
        <p className="form-note" style={{ marginTop: 12 }}>
          Same hours on every day you take clients. Clients only see times that fit the whole style. A 6 hour install can't be booked in the middle of another one.
        </p>
      </section>

      <section className="join-card">
        <h2>Time off</h2>
        <div className="off-chips">
          {off.map((t) => (
            <span key={t.id} className="off-chip">
              {offLabel(t)}
              <button type="button" aria-label={`Remove ${offLabel(t)}`} onClick={async () => { await api.removeTimeOff(t.id); load(); }}>
                &times;
              </button>
            </span>
          ))}
        </div>
        <div className="off-form">
          <label htmlFor="a-off-from" className="sr-only">First day to block</label>
          <input id="a-off-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ flex: "1 1 150px" }} />
          <label htmlFor="a-off-to" className="sr-only">Last day to block</label>
          <input id="a-off-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} style={{ flex: "1 1 150px" }} />
          <label htmlFor="a-off" className="sr-only">Note</label>
          <input id="a-off" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Finals, May 5 to 12" style={{ flex: "1 1 220px" }} />
          <button type="button" className="btn btn-ghost" onClick={block}>
            Block dates
          </button>
        </div>
      </section>

      <section className="join-card">
        <h2>Your rules</h2>
        <div className="rules-row">
          <div className="field" style={{ flex: "1 1 220px" }}>
            <label htmlFor="a-can">Free to cancel until</label>
            <select id="a-can" value={p.cancel_window_hours} onChange={(e) => set({ cancel_window_hours: Number(e.target.value) })}>
              {cancelOpts.map(([h, l]) => (
                <option key={h} value={h}>{l}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: "1 1 220px" }}>
            <label htmlFor="a-dep">Deposit</label>
            <input id="a-dep" value={p.deposit_note} onChange={(e) => set({ deposit_note: e.target.value })} placeholder="None, or e.g. $20 up front" />
          </div>
        </div>
        <div className="field" style={{ marginTop: 14 }}>
          <label htmlFor="a-pol">Shown to clients</label>
          <textarea id="a-pol" rows={2} value={p.policy_text} onChange={(e) => set({ policy_text: e.target.value })} placeholder="Late over 15 minutes? Tell me ahead or the deposit is kept." />
        </div>
        <button type="button" className="switch" style={{ marginTop: 16 }} aria-pressed={p.reminders_enabled} onClick={() => set({ reminders_enabled: !p.reminders_enabled })}>
          <i />
          <span>Email you and the client the day before</span>
        </button>
      </section>

      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="notice" role="status">{notice}</p>}
      <button type="button" className="btn save-btn" onClick={save}>
        Save
      </button>
    </main>
  );
}
