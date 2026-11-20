import { useState } from "react";
import { api, REPORT_REASONS } from "../lib/api";

/** State and actions for reporting or blocking another person. */
export function useSafety(userId: number, name: string, blocked?: boolean, onBlockChange?: (blocked: boolean) => void) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [msg, setMsg] = useState("");

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setMsg((await api.report(userId, reason, detail)).detail);
      setOpen(false);
      setReason("");
      setDetail("");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not send the report.");
    }
  };

  const toggleBlock = async () => {
    try {
      const r = blocked ? await api.unblock(userId) : await api.block(userId);
      onBlockChange?.(r.blocked);
      setMsg(r.blocked ? `Blocked. ${name} can no longer message you or book you.` : "");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "That didn't work.");
    }
  };

  return { open, setOpen, reason, setReason, detail, setDetail, msg, setMsg, send, toggleBlock };
}

type Safety = ReturnType<typeof useSafety>;

/** The "What happened?" form that opens under Report. */
export function ReportForm({ userId, s }: { userId: number; s: Safety }) {
  if (!s.open) return null;
  return (
    <form onSubmit={s.send} className="report-form">
      <div className="field">
        <label htmlFor={`rp-${userId}`}>What happened?</label>
        <select id={`rp-${userId}`} required value={s.reason} onChange={(e) => s.setReason(e.target.value)}>
          <option value="">Pick one</option>
          {Object.entries(REPORT_REASONS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`rd-${userId}`}>Details (optional)</label>
        <textarea id={`rd-${userId}`} rows={3} value={s.detail} onChange={(e) => s.setDetail(e.target.value)} />
      </div>
      <button className="btn btn-sm" type="submit">Send report</button>
    </form>
  );
}

/** Report or block another person, as small text buttons (profile page). */
export function SafetyMenu({
  userId,
  name,
  blocked,
  onBlockChange,
}: {
  userId: number;
  name: string;
  blocked?: boolean;
  onBlockChange?: (blocked: boolean) => void;
}) {
  const s = useSafety(userId, name, blocked, onBlockChange);
  return (
    <div className="safety">
      <div className="safety-row">
        <button type="button" className="text-btn" onClick={() => s.setOpen(!s.open)}>
          Report {name}
        </button>
        <button type="button" className="text-btn danger" onClick={s.toggleBlock}>
          {blocked ? "Unblock" : "Block"}
        </button>
      </div>
      <ReportForm userId={userId} s={s} />
      {s.msg && <p className="notice" role="status">{s.msg}</p>}
    </div>
  );
}
