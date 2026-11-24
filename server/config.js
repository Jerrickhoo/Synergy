import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { loadEnvFile } from "node:process";

if (existsSync(".env")) loadEnvFile(".env");

export function configuration(env = process.env) {
  const production = env.NODE_ENV === "production";
  // Unset means demo. Anything other than true/false is a typo, not a default.
  const demoSetting = (env.SYNERGY_DEMO_MODE || "true").trim().toLowerCase();
  if (!["true", "false"].includes(demoSetting))
    throw new Error("SYNERGY_DEMO_MODE must be true or false.");
  const demoMode = demoSetting === "true";
  const file = resolve(env.SYNERGY_DATA_FILE || ".data/synergy.sqlite");
  if (env.PAYMENTS_PROVIDER && env.PAYMENTS_PROVIDER !== "simulated")
    throw new Error(
      "Live payments require the P2 provider integration and release checks.",
    );
  const config = {
    production,
    demoMode,
    paymentsProvider: env.PAYMENTS_PROVIDER || "simulated",
    paymentsWebhookSecret: env.PAYMENTS_WEBHOOK_SECRET || "",
    emailProvider: env.EMAIL_PROVIDER || "stub",
    brevoApiKey: env.BREVO_API_KEY || "",
    emailFrom: env.EMAIL_FROM || "",
    brevoWebhookSecret: env.BREVO_WEBHOOK_SECRET || "",
    publicUrl: env.SYNERGY_PUBLIC_URL || "",
    requireVerification: env.SYNERGY_REQUIRE_VERIFICATION === "true",
    file,
    backupDirectory: env.SYNERGY_BACKUP_DIR
      ? resolve(env.SYNERGY_BACKUP_DIR)
      : null,
    backupIntervalHours: Number(env.SYNERGY_BACKUP_INTERVAL_HOURS || 24),
    uploads: resolve(dirname(file), "uploads"),
    adminEmails: (env.SYNERGY_ADMIN_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
    // Extra browser origins allowed to POST, e.g. a static frontend that proxies /api.
    allowedOrigins: (env.SYNERGY_ALLOWED_ORIGINS || "")
      .split(",")
      .map((origin) => origin.trim().replace(/\/$/, ""))
      .filter(Boolean),
    maxFileBytes: 5 * 1024 * 1024,
    accountFileBytes: 50 * 1024 * 1024,
  };
  if (
    !Number.isFinite(config.backupIntervalHours) ||
    config.backupIntervalHours < 1
  )
    throw new Error("SYNERGY_BACKUP_INTERVAL_HOURS must be at least 1.");
  if (!["stub", "brevo"].includes(config.emailProvider))
    throw new Error("EMAIL_PROVIDER must be stub or brevo.");
  if (config.emailProvider === "brevo") {
    // Demo mode never sends email; fail instead of silently using the stub.
    if (demoMode)
      throw new Error(
        "EMAIL_PROVIDER=brevo requires SYNERGY_DEMO_MODE=false. Demo mode never sends email.",
      );
    if (
      !config.brevoApiKey ||
      !config.emailFrom ||
      config.brevoWebhookSecret.length < 32
    )
      throw new Error(
        "Brevo requires BREVO_API_KEY, EMAIL_FROM and a BREVO_WEBHOOK_SECRET of at least 32 characters.",
      );
    let origin;
    try {
      origin = new URL(config.publicUrl);
    } catch {
      throw new Error("Set SYNERGY_PUBLIC_URL to your HTTPS frontend.");
    }
    if (
      origin.protocol !== "https:" ||
      origin.username ||
      origin.password ||
      origin.search ||
      origin.hash
    )
      throw new Error("Set SYNERGY_PUBLIC_URL to your HTTPS frontend.");
  }
  return config;
}
