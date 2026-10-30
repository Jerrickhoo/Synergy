let locks = 0;
let previousOverflow = "";

// Drawers can hand off to a modal in the same render. Restore scrolling only
// after every owner has released its lock, regardless of effect ordering.
export function lockDocumentScroll() {
  if (locks++ === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--locks === 0) document.body.style.overflow = previousOverflow;
  };
}
