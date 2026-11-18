import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { split } from "../src/data/pricing.js";

export function createPayments(getDb, secret) {
  const records = () => (getDb().providerPayments ||= {});
  return {
    createCheckout(payment) {
      return (records()[payment.providerRef] ||= {
        id: payment.providerRef,
        checkoutRef: randomUUID(),
        status: "pending",
        amount: payment.amount,
        released: 0,
        refunded: 0,
      });
    },
    getCheckout(ref) {
      return records()[ref];
    },
    release(ref, amount) {
      const record = records()[ref];
      if (
        !record ||
        record.status !== "paid" ||
        !Number.isSafeInteger(amount) ||
        amount < record.released ||
        amount + record.refunded > record.amount
      )
        throw new Error("Invalid payout.");
      record.released = amount;
      return { ...split(amount), providerRef: ref };
    },
    refund(ref, amount) {
      const record = records()[ref];
      if (
        !record ||
        record.status !== "paid" ||
        !Number.isSafeInteger(amount) ||
        amount < record.refunded ||
        amount + record.released > record.amount
      )
        throw new Error("Invalid refund.");
      record.refunded = amount;
      return { amount, providerRef: ref };
    },
    startPayoutSetup() {
      return {
        status: "ready",
        provider: "simulated",
        accountRef: randomUUID(),
      };
    },
    payoutStatus(setup) {
      return setup?.status || "unstarted";
    },
    verifyWebhook(body, signature) {
      if (
        !secret ||
        typeof signature !== "string" ||
        !/^[a-f0-9]{64}$/i.test(signature)
      )
        return false;
      const expected = createHmac("sha256", secret).update(body).digest("hex");
      return (
        signature.length === expected.length &&
        timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
      );
    },
  };
}
