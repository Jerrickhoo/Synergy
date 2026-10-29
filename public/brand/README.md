# Synergy identity assets

Selected in the October 29, 2026 UX review. Preserve the existing linked-ribbon silhouette with consistent clear space, a calmer green palette, and a shared favicon.

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

Use at least one quarter of the mark's width as surrounding clear space. Do not stretch the logo, add shadows to the mark, or use the lime accent as body text. SVG lockups use Segoe UI with Arial/system fallback; the application renders its wordmark using the existing system font stack. The runtime `Brand` component supports compact and monochrome variants and adapts ribbon colors on the sidebar and mobile drawer.

See [the reference sheet](../../docs/ux/visual-reference.html) for light/dark, monochrome, and small-size examples.
