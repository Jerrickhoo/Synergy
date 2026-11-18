import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { open, user } from "./founder-browser-helpers.js";

test("Impact suppresses sparse data and opens a printable volunteer certificate", async ({
  page,
  request,
}) => {
  const mentor = await user(
    request,
    "ImpactMentor",
    {
      bio: "Advise student teams",
      offer: "Product strategy",
      need: "Focused questions",
      expertise: "Product strategy",
      startups: "Education startups",
    },
    "mentor",
  );
  await open(page, mentor, "impact");
  await expect(
    page.getByRole("heading", { name: "Mentoring impact" }),
  ).toBeVisible();
  await expect(page.getByText("Not enough data yet").first()).toBeVisible();
  for (const width of [1440, 768, 390, 360]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
  }
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(audit.violations.map(({ id }) => id)).toEqual([]);
  await page
    .getByRole("button", { name: "View volunteer certificate" })
    .click();
  await expect(page).toHaveURL(/#\/impact\/certificate$/);
  await expect(
    page.getByRole("heading", { name: "ImpactMentor Audit", exact: true }),
  ).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(
    page.getByRole("button", { name: "Print certificate" }),
  ).toBeHidden();
});
