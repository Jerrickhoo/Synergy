import { linkParts } from "../data/links.js";

// Text with its valid http(s) addresses rendered as safe external links.
export default function LinkedText({ text }) {
  return linkParts(text).map((part, index) =>
    part.type === "link" ? (
      <a key={index} href={part.href} target="_blank" rel="noopener noreferrer">
        {part.text}
      </a>
    ) : (
      part.text
    ),
  );
}
