// With sign-in email on, a new account waits on "Check your inbox" until its
// email is verified. Preview accounts never verify.
export const awaitingVerification = (state) =>
  Boolean(
    state.authenticated &&
    state.integrations?.emailAuth &&
    !state.integrations.guest &&
    !state.emailVerified,
  );

// Sessions live in one tab (sessionStorage), so the verification link opens
// signed out in a tab of its own. Tabs of this browser talk over this
// channel: the link's tab says the email is verified, and the tab still on
// "Check your inbox" opens the workspace and answers, so the link's tab can
// send the person back to it instead of asking them to sign in again.
export const verifiedMessage = "email-verified";
export const continuedMessage = "workspace-continued";
export function openAccountChannel() {
  try {
    return new BroadcastChannel("synergy-account");
  } catch {
    // No BroadcastChannel: the link's tab offers sign-in, as on another device.
    return null;
  }
}
