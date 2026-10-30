# Synergy identity assets

The application logo is `synergy-logo.svg`, a vector redraw of the user-provided `Synergy Logo.png` from October 30, 2026. It keeps the original shapes, the straight seam between the two halves and the two colors: deep teal `#027D82` and bright teal `#1DC1BB`. The PNGs are exported from that SVG. `synergy-logo.png` is 512px tall. `synergy-favicon.png` (64px) and `synergy-touch-icon.png` (180px) center the mark in a transparent square. Preserve the aspect ratio (316 × 512).

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
