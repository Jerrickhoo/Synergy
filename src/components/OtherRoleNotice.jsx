import { useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import PageHeader from "./PageHeader.jsx";

const roleNames = { founder: "founder", mentor: "mentor" };

// A room or match that exists for this account's other role, for example
// after another tab switched the account from founder to mentor. Switching
// uses the same choose-role action as Settings and keeps the current link.
export default function OtherRoleNotice({ role, kind = "room" }) {
  const { state, onAction } = useApp();
  const [switching, setSwitching] = useState(false);
  const name = roleNames[role];
  return (
    <div className="page page-enter">
      <PageHeader
        title={`This ${kind} belongs to your ${name} profile`}
        intro={`You are using Synergy as a ${roleNames[state.role]}. Switch to your ${name} profile to open it. Other open tabs switch too.`}
      />
      <div className="chip-row">
        <button
          className="btn primary"
          disabled={state.busy}
          aria-busy={switching}
          onClick={async (event) => {
            setSwitching(true);
            await onAction({ action: "choose-role", roleChoice: role }, event);
            setSwitching(false);
          }}
        >
          {switching && <span className="spinner" aria-hidden="true" />}
          Switch to {name}
        </button>
        <button
          className="btn"
          onClick={() =>
            onAction({
              page:
                kind === "match"
                  ? "discover"
                  : state.role === "mentor"
                    ? "mentees"
                    : "rooms",
            })
          }
        >
          {kind === "match" ? "Back to matches" : "View your rooms"}
        </button>
      </div>
    </div>
  );
}
