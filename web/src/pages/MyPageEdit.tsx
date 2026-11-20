import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, CAMPUS_AREAS, sized, type Braider } from "../lib/api";

/** Edit the public page: photo, name, area, Instagram, bio and payment handles. */
export default function MyPageEdit() {
  const [p, setP] = useState<Braider | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.myBraiderProfile().then(setP).catch((e) => setError(e instanceof Error ? e.message : "Could not load."));
  }, []);

  if (!p) return <main className="dash-main"><h1>Edit my page</h1>{error ? <p className="error">{error}</p> : <p className="muted" style={{ marginTop: 16 }}>Loading…</p>}</main>;
  const set = (patch: Partial<Braider>) => setP({ ...p, ...patch });

  const upload = async (f: File | undefined) => {
    if (!f) return;
    setError("");
    try {
      set({ photo_url: (await api.uploadPhoto(f, "profile")).url });
    } catch (e) {
      setError(e instanceof Error ? e.message : "That photo could not be uploaded.");
    } finally {
      if (input.current) input.current.value = "";
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      setP(
        await api.updateBraiderProfile({
          display_name: p.display_name,
          bio: p.bio,
          campus_area: p.campus_area,
          location_detail: p.location_detail,
          instagram: p.instagram,
          photo_url: p.photo_url,
          years_experience: p.years_experience,
          venmo_handle: p.venmo_handle ?? "",
          zelle_contact: p.zelle_contact ?? "",
        }),
      );
      setNotice("Saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the profile.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="join-main" style={{ paddingTop: 8 }}>
      <h1>Edit my page</h1>
      <form className="join-form" onSubmit={save}>
        <section className="join-card join-photo">
          <button type="button" className="join-slot round" style={{ width: 96, height: 96 }} aria-label="Change your photo" onClick={() => input.current?.click()}>
            {p.photo_url ? <img src={sized(p.photo_url, 192)} alt="" /> : null}
          </button>
          <div className="field" style={{ flex: "1 1 240px" }}>
            <strong>Your photo</strong>
            <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => input.current?.click()}>
              Upload a photo
            </button>
            <span className="hint">A clear photo of you or your work, only with your say-so. You can remove it any time.</span>
          </div>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => upload(e.target.files?.[0])} />
        </section>

        <section className="join-card stack-14">
          <div className="field">
            <label htmlFor="e-name">Name</label>
            <input id="e-name" value={p.display_name} onChange={(e) => set({ display_name: e.target.value })} required />
          </div>
          <div className="field">
            <label htmlFor="e-area">Campus area</label>
            <select id="e-area" value={p.campus_area} onChange={(e) => set({ campus_area: e.target.value })}>
              <option value="">Pick an area</option>
              {Object.entries(CAMPUS_AREAS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="e-loc">Where clients meet you</label>
            <input id="e-loc" value={p.location_detail} onChange={(e) => set({ location_detail: e.target.value })} placeholder="Dorm lounge, apartment" />
          </div>
          <div className="field">
            <label htmlFor="e-ig">Instagram</label>
            <input id="e-ig" value={p.instagram} onChange={(e) => set({ instagram: e.target.value })} placeholder="@handle" />
          </div>
          <div className="field">
            <label htmlFor="e-yrs">Years braiding</label>
            <input id="e-yrs" type="number" min={0} value={p.years_experience} onChange={(e) => set({ years_experience: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label htmlFor="e-bio">Bio</label>
            <textarea id="e-bio" rows={3} value={p.bio} onChange={(e) => set({ bio: e.target.value })} placeholder="What you do best, how long you have been braiding" />
          </div>
        </section>

        <section className="join-card stack-14">
          <h2>Get paid</h2>
          <div className="field">
            <label htmlFor="e-venmo">Venmo</label>
            <input id="e-venmo" value={p.venmo_handle ?? ""} onChange={(e) => set({ venmo_handle: e.target.value })} placeholder="@handle" />
          </div>
          <div className="field">
            <label htmlFor="e-zelle">Zelle</label>
            <input id="e-zelle" value={p.zelle_contact ?? ""} onChange={(e) => set({ zelle_contact: e.target.value })} placeholder="Email or phone" />
          </div>
          <p className="form-note" style={{ margin: 0 }}>Clients only see these after you accept their request.</p>
        </section>

        {error && <p className="error" role="alert">{error}</p>}
        {notice && <p className="notice" role="status">{notice}</p>}
        <button type="submit" className="btn btn-block" style={{ padding: 16 }} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
          <Link to={`/braiders/${p.id}`} style={{ fontWeight: 600 }}>See my page</Link>
          <button
            type="button"
            className="link-btn danger"
            onClick={async () => {
              if (!window.confirm("Remove every photo you uploaded, from your page and from storage? This can't be undone.")) return;
              try {
                const r = await api.deleteAllMyPhotos();
                setNotice(`Removed ${r.removed} photo${r.removed === 1 ? "" : "s"}.`);
                setP(await api.myBraiderProfile());
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not remove photos.");
              }
            }}
          >
            Remove all my photos
          </button>
        </div>
      </form>
    </main>
  );
}
