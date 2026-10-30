import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";

const root = process.cwd();
const optionalRoots = [
  "output",
  "artifacts",
  ".playwright-cli",
  "test-results",
];
const documents = [resolve(root, "README.md")];
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await collect(path);
    else if (/\.(md|html)$/.test(entry.name)) documents.push(path);
  }
}
await collect(resolve(root, "docs"));
await collect(resolve(root, "public"));

let checked = 0;
let localEvidence = 0;
const missing = [];
for (const file of documents) {
  const source = (await readFile(file, "utf8")).replace(
    /^```[^\n]*\n[\s\S]*?^```[^\n]*$/gm,
    "",
  );
  const targets = [
    ...source.matchAll(/\]\(([^\s)]+)\)/g),
    ...source.matchAll(/(?:src|href)=["']([^"']+)["']/g),
  ];
  for (const match of targets) {
    const target = match[1];
    if (/^(?:[a-z][\w+.-]*:|#|\/)/i.test(target)) continue;
    const path = resolve(
      dirname(file),
      decodeURIComponent(target.split(/[?#]/)[0]),
    );
    const local = relative(root, path);
    if (optionalRoots.some((folder) => local.startsWith(folder + sep))) {
      // Review captures intentionally remain ignored and are not checkout dependencies.
      localEvidence++;
      continue;
    }
    try {
      await stat(path);
      checked++;
    } catch {
      missing.push(`${relative(root, file)}: ${target}`);
    }
  }
}
if (missing.length) {
  console.error(`Missing documentation references:\n${missing.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log(
    `Verified ${checked} local references in ${documents.length} documents; ${localEvidence} links point to optional ignored review evidence.`,
  );
}
