export const pricingConfig = {
  currency: "PHP",
  platformFeeRate: 0.15,
  minPrice: 30000,
  maxPrice: 1000000,
  paymentWindowHours: 48,
  paymentReminderHours: 12,
  slotHoldMinutes: 15,
  cycleRemainderReleaseDays: 7,
  paymentDisputeBusinessDays: 5,
  paymentLapseLimit: 2,
  paymentLapseWindowDays: 90,
};

export const paymentActionNames = [
  "set-format-price",
  "start-payout-setup",
  "pay",
  "simulate-payment",
  "confirm-delivery",
  "open-payment-dispute",
  "resolve-payment-dispute",
  "pricing-config",
  "accept-paid-reschedule",
  "decline-paid-reschedule",
];

export function split(amount, rate = pricingConfig.platformFeeRate) {
  if (
    !Number.isSafeInteger(amount) ||
    amount < 0 ||
    !Number.isFinite(rate) ||
    rate < 0 ||
    rate > 1
  )
    throw new Error("Invalid payment amount or fee rate.");
  const fee = Math.round(amount * rate);
  return { amount, fee, payout: amount - fee };
}

export function validPrice(amount, config = pricingConfig) {
  return (
    Number.isSafeInteger(amount) &&
    (amount === 0 || (amount >= config.minPrice && amount <= config.maxPrice))
  );
}

export const priceLabel = (amount = 0) =>
  amount === 0
    ? "Free"
    : new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        maximumFractionDigits: 2,
      }).format(amount / 100);

export function installment(amount, count, index) {
  return Math.floor(amount / count) + (index < amount % count ? 1 : 0);
}
