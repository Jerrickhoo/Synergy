import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { loadEnvFile } from "node:process";

if (existsSync(".env")) loadEnvFile(".env");

export function configuration(env = process.env) {
  const production = env.NODE_ENV === "production";
  const demoMode = env.SYNERGY_DEMO_MODE !== "false";
  const file = resolve(env.SYNERGY_DATA_FILE || ".data/synergy.sqlite");
  const config = {
    production,
    demoMode,
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
    maxFileBytes: 5 * 1024 * 1024,
    accountFileBytes: 50 * 1024 * 1024,
  };
  if (
    !Number.isFinite(config.backupIntervalHours) ||
    config.backupIntervalHours < 1
  )
    throw new Error("SYNERGY_BACKUP_INTERVAL_HOURS must be at least 1.");
  return config;
}
