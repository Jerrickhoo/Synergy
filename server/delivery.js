import { randomUUID } from "node:crypto";

// Durable, deduplicated boundary only. The stub never claims email delivery.
export function enqueueDelivery(
  db,
  { key, accountId, kind, payload, availableAt },
  now = Date.now(),
) {
  db.outbox ||= [];
  if (db.outbox.some((entry) => entry.key === key)) return false;
  db.outbox.push({
    id: randomUUID(),
    key,
    accountId,
    kind,
    payload,
    availableAt: availableAt || new Date(now).toISOString(),
    createdAt: new Date(now).toISOString(),
    status: "pending",
  });
  return true;
}
export const stubSender = async () => ({
  delivered: false,
  reason: "Email delivery is not configured; updates are in-app only.",
});
export async function dispatchOutbox(
  db,
  sender = stubSender,
  now = Date.now(),
) {
  for (const entry of db.outbox || []) {
    if (entry.status !== "pending" || Date.parse(entry.availableAt) > now)
      continue;
    const result = await sender(structuredClone(entry));
    if (result.delivered) {
      entry.status = "sent";
      entry.sentAt = new Date(now).toISOString();
    } else entry.lastError = result.reason;
  }
}
