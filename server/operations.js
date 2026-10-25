import {
  mkdirSync,
  openSync,
  closeSync,
  unlinkSync,
  statfsSync,
  existsSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { backupWorkspace } from "./backup.js";

export const logFailure = (event, error) =>
  console.error(
    JSON.stringify({
      event,
      at: new Date().toISOString(),
      kind: error?.name || "Error",
      code: error?.code || "unavailable",
    }),
  );

export function createOperations(config, checkStorage) {
  let lastCheck = null;
  let lastBackupAt = 0;
  let lastBackupAttempt = 0;
  let backupError = false;
  return {
    health() {
      if (lastCheck && Date.now() - lastCheck.at < 30000)
        return lastCheck.result;
      let probe;
      try {
        mkdirSync(dirname(config.file), { recursive: true });
        checkStorage();
        const stat = statfsSync(dirname(config.file));
        if (Number(stat.bavail) * Number(stat.bsize) < 20 * 1024 * 1024)
          throw new Error("Low storage capacity");
        probe = join(dirname(config.file), `.readiness-${randomUUID()}`);
        closeSync(openSync(probe, "wx", 0o600));
        unlinkSync(probe);
        probe = null;
        const result = {
          ok: true,
          storage: "ready",
          backups: {
            configured: Boolean(config.backupDirectory),
            lastSuccessAt: lastBackupAt
              ? new Date(lastBackupAt).toISOString()
              : null,
            error: backupError,
          },
        };
        lastCheck = { at: Date.now(), result };
        return result;
      } catch (error) {
        if (probe)
          try {
            unlinkSync(probe);
          } catch {
            /* Preserve the readiness failure. */
          }
        logFailure("storage_readiness_failed", error);
        return { ok: false, storage: "unavailable" };
      }
    },
    tick() {
      if (!config.backupDirectory || !existsSync(config.file)) return;
      const now = Date.now();
      if (
        now - lastBackupAt < config.backupIntervalHours * 3600000 ||
        now - lastBackupAttempt < 15 * 60000
      )
        return;
      lastBackupAttempt = now;
      try {
        backupWorkspace(config.file, config.backupDirectory);
        lastBackupAt = now;
        backupError = false;
      } catch (error) {
        backupError = true;
        logFailure("scheduled_backup_failed", error);
      }
      lastCheck = null;
    },
    invalidate() {
      lastCheck = null;
    },
  };
}
