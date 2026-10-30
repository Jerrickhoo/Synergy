// Runs synchronously in the head, including under the production self-only CSP.
try {
  document.documentElement.dataset.theme =
    localStorage.getItem("synergy-theme") === "dark" ? "dark" : "light";
} catch {
  document.documentElement.dataset.theme = "light";
}
