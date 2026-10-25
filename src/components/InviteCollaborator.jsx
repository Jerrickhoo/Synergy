import { useState } from "react";
export default function InviteCollaborator() {
  const [copied, setCopied] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const url = `${window.location.origin}${window.location.pathname}#/signup`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setShowLink(true);
    }
  }
  return (
    <div className="invite-collaborator">
      <button className="btn" onClick={copy}>
        {copied ? "Invitation link copied" : "Copy invitation link"}
      </button>
      <p className="muted">
        Share this link to invite someone to Synergy.
        {["localhost", "127.0.0.1", "[::1]"].includes(
          window.location.hostname,
        ) &&
          " This app is running locally, so the link works only on this computer."}
      </p>
      {showLink && (
        <label>
          Invitation link
          <input
            readOnly
            value={url}
            onFocus={(event) => event.target.select()}
          />
        </label>
      )}
      <span className="sr-only" role="status">
        {copied ? "Invitation link copied to clipboard." : ""}
      </span>
    </div>
  );
}
