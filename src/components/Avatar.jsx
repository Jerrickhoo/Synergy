import { useState } from "react";

export default function Avatar({
  image,
  name = "",
  initials,
  fallback,
  color = "",
  size,
}) {
  const [failedImage, setFailedImage] = useState(null);
  const letters =
    fallback ||
    initials ||
    name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ||
    "?";
  return (
    <div
      className={"avatar " + color}
      style={size ? { width: size, height: size } : undefined}
      aria-hidden="true"
    >
      {image && failedImage !== image ? (
        <img
          key={image}
          src={image}
          alt=""
          decoding="async"
          onError={() => setFailedImage(image)}
        />
      ) : (
        letters
      )}
    </div>
  );
}
