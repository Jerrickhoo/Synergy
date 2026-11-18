import { useApp } from "../state/AppContext.jsx";
import { mentorFormat } from "../data/mentor-formats.js";
import { priceLabel } from "../data/pricing.js";
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
export function FormatPrices({ person }) {
  if (!person.formats?.length) return null;
  return (
    <ul>
      {person.formats.map(({ id, price }) => (
        <li key={id}>
          {mentorFormat(id)?.label} · {priceLabel(price)}
        </li>
      ))}
    </ul>
  );
}
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
      <p>
        {priceLabel(payment.amount)} · {payment.status}
      </p>
      {payment.status === "due" && (
        <p>Complete by {new Date(payment.dueBy).toLocaleString()}.</p>
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
          <>
            <p>Simulated payment. No money moves.</p>
            {["success", "failure", "expiry"].map((result) => (
              <Action
                key={result}
                action="simulate-payment"
                values={{ providerRef: payment.providerRef, result }}
              >
                Simulate {result}
              </Action>
            ))}
          </>
        ) : (
          <Action action="pay" values={{ providerRef: payment.providerRef }}>
            Pay now
          </Action>
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
                {item.to} · {item.reason}
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
      "Status " + payment.status,
    ].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    link.download = "synergy-receipt-" + payment.providerRef + ".txt";
    link.click();
    URL.revokeObjectURL(link.href);
  }
  return (
    <section className="card panel">
      <h2>{state.role === "mentor" ? "Payouts" : "Payments"}</h2>
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
          <p>
            Held{" "}
            {priceLabel(
              records
                .filter((p) => ["held", "disputed"].includes(p.status))
                .reduce(
                  (sum, p) => sum + p.amount - p.releaseAmount - p.refundAmount,
                  0,
                ),
            )}{" "}
            · Released{" "}
            {priceLabel(
              records.reduce(
                (sum, p) => sum + p.payout * (p.releaseAmount ? 1 : 0),
                0,
              ),
            )}
          </p>
          {state.profiles.mentor.formats.map((format) => (
            <form
              key={format.id}
              onSubmit={(event) => {
                event.preventDefault();
                onAction({
                  action: "set-format-price",
                  values: {
                    format: format.id,
                    price: Math.round(
                      Number(new FormData(event.currentTarget).get("price")) *
                        100,
                    ),
                  },
                });
              }}
            >
              <label>
                {mentorFormat(format.id)?.label} price in PHP
                <input
                  name="price"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={format.price / 100}
                  required
                />
              </label>
              <button className="btn">Save price</button>
            </form>
          ))}
        </>
      )}
      <ul>
        {records.map((p) => (
          <li key={p.providerRef}>
            {mentorFormat(p.format)?.label} · {priceLabel(p.amount)} ·{" "}
            {p.status}
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
            {new Date(p.dispute.dueAt).toLocaleString()}
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
          <select name="key">
            {Object.entries(state.pricingConfig || {})
              .filter(([key]) => key !== "currency")
              .map(([key, value]) => (
                <option key={key} value={key}>
                  {key} ({value})
                </option>
              ))}
          </select>
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
            {item.key} · {item.before} → {item.value} · {item.by} · {item.at}
          </li>
        ))}
      </ul>
    </section>
  );
}
