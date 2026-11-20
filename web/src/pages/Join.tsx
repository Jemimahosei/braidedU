import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api, cap, CAMPUS_AREAS, sized, type BraidStyle } from "../lib/api";
import { useAuth } from "../lib/auth";

/** Upload one photo: returns an opener, the hidden file input and any error. */
function usePhotoUpload(kind: "profile" | "work", onChange: (u: string) => void) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const pick = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    setErr("");
    try {
      onChange((await api.uploadPhoto(f, kind)).url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "That photo could not be uploaded.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  return {
    busy,
    err,
    open: () => input.current?.click(),
    field: <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => pick(e.target.files?.[0])} />,
  };
}

/** One dashed photo slot: click to upload, shows the photo once there is one. */
function PhotoSlot({
  url,
  onChange,
  kind,
  round,
  size,
  label,
}: {
  url: string;
  onChange: (u: string) => void;
  kind: "profile" | "work";
  round?: boolean;
  size: number;
  label: string;
}) {
  const up = usePhotoUpload(kind, onChange);
  return (
    <>
      <button
        type="button"
        className={`join-slot${round ? " round" : ""}`}
        style={{ width: size, height: size }}
        aria-label={url ? "Change photo" : "Add photo"}
        onClick={up.open}
        title={up.err || undefined}
      >
        {url ? <img src={sized(url, size * 2)} alt="" /> : up.busy ? "…" : label}
      </button>
      {up.field}
    </>
  );
}

interface Row {
  style: string;
  price: string;
  hours: string;
  photo: string;
}
const blank = (): Row => ({ style: "", price: "", hours: "", photo: "" });

/** Braider sign-up details (mockup: Join.dc.html). Shown right after the email is confirmed. */
export default function Join() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [styles, setStyles] = useState<BraidStyle[]>([]);
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [ig, setIg] = useState("");
  const [photo, setPhoto] = useState("");
  const [venmo, setVenmo] = useState("");
  const [zelle, setZelle] = useState("");
  const [rows, setRows] = useState<Row[]>([blank(), blank()]);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const mine = usePhotoUpload("profile", setPhoto);

  useEffect(() => {
    if (user?.role !== "braider") return;
    api.styles().then(setStyles).catch(() => setStyles([]));
    api
      .myBraiderProfile()
      .then((p) => {
        setName(p.display_name || "");
        setArea(p.campus_area || "");
        setIg(p.instagram || "");
        setPhoto(p.photo_url || "");
        setVenmo(p.venmo_handle || "");
        setZelle(p.zelle_contact || "");
      })
      .catch(() => {});
  }, [user]);

  if (!user) return <Navigate to="/login?next=/join" replace />;
  if (user.role !== "braider") return <Navigate to="/dashboard" replace />;

  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.updateBraiderProfile({
        display_name: name.trim(),
        campus_area: area,
        instagram: ig.trim(),
        photo_url: photo,
        venmo_handle: venmo.trim(),
        zelle_contact: zelle.trim(),
      });
      for (const r of rows) {
        const st = styles.find((s) => String(s.id) === r.style);
        if (!st || !r.price || !r.hours) continue;
        await api.createListing({
          style: st.id,
          title: cap(st.name),
          description: "",
          price: r.price,
          duration_minutes: Math.round(Number(r.hours) * 60),
          photo_url: r.photo,
        });
      }
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your page.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="join-main">
      <h1>List your chair</h1>
      <form className="join-form" onSubmit={submit}>
        <section className="join-card join-photo">
          <button type="button" className="join-slot round" style={{ width: 96, height: 96 }} aria-label={photo ? "Change your photo" : "Add your photo"} onClick={mine.open}>
            {photo ? <img src={sized(photo, 192)} alt="" /> : null}
          </button>
          <div className="field" style={{ flex: "1 1 240px" }}>
            <strong>Your photo</strong>
            <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} disabled={mine.busy} onClick={mine.open}>
              {mine.busy ? "Uploading…" : "Upload a photo"}
            </button>
            {mine.err && <span className="hint" style={{ color: "var(--bad)" }}>{mine.err}</span>}
            {mine.field}
          </div>
        </section>

        <section className="join-card stack-14">
          <div className="field">
            <label htmlFor="j-name">Name</label>
            <input id="j-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="j-area">Campus area</label>
            <select id="j-area" value={area} onChange={(e) => setArea(e.target.value)} required>
              <option value="">Pick one</option>
              {Object.entries(CAMPUS_AREAS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="j-ig">Instagram</label>
            <input id="j-ig" value={ig} onChange={(e) => setIg(e.target.value)} placeholder="@handle" />
          </div>
        </section>

        <section className="join-card">
          <h2>Your styles</h2>
          <div className="join-rows">
            {rows.map((r, i) => (
              <div key={i} className="join-row">
                <PhotoSlot url={r.photo} onChange={(u) => setRow(i, { photo: u })} kind="work" size={64} label="Photo" />
                <select aria-label="Style" value={r.style} onChange={(e) => setRow(i, { style: e.target.value })}>
                  <option value="">Style</option>
                  {styles.map((s) => (
                    <option key={s.id} value={s.id}>
                      {cap(s.name)}
                    </option>
                  ))}
                </select>
                <input aria-label="Price in dollars" inputMode="numeric" placeholder="$" value={r.price} onChange={(e) => setRow(i, { price: e.target.value.replace(/[^0-9]/g, "") })} style={{ width: 72 }} />
                <input aria-label="Hours" inputMode="decimal" placeholder="hrs" value={r.hours} onChange={(e) => setRow(i, { hours: e.target.value.replace(/[^0-9.]/g, "") })} style={{ width: 64 }} />
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} onClick={() => setRows((rs) => (rs.length < 8 ? [...rs, blank()] : rs))}>
            Add a style
          </button>
        </section>

        <section className="join-card stack-14">
          <h2>Get paid</h2>
          <div className="field">
            <label htmlFor="j-venmo">Venmo</label>
            <input id="j-venmo" value={venmo} onChange={(e) => setVenmo(e.target.value)} placeholder="@handle" />
          </div>
          <div className="field">
            <label htmlFor="j-zelle">Zelle</label>
            <input id="j-zelle" value={zelle} onChange={(e) => setZelle(e.target.value)} placeholder="Email or phone" />
          </div>
          <p className="form-note" style={{ margin: 0 }}>Clients only see these after you accept their request.</p>
        </section>

        <label className="join-agree">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} required />
          <span>I agree to be listed with my name, photos and Instagram. I can remove them any time.</span>
        </label>

        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-block" disabled={busy || !agree}>
          {busy ? "Saving…" : "Create my page"}
        </button>
      </form>
    </main>
  );
}
