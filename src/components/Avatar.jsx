import { useEffect, useState } from "react";
import { fetchWithDeadline } from "../state/request.js";
import DefaultAvatar from "./DefaultAvatar.jsx";
import Icon from "./Icon.jsx";

export default function Avatar({
  image,
  name = "",
  identity,
  color = "",
  size,
  verified = false,
}) {
  const [failedImage, setFailedImage] = useState(null);
  const [download, setDownload] = useState(null);
  const protectedImage = image?.startsWith("/api/avatars/");
  useEffect(() => {
    if (!protectedImage) return;
    let stopped = false;
    fetchWithDeadline(image, {
      headers: {
        Authorization: `Bearer ${sessionStorage.getItem("synergy-session")}`,
      },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const blob = await response.blob();
        const url = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        if (!stopped) {
          setDownload({ image, url });
          setFailedImage(null);
        }
      })
      .catch(() => {
        if (!stopped) setFailedImage(image);
      });
    return () => {
      stopped = true;
    };
  }, [image, protectedImage]);
  const source = protectedImage
    ? download?.image === image
      ? download.url
      : null
    : image;
  return (
    // A verified account carries a small check on its photo wherever it
    // appears. The picture is decorative, so the word "Verified" is given
    // beside the name where it matters.
    <div
      className={"avatar " + color + (verified ? " is-verified" : "")}
      style={size ? { width: size, height: size } : undefined}
      aria-hidden="true"
    >
      {source && failedImage !== image ? (
        <img
          key={image}
          src={source}
          alt=""
          decoding="async"
          onError={() => setFailedImage(image)}
        />
      ) : (
        <DefaultAvatar identity={identity} name={name} />
      )}
      {verified && (
        <span className="avatar-check">
          <Icon name="check" />
        </span>
      )}
    </div>
  );
}
