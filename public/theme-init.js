// Runs synchronously in the head, including under the production self-only CSP.
try {
  document.documentElement.dataset.theme =
    localStorage.getItem("synergy-theme") === "dark" ? "dark" : "light";
} catch {
  document.documentElement.dataset.theme = "light";
}
// The sidebar choice too, so a collapsed sidebar never shows open on load.
try {
  document.documentElement.dataset.sidebar =
    localStorage.getItem("synergy-sidebar") === "collapsed"
      ? "collapsed"
      : "expanded";
} catch {
  document.documentElement.dataset.sidebar = "expanded";
}
