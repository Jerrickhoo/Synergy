// Draws the workspace backdrop: a low-poly tile that wraps on all four
// sides, so it repeats down a page of any length without a seam. The light
// from the top-left is not drawn here; it is a soft tint over the top of
// each page (--canvas-light in theme.css).
// Run with `node scripts/generate-backdrop.js` after changing a tone below;
// the same seed draws the same triangles.
//
// Text sits straight on this backdrop (page titles, intros), so the darkest
// facet is checked against the muted text colour before anything is
// written.
import { writeFileSync } from "node:fs";

const size = 1200; // the tile is square
const cells = 11; // cells per side; each splits into two triangles

const themes = {
  light: {
    file: "src/assets/workspace-backdrop.svg",
    hue: 140,
    saturation: 16,
    lightness: 91.5, // the average facet, close to --canvas
    swell: 2.4, // broad lighter and darker regions, in lightness points
    jitter: 1.8, // per-triangle variation, in lightness points
    text: "#4f6056", // --muted
  },
  dark: {
    file: "src/assets/workspace-backdrop-dark.svg",
    hue: 174,
    saturation: 18,
    lightness: 8.5,
    swell: 1.6,
    jitter: 1.2,
    text: "#a1b3af",
  },
};

function random(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return `#${[f(0), f(8), f(4)]
    .map((v) =>
      Math.round(v * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
function luminance(hex) {
  const [r, g, b] = rgb(hex).map((value) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// A jittered grid that wraps: the last row and column repeat the first,
// shifted by one tile, so neighbouring tiles share their edge points.
function points(next) {
  const step = size / cells;
  const base = Array.from({ length: cells }, () =>
    Array.from({ length: cells }, () => [
      (next() - 0.5) * step * 0.8,
      (next() - 0.5) * step * 0.8,
    ]),
  );
  return Array.from({ length: cells + 1 }, (_, r) =>
    Array.from({ length: cells + 1 }, (_, c) => {
      const [dx, dy] = base[r % cells][c % cells];
      return [c * step + dx, r * step + dy];
    }),
  );
}

function draw(theme) {
  const next = random(20261128);
  const grid = points(next);
  const triangles = [];
  for (let r = 0; r < cells; r++)
    for (let c = 0; c < cells; c++) {
      const a = grid[r][c];
      const b = grid[r][c + 1];
      const d = grid[r + 1][c];
      const e = grid[r + 1][c + 1];
      if (next() < 0.5) triangles.push([a, b, e], [a, e, d]);
      else triangles.push([a, b, d], [b, e, d]);
    }
  let darkest = null;
  const shapes = [];
  for (const tri of triangles) {
    const u = (tri[0][0] + tri[1][0] + tri[2][0]) / 3 / size;
    const v = (tri[0][1] + tri[1][1] + tri[2][1]) / 3 / size;
    // Broad regions that repeat once per tile, so they wrap too.
    const swell =
      Math.sin(2 * Math.PI * (u + 0.15)) * Math.cos(2 * Math.PI * (v - 0.3));
    const fill = hslToHex(
      theme.hue,
      theme.saturation,
      theme.lightness + swell * theme.swell + (next() - 0.5) * 2 * theme.jitter,
    );
    if (!darkest || contrast(theme.text, fill) < contrast(theme.text, darkest))
      darkest = fill;
    // A triangle that crosses the tile's edge is drawn again on the far
    // side, so the halves meet when the tile repeats.
    const xs = tri.map(([x]) => x);
    const ys = tri.map(([, y]) => y);
    for (const ox of [-size, 0, size])
      for (const oy of [-size, 0, size]) {
        if (
          Math.max(...xs) + ox < 0 ||
          Math.min(...xs) + ox > size ||
          Math.max(...ys) + oy < 0 ||
          Math.min(...ys) + oy > size
        )
          continue;
        const d = tri
          .map(([x, y]) => `${(x + ox).toFixed(1)} ${(y + oy).toFixed(1)}`)
          .join(" ");
        // A hairline stroke in the fill colour hides anti-aliasing seams.
        shapes.push(`<path d="M${d}Z" fill="${fill}" stroke="${fill}"/>`);
      }
  }
  const worst = contrast(theme.text, darkest);
  if (worst < 4.6)
    throw new Error(`${theme.file}: muted text is ${worst.toFixed(2)}:1`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">${shapes.join("")}</svg>\n`;
  writeFileSync(theme.file, svg);
  console.log(
    `${theme.file}: ${shapes.length} paths, muted text ${worst.toFixed(2)}:1 at worst`,
  );
}

for (const theme of Object.values(themes)) draw(theme);
