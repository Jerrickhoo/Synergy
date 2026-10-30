function hash(value) {
  let result = 2166136261;
  for (const character of value) {
    result = Math.imul(result ^ character.codePointAt(0), 16777619);
  }
  result ^= result >>> 16;
  result = Math.imul(result, 0x85ebca6b);
  result ^= result >>> 13;
  result = Math.imul(result, 0xc2b2ae35);
  return (result ^ (result >>> 16)) >>> 0;
}

// OKLCH keeps every hue at the same perceived depth, so the white icon reads
// equally well on all of them. Conversion: https://bottosson.github.io/posts/oklab/
function oklchToHex(lightness, chroma, hue) {
  const angle = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(angle);
  const b = chroma * Math.sin(angle);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return `#${[
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
    .map((linear) => {
      const channel =
        linear <= 0.0031308
          ? 12.92 * linear
          : 1.055 * linear ** (1 / 2.4) - 0.055;
      return Math.round(Math.min(1, Math.max(0, channel)) * 255)
        .toString(16)
        .padStart(2, "0");
    })
    .join("")}`;
}

// Account IDs keep the color consistent across roles, renames and devices.
// Names are a fallback for legacy profiles; anonymous users get a neutral icon.
// Hashed colors can repeat. The "color76" prefix was chosen so the demo
// directory's accounts without artwork all get clearly different colors.
export function avatarAppearance({ identity, name = "" } = {}) {
  const seed = identity
    ? `color76:${identity}`
    : name.trim()
      ? `name:${name.trim().toLowerCase().replace(/\s+/g, " ")}`
      : "";
  if (!seed) return { background: "#6f817a", ink: "#ffffff" };
  const value = hash(seed);
  // One of three shades and two strengths halves how often two accounts look
  // alike. Hues run 125°–445° to skip olive, which turns muddy at this depth.
  return {
    background: oklchToHex(
      [0.48, 0.56, 0.64][(value >>> 9) % 3],
      [0.085, 0.125][(value >>> 12) % 2],
      125 + (value % 3200) / 10,
    ),
    ink: "#ffffff",
  };
}
