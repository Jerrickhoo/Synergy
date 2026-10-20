import { WorkspaceError } from "./workspace.js";

export async function readBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > limit) {
      req.resume();
      throw new WorkspaceError("This file or submission is too large.", 413);
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function inspectFile(name, bytes) {
  if (!bytes.length) throw new WorkspaceError("Choose a nonempty file.");
  if (
    typeof name !== "string" ||
    !name.trim() ||
    name.length > 180 ||
    /[\x00-\x1f\\/]/.test(name)
  )
    throw new WorkspaceError("Use a simple file name without folders.");
  const extension = name.split(".").pop().toLowerCase();
  const starts = (value) =>
    bytes.subarray(0, value.length).equals(Buffer.from(value));
  const types = {
    pdf: ["application/pdf", starts("%PDF-")],
    png: ["image/png", starts([137, 80, 78, 71, 13, 10, 26, 10])],
    jpg: ["image/jpeg", starts([255, 216, 255])],
    jpeg: ["image/jpeg", starts([255, 216, 255])],
    webp: [
      "image/webp",
      starts("RIFF") && bytes.subarray(8, 12).toString() === "WEBP",
    ],
    txt: [
      "text/plain",
      !bytes.includes(0) && !bytes.toString("utf8").includes("\ufffd"),
    ],
  };
  const type = types[extension];
  if (!type?.[1])
    throw new WorkspaceError(
      "Upload a valid PDF, PNG, JPEG, WebP or UTF-8 text file.",
    );
  return { name: name.trim(), type: type[0], size: bytes.length };
}
