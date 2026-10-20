// Shared by startup validation, the API and account capability reporting.
// Only the enabled flag is sent to the browser; credentials stay on the server.
export function emailConfiguration(config) {
  const provider =
    config.mailProvider || (config.brevoKey ? "brevo" : "resend");
  const key =
    provider === "brevo"
      ? config.brevoKey
      : provider === "resend"
        ? config.resendKey
        : "";
  const from = (config.mailFrom || "").trim();
  const match = /^(?:([^<>]+)\s*<([^<>]+)>|([^<>]+))$/.exec(from);
  const email = (match?.[2] || match?.[3] || "").trim();
  const name = match?.[1]?.trim().replace(/^"(.*)"$/, "$1");
  const validSender =
    !/[\r\n]/.test(from) &&
    /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(email);
  return {
    provider,
    key,
    sender: { email, ...(name ? { name } : {}) },
    enabled: Boolean(key && validSender),
  };
}
