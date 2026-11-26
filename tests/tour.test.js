// The quick tour's place per account in this browser: a new account is
// marked at sign-up so its first Home opens the tour; finishing or skipping
// it marks it done for good.
import test from "node:test";
import assert from "node:assert/strict";

const store = new Map();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  },
});
const { markTourDone, markTourPending, tourDone, tourPending } =
  await import("../src/data/tour.js");

test("a new account's tour waits until it is finished or skipped", () => {
  assert.equal(tourPending("a1"), false);
  assert.equal(tourDone("a1"), false);
  markTourPending("a1");
  assert.equal(tourPending("a1"), true);
  assert.equal(tourDone("a1"), false);
  markTourDone("a1");
  assert.equal(tourDone("a1"), true);
  assert.equal(tourPending("a1"), false);
  // Signing up again in this browser never brings a finished tour back.
  markTourPending("a1");
  assert.equal(tourDone("a1"), true);
  // Each account keeps its own place, and no account id writes nothing.
  assert.equal(tourPending("a2"), false);
  markTourPending(undefined);
  assert.equal(store.has("synergy-tour:undefined"), false);
});

test("without storage the tour neither throws nor starts", async () => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new Error("blocked");
    },
  });
  assert.equal(tourPending("a3"), false);
  assert.equal(tourDone("a3"), false);
  assert.doesNotThrow(() => markTourPending("a3"));
  assert.doesNotThrow(() => markTourDone("a3"));
});
