import { useEffect, useRef, useState } from "react";
import Avatar from "./Avatar.jsx";
import Icon from "./Icon.jsx";

export default function ProfilePhoto({
  image,
  name,
  role,
  identity,
  onChange,
  onReadingChange,
  disabled,
}) {
  const input = useRef(null);
  const selection = useRef(0);
  const change = useRef(onChange);
  change.current = onChange;
  useEffect(
    () => () => {
      ++selection.current;
      onReadingChange(false);
    },
    [onReadingChange],
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
    onReadingChange(true);
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
        change.current(canvas.toDataURL("image/webp", 0.9));
    } catch {
      if (current === selection.current)
        setError(
          "This image could not be opened. Choose a different JPEG, PNG or WebP.",
        );
    } finally {
      URL.revokeObjectURL(url);
      if (current === selection.current) {
        setReading(false);
        onReadingChange(false);
      }
    }
  }
  return (
    <fieldset
      className="card profile-fieldset profile-photo-editor"
      disabled={disabled || reading}
    >
      <legend>Profile photo</legend>
      <div className="profile-photo-body">
        <Avatar image={image} name={name} identity={identity} size={88} />
        <div className="profile-photo-copy">
          <strong className="profile-photo-name">{name}</strong>
          {role && <span className="profile-photo-role">{role}</span>}
          <div className="profile-photo-actions">
            <button
              className="btn small"
              type="button"
              onClick={() => input.current.click()}
            >
              <Icon name="camera" />
              {image ? "Change photo" : "Upload photo"}
            </button>
            {image && (
              <button
                className="btn small"
                type="button"
                onClick={() => {
                  ++selection.current;
                  setError("");
                  onChange("");
                }}
              >
                <Icon name="trash" />
                Remove photo
              </button>
            )}
          </div>
          <input
            ref={input}
            type="file"
            className="visually-hidden"
            tabIndex={-1}
            aria-label="Choose profile photo"
            accept="image/jpeg,image/png,image/webp"
            onChange={select}
          />
          <p className="field-help">
            JPEG, PNG or WebP, up to 5 MB. A new photo stays private until you
            save your profile.
          </p>
          {reading && <p role="status">Opening image…</p>}
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </fieldset>
  );
}
