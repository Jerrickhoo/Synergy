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
