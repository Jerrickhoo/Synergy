import { useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import { formatDateTime } from "../data/dates.js";
import { mentorFormat } from "../data/mentor-formats.js";
import {
  moneyLabel,
  priceLabel,
  priceRangeText,
  pricingConfig,
} from "../data/pricing.js";
import { formatUnavailableText } from "../data/mentor-rules.js";
import PrototypeShortcut from "./PrototypeShortcut.jsx";
import SelectField from "./SelectField.jsx";
function Action({ action, values, children }) {
  const { onAction, state } = useApp();
  return (
    <button
      className="btn"
      disabled={state.busy}
      onClick={() => onAction({ action, values })}
    >
      {children}
    </button>
  );
}
const accountWide = [
  "paused",
  "guidelines",
  "approval-required",
  "suspended",
  "no-show-limit",
  "inbox-full",
];
// A mentor's formats as a founder can use them now. Cards list only the
// open formats; the match details also list closed ones with the reason.
export function FormatPrices({ person, showUnavailable = false }) {
  if (!person.formats?.length) return null;
  const open = (id) =>
    !person.availableFormats || person.availableFormats.includes(id);
  const listed = person.formats.filter(({ id }) => showUnavailable || open(id));
  if (!listed.length) return null;
  return (
    <ul className="format-prices">
      {listed.map(({ id, price }) => (
        <li key={id} className={open(id) ? undefined : "format-closed"}>
          {mentorFormat(id)?.label} ·{" "}
          {open(id)
            ? priceLabel(price)
            : `Unavailable: ${formatUnavailableText(
                accountWide.includes(person.reason)
                  ? person.reason
                  : person.formatReasons?.[id] || person.reason,
                {
                  name: person.name,
                  month: person.formatReasonMonths?.[id] || person.reasonMonth,
                },
              )}`}
        </li>
      ))}
    </ul>
  );
}
// Payment states in plain words, never the raw status code.
export const paymentStatusText = {
  due: "Payment due",
  held: "Paid · held by the provider",
  released: "Released to the mentor",
  refunded: "Refunded",
  "partially-refunded": "Partly refunded",
  disputed: "In dispute",
  lapsed: "Checkout expired",
};
const statusText = (status) => paymentStatusText[status] || status;

export function CheckoutPanel({ room }) {
  const { state, onAction } = useApp();
  const payment = state.paymentCheckoutData || room?.payment;
  if (!payment) return null;
  const founder =
    state.accountId === payment.founderId && state.role === "founder";
  const checkout =
    state.paymentCheckoutData?.providerRef === payment.providerRef;
  return (
    <section className="card panel">
      <h2>Mentorship payment</h2>
      <p className="payment-amount">
        {priceLabel(payment.amount)} · {statusText(payment.status)}
      </p>
      {payment.status === "due" && (
        <p>Complete by {formatDateTime(payment.dueBy)}.</p>
      )}
      {payment.status === "due" && !founder && <p>Waiting for payment</p>}
      {founder && payment.reschedulePending && (
        <>
          <p>
            Your mentor proposed {payment.reschedulePending.values.date} at{" "}
            {payment.reschedulePending.values.time}. Accept the change or
            receive a refund.
          </p>
          <Action
            action="accept-paid-reschedule"
            values={{ providerRef: payment.providerRef }}
          >
            Accept new time
          </Action>
          <Action
            action="decline-paid-reschedule"
            values={{ providerRef: payment.providerRef }}
          >
            Decline and refund
          </Action>
        </>
      )}
      {founder &&
        payment.status === "due" &&
        (checkout ? (
          <PrototypeShortcut note="Simulated payment. No money moves. Choose how checkout ends.">
            <div className="mentor-request-controls">
              {["success", "failure", "expiry"].map((result) => (
                <Action
                  key={result}
                  action="simulate-payment"
                  values={{ providerRef: payment.providerRef, result }}
                >
                  Simulate {result}
                </Action>
              ))}
            </div>
          </PrototypeShortcut>
        ) : (
          // In a room, the next-step line carries Pay now / Retry payment.
          !room && (
            <Action action="pay" values={{ providerRef: payment.providerRef }}>
              {payment.failedAt ? "Retry payment" : "Pay now"}
            </Action>
          )
        ))}
      {founder && payment.status === "held" && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onAction({
              action: "open-payment-dispute",
              values: {
                providerRef: payment.providerRef,
                reason: new FormData(event.currentTarget).get("reason"),
              },
            });
          }}
        >
          <label>
            Payment dispute reason
            <textarea name="reason" required maxLength={1000} />
          </label>
          <button className="btn">Open payment dispute</button>
        </form>
      )}
      {payment.history?.length > 0 && (
        <details>
          <summary>Payment history</summary>
          <ul>
            {payment.history.map((item, index) => (
              <li key={index}>
                {statusText(item.to)} · {item.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
export function PaymentSettings() {
  const { state, onAction } = useApp();
  // Price errors belong to the format form that was just saved.
  const [pricing, setPricing] = useState("");
  const limits = state.pricingConfig || pricingConfig;
  const priceError =
    state.formErrors?.scope === "set-format-price" &&
    state.formErrors.fields?.price;
  const records = state.paymentRecords || [];
  const ready = state.profiles.mentor.payoutSetup?.status === "ready";
  function receipt(payment) {
    const mentor = payment.mentorName;
    const text = [
      "Synergy simulated payment receipt",
      payment.providerRef,
      mentor,
      priceLabel(payment.amount),
      "Platform fee " + priceLabel(payment.fee),
      "Status " + statusText(payment.status),
    ].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    link.download = "synergy-receipt-" + payment.providerRef + ".txt";
    link.click();
    URL.revokeObjectURL(link.href);
  }
  // A founder with no payments yet would see only the heading.
  if (state.role !== "mentor" && !records.length) return null;
  return (
    <section
      className="card panel settings-section section-gap"
      id="settings-payouts"
    >
      <h2 tabIndex={-1}>{state.role === "mentor" ? "Payouts" : "Payments"}</h2>
      {state.role === "mentor" && (
        <>
          <p>
            Payout setup {ready ? "complete" : "required"} · Simulated provider
          </p>
          {!ready && (
            <Action action="start-payout-setup">
              Complete simulated payout setup
            </Action>
          )}
          <p className="payment-amount">
            Held{" "}
            {moneyLabel(
              records
                .filter((p) => ["held", "disputed"].includes(p.status))
                .reduce(
                  (sum, p) => sum + p.amount - p.releaseAmount - p.refundAmount,
                  0,
                ),
            )}{" "}
            · Released{" "}
            {moneyLabel(
              records.reduce(
                (sum, p) => sum + p.payout * (p.releaseAmount ? 1 : 0),
                0,
              ),
            )}
          </p>
          {/* Prices can't be charged before payout setup, so until then
              the setup step stands alone instead of five idle price forms. */}
          {!ready && (
            <p className="field-help">
              Every format stays free until payout setup is complete. You can
              set prices after that.
            </p>
          )}
          {ready && (
            <div className="payment-price-list">
              {state.profiles.mentor.formats.map((format) => (
                <form
                  key={format.id}
                  className="payment-price-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setPricing(format.id);
                    onAction({
                      action: "set-format-price",
                      values: {
                        format: format.id,
                        price: Math.round(
                          Number(
                            new FormData(event.currentTarget).get("price"),
                          ) * 100,
                        ),
                      },
                    });
                  }}
                >
                  <label htmlFor={`price-${format.id}`}>
                    {mentorFormat(format.id)?.label} price in PHP
                  </label>
                  <input
                    id={`price-${format.id}`}
                    name="price"
                    type="number"
                    min="0"
                    max={limits.maxPrice / 100}
                    step="0.01"
                    defaultValue={format.price / 100}
                    aria-describedby={`price-help-${format.id}${pricing === format.id && priceError ? ` price-error-${format.id}` : ""}`}
                    aria-invalid={
                      pricing === format.id && priceError ? true : undefined
                    }
                    required
                  />
                  <p className="field-help" id={`price-help-${format.id}`}>
                    0 for Free, or {priceRangeText(limits)}.
                  </p>
                  {pricing === format.id && priceError && (
                    <p
                      className="field-error"
                      id={`price-error-${format.id}`}
                      role="alert"
                    >
                      {priceError}
                    </p>
                  )}
                  <button className="btn" disabled={state.busy}>
                    Save price
                  </button>
                </form>
              ))}
            </div>
          )}
        </>
      )}
      <ul>
        {records.map((p) => (
          <li key={p.providerRef}>
            {mentorFormat(p.format)?.label} · {priceLabel(p.amount)} ·{" "}
            {statusText(p.status)}
            {state.role === "founder" && (
              <>
                <Action action="pay" values={{ providerRef: p.providerRef }}>
                  Open payment
                </Action>
                {p.paidAt && (
                  <button className="btn" onClick={() => receipt(p)}>
                    Download receipt
                  </button>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
export function PaymentModeration() {
  const { state, onAction } = useApp();
  return (
    <section className="card panel">
      <h2>Payment disputes</h2>
      {(state.paymentModeration || []).map((p) => (
        <form
          key={p.providerRef}
          onSubmit={(event) => {
            event.preventDefault();
            const values = Object.fromEntries(
              new FormData(event.currentTarget),
            );
            onAction({
              action: "resolve-payment-dispute",
              values: { ...values, providerRef: p.providerRef },
            });
          }}
        >
          <p>
            {priceLabel(p.amount)} · {p.dispute.reason} · Due{" "}
            {formatDateTime(p.dispute.dueAt)}
          </p>
          <label>
            Release in centavos
            <input
              name="release"
              type="number"
              min={p.releaseAmount}
              max={p.amount}
              required
            />
          </label>
          <label>
            Refund in centavos
            <input
              name="refund"
              type="number"
              min={p.refundAmount}
              max={p.amount}
              required
            />
          </label>
          <button className="btn">Resolve payment dispute</button>
        </form>
      ))}
      <h2>Pricing settings</h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onAction({
            action: "pricing-config",
            values: Object.fromEntries(new FormData(event.currentTarget)),
          });
        }}
      >
        <label>
          Pricing option
          <SelectField name="key">
            {Object.entries(state.pricingConfig || {})
              .filter(([key]) => key !== "currency")
              .map(([key, value]) => (
                <option key={key} value={key}>
                  {key} ({value})
                </option>
              ))}
          </SelectField>
        </label>
        <label>
          Updated pricing amount
          <input name="value" type="number" step="any" required />
        </label>
        <button className="btn">Save pricing setting</button>
      </form>
      <ul>
        {(state.pricingHistory || []).slice(-10).map((item, index) => (
          <li key={index}>
            {item.key}: {item.before} to {item.value} · {item.by} · {item.at}
          </li>
        ))}
      </ul>
    </section>
  );
}
