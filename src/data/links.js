// Shared text is shown as text; only well-formed http and https addresses
// become links (Nov 22, round 2). Anything else, including javascript: and
// data: addresses, stays plain text.

// The normalized address when `value` is a valid http(s) URL, else "".
export function httpUrl(value) {
  const text = String(value ?? "").trim();
  if (!/^https?:\/\//i.test(text)) return "";
  try {
    const url = new URL(text);
    return ["http:", "https:"].includes(url.protocol) && url.hostname
      ? url.href
      : "";
  } catch {
    return "";
  }
}

// Splits text into plain and link parts, keeping whitespace and line breaks.
// Trailing punctuation after an address stays outside the link.
export function linkParts(text) {
  const parts = [];
  for (const piece of String(text ?? "").split(/(\s+)/)) {
    if (!piece) continue;
    const [, address = "", tail = ""] =
      piece.match(/^(.*?)([).,;:!?'"]*)$/s) || [];
    const href = httpUrl(address);
    if (href) {
      parts.push({ type: "link", text: address, href });
      if (tail) parts.push({ type: "text", text: tail });
    } else parts.push({ type: "text", text: piece });
  }
  return parts;
}
