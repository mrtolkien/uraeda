// US2 scenario 1 and the tall block's edge case: on the phone, the comment sheet opens with the
// selected block in view above it, and quotes the lines it comments on.
import { screen, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { show } from "./helpers.tsx";

/** The first block a review can select whose text holds a phrase. */
function blockOf(phrase: string) {
  return screen
    .getAllByRole("button")
    .find((b) => b.hasAttribute("aria-pressed") && b.textContent?.includes(phrase)) as HTMLElement;
}

/** Where the comment sheet starts on screen: its heading is the first thing it shows. */
function sheetTop() {
  const sheet = screen.getByRole("dialog", { name: "Comment" });
  return within(sheet).getByRole("heading", { name: "Comment" }).getBoundingClientRect().top;
}

/** Waits for the comment sheet to stop rising, and the page to stop scrolling. */
async function settled() {
  let last = "";
  await expect
    .poll(
      () => {
        const now = `${sheetTop()} ${window.scrollY}`;
        const same = now === last;
        last = now;
        return same;
      },
      { interval: 150, timeout: 5000 },
    )
    .toBe(true);
}

/** The bottom of the phone's top bar. */
function barBottom() {
  return screen.getByRole("banner").getBoundingClientRect().bottom;
}

test("the selected block stays visible above the sheet, quoted (US2 1, 2)", async () => {
  if (window.innerWidth >= 768) {
    return;
  }
  await show("/f/2026-10-06-recurring-tasks/spec.md", "Complete a repeating task");
  const block = blockOf("Given a weekly task");
  block.scrollIntoView({ block: "end" });
  await userEvent.click(block);

  const sheet = await screen.findByRole("dialog", { name: "Comment" });
  await settled();
  await expect.poll(() => block.getBoundingClientRect().bottom <= sheetTop()).toBe(true);
  expect(block.getBoundingClientRect().top).toBeGreaterThanOrEqual(barBottom());
  expect(block.getAttribute("aria-pressed")).toBe("true");
  expect(within(sheet).getByText(/^Lines \d+–\d+, under "US2/)).toBeTruthy();
  expect(within(sheet).getByText(/Given a weekly task/)).toBeTruthy();
});

test("a block taller than the space above the sheet starts under the bar", async () => {
  if (window.innerWidth >= 768) {
    return;
  }
  await show("/f/2026-10-13-plan-review/plan.md", "Task 5");
  // The tallest block of the plan a review can select.
  const tallest = screen
    .getAllByRole("button")
    .filter((b) => b.hasAttribute("aria-pressed"))
    .sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0]!;
  tallest.scrollIntoView({ block: "end" });
  await userEvent.click(tallest);

  await screen.findByRole("dialog", { name: "Comment" });
  const space = () => sheetTop() - barBottom();
  await settled();
  expect(tallest.getBoundingClientRect().height).toBeGreaterThan(space());
  await expect
    .poll(() => Math.abs(tallest.getBoundingClientRect().top - barBottom()))
    .toBeLessThan(3);
});
