// Whether this browser keeps the desktop sidebar open or as an icon rail.
// public/theme-init.js applies it before the first paint.
export const sidebarKey = "synergy-sidebar";

export function readSidebar() {
  try {
    return localStorage.getItem(sidebarKey) === "collapsed"
      ? "collapsed"
      : "expanded";
  } catch {
    return "expanded";
  }
}

export function applySidebar(value) {
  document.documentElement.dataset.sidebar = value;
}

export function saveSidebar(value) {
  applySidebar(value);
  try {
    localStorage.setItem(sidebarKey, value);
  } catch {
    // Private browsing: the choice lasts for this page only.
  }
}
