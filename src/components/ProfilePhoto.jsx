import { useEffect, useRef, useState } from "react";
import Avatar from "./Avatar.jsx";
import Icon from "./Icon.jsx";

// One picture with its own upload, remove and error state.
function PhotoSlot({ slot, identity, onChange, onReadingChange, disabled }) {
  const { key, image, title, detail, avatarName, noun, chooseLabel } = slot;
  const input = useRef(null);
  const selection = useRef(0);
  const change = useRef(onChange);
  change.current = onChange;
  const reportReading = useRef(onReadingChange);
  reportReading.current = onReadingChange;
  useEffect(
    () => () => {
      ++selection.current;
      reportReading.current(key, false);
    },
    [key],
  );
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  async function select(event) {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    const current = ++selection.current;
    setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPEG, PNG or WebP image.");
      return;
    }
    if (!file.size || file.size > 5 * 1024 * 1024) {
      setError("Choose a nonempty image up to 5 MB.");
      return;
    }
    setReading(true);
    reportReading.current(key, true);
    const url = URL.createObjectURL(file);
    try {
      const picture = new Image();
      picture.src = url;
      await picture.decode();
      if (!picture.naturalWidth || !picture.naturalHeight) throw new Error();
      const scale = Math.min(
        1,
        768 / Math.max(picture.naturalWidth, picture.naturalHeight),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(picture.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(picture.naturalHeight * scale));
      canvas
        .getContext("2d")
        .drawImage(picture, 0, 0, canvas.width, canvas.height);
      if (current === selection.current)
        change.current(key, canvas.toDataURL("image/webp", 0.9));
    } catch {
      if (current === selection.current)
        setError(
          "This image could not be opened. Choose a different JPEG, PNG or WebP.",
        );
    } finally {
      URL.revokeObjectURL(url);
      if (current === selection.current) {
        setReading(false);
        reportReading.current(key, false);
      }
    }
  }
  return (
    <div className="profile-photo-body" data-slot={key}>
      <Avatar image={image} name={avatarName} identity={identity} size={88} />
      <div className="profile-photo-copy">
        <strong className="profile-photo-name">{title}</strong>
        {detail && <span className="profile-photo-role">{detail}</span>}
        <div className="profile-photo-actions">
          <button
            className="btn small"
            type="button"
            disabled={disabled || reading}
            onClick={() => input.current.click()}
          >
            <Icon name="camera" />
            {image ? "Change" : "Upload"}
            <span className="visually-hidden"> {noun}</span>
          </button>
          {image && (
            <button
              className="btn small"
              type="button"
              disabled={disabled || reading}
              onClick={() => {
                ++selection.current;
                setError("");
                onChange(key, "");
              }}
            >
              <Icon name="trash" />
              Remove
              <span className="visually-hidden"> {noun}</span>
            </button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          className="visually-hidden"
          tabIndex={-1}
          aria-label={chooseLabel}
          accept="image/jpeg,image/png,image/webp"
          onChange={select}
        />
        {reading && (
          <p role="status">
            <span className="spinner" aria-hidden="true" /> Opening image…
          </p>
        )}
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

// Founders add a startup logo and their own photo; mentors add one photo.
export default function ProfilePhoto({
  legend,
  slots,
  identity,
  onChange,
  onReadingChange,
  disabled,
}) {
  const [reading, setReading] = useState({});
  const report = useRef(onReadingChange);
  report.current = onReadingChange;
  const busy = Object.values(reading).some(Boolean);
  useEffect(() => {
    report.current(busy);
  }, [busy]);
  return (
    <fieldset
      className="card profile-fieldset profile-photo-editor"
      disabled={disabled}
    >
      <legend>{legend}</legend>
      <div
        className={`profile-photo-slots${slots.length > 1 ? " paired" : ""}`}
      >
        {slots.map((slot) => (
          <PhotoSlot
            key={slot.key}
            slot={slot}
            identity={identity}
            disabled={disabled}
            onChange={onChange}
            onReadingChange={(key, value) =>
              setReading((current) =>
                current[key] === value ? current : { ...current, [key]: value },
              )
            }
          />
        ))}
      </div>
      <p className="field-help">
        JPEG, PNG or WebP, up to 5 MB. A new photo stays private until you save
        your profile.
      </p>
    </fieldset>
  );
}
