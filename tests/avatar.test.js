import test from "node:test";
import assert from "node:assert/strict";
import { avatarAppearance } from "../src/data/avatar.js";

const channels = (hex) =>
  [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
function luminance(hex) {
  const [r, g, b] = channels(hex).map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function hue(hex) {
  const [r, g, b] = channels(hex);
  const max = Math.max(r, g, b);
  const range = max - Math.min(r, g, b);
  const sector =
    max === r
      ? (g - b) / range + 6
      : max === g
        ? (b - r) / range + 2
        : (r - g) / range + 4;
  return (sector * 60) % 360;
}

test("account avatars survive renames and distinguish accounts with the same name", () => {
  const original = avatarAppearance({
    identity: "account-1",
    name: "Alex Lee",
  });
  assert.deepEqual(
    avatarAppearance({ identity: "account-1", name: "Alex Smith" }),
    original,
  );
  const namesakes = Array.from({ length: 20 }, (_, index) =>
    avatarAppearance({ identity: `account-${index}`, name: "Alex Lee" }),
  );
  assert.ok(new Set(namesakes.map((avatar) => avatar.background)).size > 15);
});

test("legacy names have consistent avatars and anonymous users have a neutral icon", () => {
  assert.deepEqual(
    avatarAppearance({ name: "  Alex   Lee  " }),
    avatarAppearance({ name: "alex lee" }),
  );
  assert.deepEqual(avatarAppearance(), {
    background: "#6f817a",
    ink: "#ffffff",
  });
  assert.deepEqual(avatarAppearance({ name: "   " }), avatarAppearance());
});

test("account colors are near-unique, cover the color wheel and keep the icon readable", () => {
  const appearances = Array.from({ length: 1000 }, (_, index) =>
    avatarAppearance({ identity: `account-${index}` }),
  );
  // Hues a fraction of a degree apart round to the same hex value.
  assert.ok(new Set(appearances.map((avatar) => avatar.background)).size > 800);
  assert.equal(
    new Set(
      appearances.map((avatar) => Math.floor(hue(avatar.background) / 30)),
    ).size,
    12,
  );
  for (const { background, ink } of appearances) {
    assert.equal(ink, "#ffffff");
    assert.ok(1.05 / (luminance(background) + 0.05) >= 3, background);
  }
});
