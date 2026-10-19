export default function Avatar({ initials, color = "" }) {
  return <div className={"avatar " + color}>{initials}</div>;
}
