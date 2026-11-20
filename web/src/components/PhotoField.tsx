import { useRef, useState } from "react";
import { api, sized, type PhotoKind } from "../lib/api";

/**
 * Upload one or more photos. Calls the API for each file and hands the
 * resulting links back to the parent. Previews are shown with a remove button.
 */
export function PhotoField({
  kind,
  urls,
  onChange,
  max = 1,
  label = "Add",
  variant = "default",
}: {
  kind: PhotoKind;
  urls: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  label?: string;
  variant?: "default" | "slots";
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pick = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const next = [...urls];
      for (const file of Array.from(files)) {
        if (next.length >= max) break;
        const photo = await api.uploadPhoto(file, kind);
        next.push(photo.url);
      }
      onChange(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That photo could not be uploaded.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  if (variant === "slots") {
    // Mockup style: a ghost button and a row of small dashed slots.
    return (
      <div>
        <div className="photo-slots">
          <button type="button" className="btn btn-ghost" disabled={busy || urls.length >= max} onClick={() => input.current?.click()}>
            {busy ? "Uploading…" : label}
          </button>
          {max > 1 || urls.length > 0 ? (
            <span className="slots" aria-label={`Photo slots, up to ${max}`}>
              {Array.from({ length: max }).map((_, i) =>
                urls[i] ? (
                  <button
                    key={i}
                    type="button"
                    className="slot-photo"
                    aria-label="Remove photo"
                    onClick={() => onChange(urls.filter((x) => x !== urls[i]))}
                  >
                    <img src={sized(urls[i], 120)} alt="" />
                  </button>
                ) : (
                  <span key={i} className="slot-empty" />
                ),
              )}
            </span>
          ) : null}
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple={max > 1}
            hidden
            onChange={(e) => pick(e.target.files)}
          />
        </div>
        {error && (
          <p className="error" role="alert" style={{ marginTop: "0.6rem" }}>
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="photo-field">
        {urls.map((u) => (
          <span className="photo-thumb" key={u}>
            <img src={sized(u, 200)} alt="" />
            <button
              type="button"
              aria-label="Remove photo"
              onClick={() => onChange(urls.filter((x) => x !== u))}
            >
              ×
            </button>
          </span>
        ))}
        {urls.length < max && (
          <button
            type="button"
            className="photo-add"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            {busy ? "Uploading…" : label}
          </button>
        )}
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple={max > 1}
          hidden
          onChange={(e) => pick(e.target.files)}
        />
      </div>
      {error && (
        <p className="error" role="alert" style={{ marginTop: "0.6rem" }}>
          {error}
        </p>
      )}
    </div>
  );
}
