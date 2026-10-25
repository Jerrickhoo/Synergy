import { DatabaseSync } from "node:sqlite";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  unlinkSync,
  existsSync,
  chmodSync,
} from "node:fs";
import { dirname, join, basename } from "node:path";
import { randomUUID } from "node:crypto";
import { encode, decode } from "../src/state/serialization.js";
const empty = () => ({ version: 1, revision: 0, accounts: {}, reports: [] });
const sqliteFile = (file) => /\.(sqlite|db)$/i.test(file);

function readSqlite(database) {
  const rows = database.prepare("SELECT kind, id, value FROM records").all();
  const snapshot = empty();
  for (const row of rows) {
    if (row.kind === "account") snapshot.accounts[row.id] = decode(row.value);
    else snapshot[row.id] = decode(row.value);
  }
  return snapshot;
}
export function readWorkspaceSnapshot(file) {
  if (!sqliteFile(file)) return decode(readFileSync(file, "utf8"));
  const database = new DatabaseSync(file, { readOnly: true });
  try {
    database.exec("BEGIN");
    const snapshot = readSqlite(database);
    database.exec("COMMIT");
    return snapshot;
  } finally {
    database.close();
  }
}

export function createStorage(file) {
  if (!sqliteFile(file))
    return {
      load: () => (existsSync(file) ? readWorkspaceSnapshot(file) : empty()),
      commit(snapshot) {
        const temporary = `${file}.${randomUUID()}.tmp`;
        try {
          mkdirSync(dirname(file), { recursive: true });
          writeFileSync(temporary, encode(snapshot), { mode: 0o600 });
          for (let attempt = 0; ; attempt++) {
            try {
              renameSync(temporary, file);
              break;
            } catch (error) {
              if (
                !["EPERM", "EBUSY", "EACCES"].includes(error.code) ||
                attempt >= 10
              )
                throw error;
              Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
            }
          }
        } catch (error) {
          try {
            unlinkSync(temporary);
          } catch {
            /* Preserve the original error. */
          }
          throw error;
        }
      },
      health() {
        if (existsSync(file)) readWorkspaceSnapshot(file);
      },
      close() {},
    };
  mkdirSync(dirname(file), { recursive: true });
  const database = new DatabaseSync(file);
  database.exec(
    "PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=1000; CREATE TABLE IF NOT EXISTS records (kind TEXT NOT NULL, id TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(kind, id));",
  );
  chmodSync(file, 0o600);
  let cached = new Map(
    database
      .prepare("SELECT kind, id, value FROM records")
      .all()
      .map((row) => [`${row.kind}:${row.id}`, row.value]),
  );
  const upsert = database.prepare(
    "INSERT INTO records(kind,id,value) VALUES (?,?,?) ON CONFLICT(kind,id) DO UPDATE SET value=excluded.value",
  );
  const remove = database.prepare("DELETE FROM records WHERE kind=? AND id=?");
  const revision = database.prepare(
    "SELECT value FROM records WHERE kind='meta' AND id='revision'",
  );
  const storage = {
    load: () => readSqlite(database),
    commit(snapshot, expectedRevision = 0) {
      const next = new Map();
      for (const [id, value] of Object.entries(snapshot)) {
        if (id === "accounts")
          for (const [accountId, account] of Object.entries(value))
            next.set(`account:${accountId}`, encode(account));
        else next.set(`meta:${id}`, encode(value));
      }
      database.exec("BEGIN IMMEDIATE");
      try {
        if (Number(revision.get()?.value || 0) !== expectedRevision)
          throw new Error(
            "Another server changed this database. Run one Synergy server per database and restart to reload it.",
          );
        for (const [key, value] of next)
          if (cached.get(key) !== value) {
            const split = key.indexOf(":");
            upsert.run(key.slice(0, split), key.slice(split + 1), value);
          }
        for (const key of cached.keys())
          if (!next.has(key)) {
            const split = key.indexOf(":");
            remove.run(key.slice(0, split), key.slice(split + 1));
          }
        database.exec("COMMIT");
        cached = next;
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },
    health() {
      if (database.prepare("PRAGMA quick_check").get().quick_check !== "ok")
        throw new Error("Storage integrity check failed");
    },
    close: () => database.close(),
  };
  // Import the previous default once, leaving its original JSON file intact.
  const legacy = join(dirname(file), "synergy.json");
  if (
    cached.size === 0 &&
    basename(file) === "synergy.sqlite" &&
    existsSync(legacy)
  ) {
    try {
      const snapshot = readWorkspaceSnapshot(legacy);
      if (snapshot.version !== 1 || !snapshot.accounts)
        throw new Error("Invalid legacy workspace. Migration stopped.");
      storage.commit(snapshot, 0);
    } catch (error) {
      storage.close();
      throw error;
    }
  }
  return storage;
}
