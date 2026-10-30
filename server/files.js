import { WorkspaceError } from "./workspace.js";
import sharp from "sharp";

export async function inspectAvatar(value) {
  const match =
    /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
      value || "",
    );
  if (!match)
    throw new WorkspaceError("Choose a JPEG, PNG or WebP profile photo.");
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > 5 * 1024 * 1024)
    throw new WorkspaceError(
      "Choose a nonempty profile photo up to 5 MB.",
      413,
    );
  try {
    const picture = sharp(bytes, {
      failOn: "warning",
      limitInputPixels: 40000000,
    });
    const metadata = await picture.metadata();
    const expected = {
      "image/jpeg": "jpeg",
      "image/png": "png",
      "image/webp": "webp",
    }[match[1]];
    if (metadata.format !== expected || metadata.pages > 1) throw new Error();
    // Decode the complete image, discard metadata, and bound stored dimensions.
    return await picture
      .rotate()
      .resize({
        width: 768,
        height: 768,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 90 })
      .toBuffer();
  } catch {
    throw new WorkspaceError(
      "This photo could not be decoded. Choose a valid, still JPEG, PNG or WebP image under 40 megapixels.",
    );
  }
}

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
