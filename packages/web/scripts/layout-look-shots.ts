// The views the layout and look redrew: the constitution and decisions, a decision, one a feature's
// branch changes, and the palette; the shell and the home at a semi-wide 1205 px, its rail folded
// and opened by a tap of its logo; and the phone's Sessions tab.
import type { Page } from "playwright";
import { type Each, type Shot, settle, show } from "./shots.ts";

/** A semi-wide window, the spec's: the shell its 52 px rail. */
const SEMI_WIDE = { height: 900, width: 1205 };

/** What home shows once its data is drawn: the line above its widgets. */
const HOME = "Overview";

/** The first principle's title, in the list at every width and in the reader beside it. */
const PRINCIPLE_I = "Humans stay in control";

/** The constitution and decisions, a decision open, a changed one, and the palette. */
export async function takeDecisions(each: Each) {
  await each("decisions", ({ page }) => show(page, "/decisions", PRINCIPLE_I));
  await each("decision", ({ page }) => show(page, "/decisions/ui-behaviour", "Approved by"));
  // Task storage, which the spec page's features change on their branches.
  await each("decision-changed", ({ page }) =>
    show(page, "/decisions/task-storage", /^Proposed by /),
  );
  await each("decisions-palette", async ({ page }) => {
    await show(page, "/decisions", PRINCIPLE_I);
    await page.getByRole("button", { name: /^Jump to…/ }).click();
    await page.getByRole("combobox", { name: "Jump to a decision or principle" }).fill("task");
    await page.getByRole("option", { name: /Task history/ }).waitFor();
    await settle(page);
  });
}

/** Home at 1205 px, then with the rail opened over it by a tap of its logo. */
async function semiWide(page: Page, isOpen: boolean) {
  await page.setViewportSize(SEMI_WIDE);
  await show(page, "/", HOME);
  if (isOpen) {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("button", { expanded: true, name: "Open navigation" }).waitFor();
    // Away from the rail, which the mouse resting on would hold open.
    await page.mouse.move(SEMI_WIDE.width - 1, SEMI_WIDE.height / 2);
    await settle(page);
  }
}

/** The shell and the home at 1205 px, and the phone's Sessions tab. */
export async function takeLayoutLook(each: Each, shots: Array<Shot>) {
  await each("home-1205", ({ page }) => semiWide(page, false), "desktop");
  await each("shell-1205-open", ({ page }) => semiWide(page, true), "desktop");
  for (const { page, size } of shots) {
    if (size === "desktop") {
      await page.setViewportSize({ height: 900, width: 1440 });
    }
  }
  await each("sessions", ({ page }) => show(page, "/sessions", "Sessions"), "phone");
}
