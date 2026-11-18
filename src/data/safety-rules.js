const equity =
  /\b\d+(?:\.\d+)?\s*%\s+of\s+your\s+(?:company|startup|business|equity)\b|\b(?:give|want|need|require|ask(?:ing)? for|take|accept|exchange for)\b[^.!?\n]{0,36}\b(?:equity|shares|options|vesting)\b|\b(?:equity|shares|options)\s+(?:for|in exchange for)\s+(?:my|this|mentoring|advice|guidance|a session)\b|^\s*(?:equity|advisory shares|vesting)\s*$/i;
const payment =
  /\b(?:pay|reimburse|compensate) me\b|\b(?:pay|send|transfer|deposit|settle)\b[^.!?\n]{0,40}\b(?:gcash|maya|paypal|venmo|bank account|wallet|fee|payment|money)\b|(?:paypal\.me\/|buymeacoffee\.com\/|checkout\.stripe\.com\/|pay\.paymongo\.com\/)/i;
const offPlatform =
  /\b(?:let['’]s|we can)\s+settle\s+(?:this|it)\s+(?:outside|off(?:line| platform))\b|\b(?:viber|whatsapp|telegram)\b[^.!?\n]{0,36}\b(?:to pay|payment|to settle|the fee)\b/i;

export const mentorshipSafetyWarning =
  "Payments for mentorship must go through Synergy so both sides are protected. Equity requests are prohibited.";

export function flagMessage(value) {
  const text = typeof value === "string" ? value.normalize("NFKC") : "";
  return [
    ...(equity.test(text) ? ["equity"] : []),
    ...(payment.test(text) ? ["payment"] : []),
    ...(offPlatform.test(text) ? ["off-platform-payment"] : []),
  ];
}
