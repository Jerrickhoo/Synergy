import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
  existsSync,
} from "node:fs";
import { resolve, dirname, join, sep } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { decode } from "../src/state/serialization.js";
const checksum = (bytes) => createHash("sha256").update(bytes).digest("hex");
export function backupWorkspace(file, targetRoot) {
  const source = resolve(file),
    parent = dirname(source),
    root = resolve(targetRoot);
  if (root === parent || root.startsWith(parent + sep))
    throw new Error(
      "Choose a backup directory outside the workspace data directory and uploads.",
    );
  const bytes = readFileSync(source);
  const snapshot = decode(bytes.toString("utf8"));
  if (snapshot.version !== 1 || !snapshot.accounts)
    throw new Error("Invalid workspace snapshot.");
  const target = join(
    root,
    `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}`,
  );
  mkdirSync(join(target, "uploads"), { recursive: true });
  const manifest = {
    revision: snapshot.revision,
    createdAt: new Date().toISOString(),
    files: { "synergy.json": checksum(bytes) },
  };
  writeFileSync(join(target, "synergy.json"), bytes, {
    flag: "wx",
    mode: 0o600,
  });
  // Files are immutable and the JSON file is atomically replaced. Copy exactly
  // the file IDs in that snapshot so concurrent uploads cannot tear the backup.
  for (const id of Object.keys(snapshot.files || {})) {
    if (!/^[0-9a-f-]{36}$/.test(id))
      throw new Error("Invalid upload ID in workspace snapshot.");
    const from = join(parent, "uploads", id),
      name = `uploads/${id}`;
    copyFileSync(from, join(target, "uploads", id));
    manifest.files[name] = checksum(readFileSync(join(target, "uploads", id)));
  }
  writeFileSync(
    join(target, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    { flag: "wx", mode: 0o600 },
  );
  verifyBackup(target);
  return target;
}
export function verifyBackup(directory) {
  const root = resolve(directory),
    manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
  for (const [name, expected] of Object.entries(manifest.files)) {
    const file = resolve(root, name);
    if (
      !file.startsWith(root + sep) ||
      checksum(readFileSync(file)) !== expected
    )
      throw new Error("Backup verification failed.");
  }
  if (!manifest.files["synergy.json"])
    throw new Error("Backup has no workspace snapshot.");
  return manifest;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  if (process.argv[2] === "--verify") {
    verifyBackup(process.argv[3]);
    console.log("Backup verified.");
  } else {
    const { configuration } = await import("./config.js");
    const file = configuration().file;
    if (!existsSync(file)) throw new Error("No workspace database exists yet.");
    console.log(
      `Verified backup saved: ${backupWorkspace(file, process.argv[2] || "artifacts/backups")}`,
    );
  }
}
