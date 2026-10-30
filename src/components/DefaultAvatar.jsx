import { avatarAppearance } from "../data/avatar.js";

export default function DefaultAvatar({ identity, name }) {
  const { background, ink } = avatarAppearance({ identity, name });
  return (
    <svg
      className="avatar-default"
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <path fill={background} d="M0 0h64v64H0z" />
      <circle cx="32" cy="25" r="9" fill={ink} />
      <path d="M16 49c0-8 7-12 16-12s16 4 16 12v2H16z" fill={ink} />
    </svg>
  );
}
