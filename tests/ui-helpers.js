// Interact with the visible custom control; its backing select is only for
// form semantics. Value IDs are intentionally distinct from display labels.
export async function selectValue(control, value) {
  await control.click();
  await control
    .page()
    .getByRole("listbox")
    .locator(`[role="option"][data-value=${JSON.stringify(String(value))}]`)
    .click();
}

export async function confirmSignOut(page) {
  await page
    .getByRole("dialog", { name: "Sign out of Synergy?", exact: true })
    .getByRole("button", { name: "Sign out", exact: true })
    .click();
}

// Names what makes a page wider than the window, so a layout failure says
// which element to fix instead of only "expected true, received false".
export async function horizontalOverflow(page) {
  return page.evaluate(() => {
    const limit = innerWidth + 1;
    const offenders = [];
    for (const element of document.querySelectorAll("body *")) {
      const box = element.getBoundingClientRect();
      if (!box.width || box.right <= limit) continue;
      // Report the innermost element that sticks out.
      if (
        [...element.children].some(
          (child) => child.getBoundingClientRect().right > limit,
        )
      )
        continue;
      const name = `${element.tagName.toLowerCase()}${[...element.classList]
        .map((item) => `.${item}`)
        .join("")}`;
      const text = (element.textContent || "").trim().slice(0, 40);
      offenders.push(
        `${name} (right ${Math.round(box.right)}, width ${Math.round(box.width)}${text ? `, "${text}"` : ""})`,
      );
    }
    return {
      scrollWidth: document.documentElement.scrollWidth,
      width: innerWidth,
      offenders: offenders.slice(0, 8),
    };
  });
}
