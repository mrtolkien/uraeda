// US2 scenario 1 and the tall block's edge case: on the phone, the comment sheet opens with the
// selected block in view above it, and quotes the lines it comments on. A spec's folds (US1 of code
// quality in the skill): they survive Back, and a link into Details opens it, once.
import { act, screen, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { atRepo, drawn, show } from "./helpers.tsx";

/**
 * The toggle of the first block a review can select whose text holds a phrase: its name is the
 * block's text, and it lies under that text, as large as the block.
 */
function blockOf(phrase: string) {
  return screen
    .getAllByRole("button", { name: (name) => name.includes(phrase) })
    .find((b) => b.hasAttribute("aria-pressed")) as HTMLElement;
}

const SPEC = "/f/2026-10-06-recurring-tasks/spec.md";

/** A fold's trigger, by its label: the first with it, US2's for "Scenarios (4)". */
function fold(name: string) {
  return screen
    .getAllByRole("button", { name })
    .find((b) => b.hasAttribute("aria-expanded")) as HTMLElement;
}

/** Whether a text shows on the page: a folded one is not drawn. */
function shows(text: RegExp) {
  return screen.queryAllByText(text).some((element) => element.getBoundingClientRect().height > 0);
}

/** A tap in the middle of a block, on its text, which lies over its toggle. */
async function tap(block: HTMLElement) {
  await userEvent.click(block, { force: true });
}

/** Where the comment sheet starts on screen: its heading is the first thing it shows. */
function sheetTop() {
  const sheet = screen.getByRole("dialog", { name: "Comment" });
  return within(sheet).getByRole("heading", { name: "Comment" }).getBoundingClientRect().top;
}

/** The bottom of the phone's top bar. */
function barBottom() {
  return screen.getByRole("banner").getBoundingClientRect().bottom;
}

test("the selected block stays visible above the sheet, quoted (US2 1, 2)", async () => {
  if (window.innerWidth >= 768) {
    return;
  }
  await show(SPEC, "Complete a repeating task");
  await userEvent.click(fold("Scenarios (4)"));
  const block = blockOf("Given a weekly task");
  block.scrollIntoView({ block: "end" });
  await tap(block);

  const sheet = await screen.findByRole("dialog", { name: "Comment" });
  // The sheet has risen: before, it is below the block, which shows above it whatever the page.
  await drawn();
  // Between the bar and the sheet, once the page has scrolled.
  await expect
    .poll(() => {
      const box = block.getBoundingClientRect();
      return box.top >= barBottom() && box.bottom <= sheetTop();
    })
    .toBe(true);
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
  await tap(tallest);

  await screen.findByRole("dialog", { name: "Comment" });
  await drawn();
  // Taller than the space between the bar and the sheet, once the sheet has risen, and its top
  // under the bar once the page has scrolled.
  await expect
    .poll(() => {
      const box = tallest.getBoundingClientRect();
      return box.height > sheetTop() - barBottom() && Math.abs(box.top - barBottom()) < 3;
    })
    .toBe(true);
});

test("open folds survive Back (US1 4)", async () => {
  await show(SPEC, "Complete a repeating task");
  expect(shows(/a weekly task due Monday the 5th/)).toBe(false);
  await userEvent.click(fold("Scenarios (4)"));
  await userEvent.click(fold("Details"));
  expect(shows(/a weekly task due Monday the 5th/)).toBe(true);

  // A real click: WebKit skips, on Back, an entry that added another without a user's gesture.
  await userEvent.click(screen.getAllByRole("link", { name: "Recurring tasks" })[0]!);
  await expect.poll(() => window.location.pathname).toBe(atRepo("/f/2026-10-06-recurring-tasks"));
  // The spec page gone, so Back mounts its folds again from the history entry.
  await expect.poll(() => screen.queryAllByRole("button", { name: "Details" }).length).toBe(0);
  await act(async () => window.history.back());
  await expect.poll(() => window.location.pathname).toBe(atRepo(SPEC));

  await expect.poll(() => fold("Scenarios (4)")?.getAttribute("aria-expanded")).toBe("true");
  expect(fold("Details").getAttribute("aria-expanded")).toBe("true");
  expect(fold("Scenarios (3)").getAttribute("aria-expanded")).toBe("false");
});

test.each(["data", "details"])("a link to #%s opens the details (US1 5)", async (anchor) => {
  await show(`${SPEC}#${anchor}`, "Complete a repeating task");

  const heading = await screen.findByRole("heading", { name: "Data" });
  expect(fold("Details").getAttribute("aria-expanded")).toBe("true");
  // Under the top bar, which the phone has.
  const bar = screen.queryByRole("banner")?.getBoundingClientRect().bottom ?? 0;
  await expect
    .poll(() => {
      const box = heading.getBoundingClientRect();
      return box.top >= bar - 1 && box.bottom <= window.innerHeight;
    })
    .toBe(true);
});

test("Back keeps closed a fold a link opened (US1 4, 5)", async () => {
  await show(`${SPEC}#data`, "Complete a repeating task");
  await expect.poll(() => fold("Details")?.getAttribute("aria-expanded")).toBe("true");
  await userEvent.click(fold("Details"));
  expect(fold("Details").getAttribute("aria-expanded")).toBe("false");

  await userEvent.click(screen.getAllByRole("link", { name: "Recurring tasks" })[0]!);
  await expect.poll(() => window.location.pathname).toBe(atRepo("/f/2026-10-06-recurring-tasks"));
  // The feature's page drawn, the spec's gone.
  await expect.poll(() => screen.queryAllByRole("button", { name: "Details" }).length).toBe(0);
  await act(async () => window.history.back());
  await expect.poll(() => window.location.pathname).toBe(atRepo(SPEC));

  await expect.poll(() => fold("Scenarios (4)")?.getAttribute("aria-expanded")).toBe("false");
  await drawn();
  expect(fold("Details").getAttribute("aria-expanded")).toBe("false");
});
