import { useState } from "react";
import { api, REPORT_REASONS } from "../lib/api";

/** Report or block another person. Shown on profiles and in message threads. */
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
      setMsg(r.blocked ? `${name} is blocked. They can't message or book you.` : `${name} is unblocked.`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "That didn't work.");
    }
  };

  return (
    <div className="stack">
      <div className="row" style={{ gap: "1rem" }}>
        <button type="button" className="link-btn danger" onClick={() => setOpen(!open)}>
          Report {name}
        </button>
        <button type="button" className="link-btn" onClick={toggleBlock}>
          {blocked ? "Unblock" : "Block"}
        </button>
      </div>
      {open && (
        <form onSubmit={send} className="panel soft stack">
          <div>
            <label htmlFor={`rp-${userId}`}>What happened?</label>
            <select id={`rp-${userId}`} required value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">Pick one</option>
              {Object.entries(REPORT_REASONS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`rd-${userId}`}>Details (optional)</label>
            <textarea id={`rd-${userId}`} rows={3} value={detail} onChange={(e) => setDetail(e.target.value)} />
          </div>
          <button className="btn btn-sm" type="submit">Send report</button>
        </form>
      )}
      {msg && <p className="notice" role="status">{msg}</p>}
    </div>
  );
}
