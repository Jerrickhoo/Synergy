# Synergy identity assets

The application logo is `synergy-logo.png`, exported from the user-provided `SynergyLogoFinal.png` (October 30, 2026). Two ribbons meet along a curved seam to form an S, with one dot in each bowl. The colors are deep teal (about `#027E84`) and bright teal (about `#1EC1BE`). `synergy-logo.png` is cropped tightly to the mark and is 512px tall. `synergy-favicon.png` (64px) and `synergy-touch-icon.png` (180px) center the mark in a transparent square. Preserve the aspect ratio (325 × 512). Regenerate all three from the source file rather than from each other.

The shared `Brand` component shows the mark followed by the full word “Synergy”. The gap between them is about 0.4em, so the S-shaped mark does not read as a doubled first letter. Its accessible name is “Synergy”.

The SVG assets below are legacy reference assets from the October 29 review; they are no longer the application logo or favicon.

| Asset                      | Use                                                                   |
| -------------------------- | --------------------------------------------------------------------- |
| `synergy-lockup.svg`       | Full-color wordmark on light backgrounds                              |
| `synergy-lockup-light.svg` | Mint/lime mark and white wordmark on dark backgrounds                 |
| `synergy-lockup-mono.svg`  | One-color wordmark on light backgrounds                               |
| `synergy-mark.svg`         | Compact full-color mark                                               |
| `synergy-mark-light.svg`   | Compact mark for dark backgrounds                                     |
| `synergy-mark-mono.svg`    | Compact one-color mark                                                |
| `../favicon.svg`           | Linked-ribbon mark on a dark rounded tile; checked at 16, 24 and 32px |
| `login-connections.svg`    | Decorative login artwork; always use an empty alt attribute           |

Do not stretch the logo or add shadows to the mark. The application renders its wordmark using the existing system font stack. The runtime `Brand` component supports standard and compact sizes.

See [the reference sheet](../../docs/ux/visual-reference.html) for light/dark, monochrome, and small-size examples.
