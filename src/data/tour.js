// The quick tour's place in this browser, per account: "done" once someone
// finishes or skips it, "new" when the account was just created here, so
// the tour opens by itself on their first Home.
const key = (accountId) => `synergy-tour:${accountId}`;
const read = (accountId) => {
  try {
    return localStorage.getItem(key(accountId));
  } catch {
    return null;
  }
};
const write = (accountId, value) => {
  try {
    localStorage.setItem(key(accountId), value);
  } catch {
    // Private browsing: the invitation shows again next visit.
  }
};

export const tourDone = (accountId) => read(accountId) === "done";
export const markTourDone = (accountId) => write(accountId, "done");
export const tourPending = (accountId) => read(accountId) === "new";
export function markTourPending(accountId) {
  if (accountId && !tourDone(accountId)) write(accountId, "new");
}
