import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { loadEnvFile } from "node:process";
import { emailConfiguration } from "./email-config.js";

if (existsSync(".env")) loadEnvFile(".env");

export function configuration(env = process.env) {
  const production = env.NODE_ENV === "production";
  const file = resolve(env.SYNERGY_DATA_FILE || ".data/synergy.sqlite");
  const config = {
    production,
    file,
    backupDirectory: env.SYNERGY_BACKUP_DIR
      ? resolve(env.SYNERGY_BACKUP_DIR)
      : null,
    backupIntervalHours: Number(env.SYNERGY_BACKUP_INTERVAL_HOURS || 24),
    uploads: resolve(dirname(file), "uploads"),
    mailProvider: (env.EMAIL_PROVIDER || "").trim().toLowerCase(),
    brevoKey: (env.BREVO_API_KEY || "").trim(),
    resendKey: (env.RESEND_API_KEY || "").trim(),
    mailFrom: (env.MAIL_FROM || "").trim(),
    openaiKey: env.OPENAI_API_KEY || "",
    model: env.OPENAI_MODEL || "gpt-4.1-mini",
    adminEmails: (env.SYNERGY_ADMIN_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
    requireVerification:
      production || env.REQUIRE_EMAIL_VERIFICATION === "true",
    maxFileBytes: 5 * 1024 * 1024,
    accountFileBytes: 50 * 1024 * 1024,
  };
  if (
    !Number.isFinite(config.backupIntervalHours) ||
    config.backupIntervalHours < 1
  )
    throw new Error("SYNERGY_BACKUP_INTERVAL_HOURS must be at least 1.");
  if (config.mailProvider && !["brevo", "resend"].includes(config.mailProvider))
    throw new Error(
      "EMAIL_PROVIDER must be brevo or resend. See DEPLOYMENT.md.",
    );
  if (production && !emailConfiguration(config).enabled)
    throw new Error(
      "Public hosting requires BREVO_API_KEY or RESEND_API_KEY for the selected EMAIL_PROVIDER and a valid MAIL_FROM. See DEPLOYMENT.md.",
    );
  config.requireLoginCode = production || emailConfiguration(config).enabled;
  return config;
}
