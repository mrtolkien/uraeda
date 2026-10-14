// US1 scenarios 6, 7, and 8, and the review's C3: on a wide screen, the round's index is a sticky
// column beside the questions, `n` and `p` move between blank questions, Back returns to the same
// question, and at a 1200 px window with the navigation open, the questions keep 600 px.
import { act, screen } from "@testing-library/react";
import { beforeEach, expect, test } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { atRepo, drawn, repository, scrollStopped, show, watchFor } from "./helpers.tsx";

const FOLDER = "2026-10-11-web-ui";
const PAGE = `/f/${FOLDER}/clarifications-01.md`;

beforeEach(() => {
  // A browser that never opened the round: a round not started opens on its intro, at its top.
  window.localStorage.removeItem(`uraeda.round.${repository()}/${FOLDER}/clarifications-01.md`);
});

/** How far a question's top is from where a jump puts it, under the bar. */
function offset(id: string) {
  const section = document.getElementById(id)!;
  return Math.abs(
    section.getBoundingClientRect().top -
      Number.parseFloat(getComputedStyle(section).scrollMarginTop),
  );
}

test("the index is a column beside the questions, and n and p jump (US1 6, 7)", async () => {
  if (window.innerWidth < 768) {
    return;
  }
  await show(PAGE, "How does your iPhone reach the server?");
  const index = screen.getByRole("navigation", { name: "Questions" });
  expect(index.textContent).toContain("0 of 3 answered");
  expect(screen.getByRole("button", { name: "Next" })).toBeTruthy();
  const question = document.getElementById("Q1")!.getBoundingClientRect();
  expect(index.getBoundingClientRect().left).toBeGreaterThanOrEqual(question.right);
  await drawn();
  expect(window.scrollY).toBe(0);

  // The keys reach the page once it has the focus, as after the human's first click in it.
  await userEvent.click(
    screen.getByRole("heading", { name: "Which human steps does the UI perform?" }),
  );
  await userEvent.keyboard("n");
  await expect.poll(() => offset("Q1")).toBeLessThan(3);
  await userEvent.keyboard("n");
  await expect.poll(() => offset("Q2")).toBeLessThan(3);
  // It stays in view while the page scrolls.
  const box = index.getBoundingClientRect();
  expect(box.top).toBeGreaterThanOrEqual(0);
  expect(box.top).toBeLessThan(window.innerHeight / 2);

  await userEvent.keyboard("p");
  await expect.poll(() => offset("Q1")).toBeLessThan(3);
  await scrollStopped();

  // Neither key acts while a text field has the focus.
  const comment = screen.getAllByRole("textbox", { name: "Comment" })[0] as HTMLTextAreaElement;
  await userEvent.click(comment);
  await scrollStopped();
  const before = window.scrollY;
  await userEvent.keyboard("n");
  expect(comment.value).toBe("n");
  // A jump gives its question's title the focus at once, then scrolls from the next frame.
  expect(document.activeElement).toBe(comment);
  await drawn();
  expect(window.scrollY).toBe(before);
});

test("Back returns to the question at the top (US1 8)", async () => {
  if (window.innerWidth < 768) {
    return;
  }
  await show(PAGE, "How does your iPhone reach the server?");
  await userEvent.click(
    screen.getByRole("heading", { name: "Which human steps does the UI perform?" }),
  );
  await userEvent.keyboard("n");
  await expect.poll(() => offset("Q1")).toBeLessThan(3);
  await userEvent.keyboard("n");
  await expect.poll(() => offset("Q2")).toBeLessThan(3);
  await scrollStopped();

  // A real click: WebKit skips, on Back, an entry that added another without a user's gesture.
  await userEvent.click(screen.getByRole("link", { name: "discovery" }));
  await expect.poll(() => window.location.pathname).toBe(atRepo(`/f/${FOLDER}/discovery-01.md`));
  await expect
    .poll(() => document.body.textContent?.includes("A web UI for a spec workflow has four parts."))
    .toBe(true);
  // The round comes back at Q2, never through "Loading…".
  const loading = watchFor("Loading…");
  await act(async () => window.history.back());
  await expect.poll(() => window.location.pathname).toBe(atRepo(PAGE));
  await expect.poll(() => offset("Q2")).toBeLessThan(3);
  expect(loading.stop()).toBe(false);
});

test("at 1200 px with the navigation open, the questions get at least 600 px (C3)", async () => {
  if (window.innerWidth < 768) {
    return;
  }
  await page.viewport(1200, 900);
  try {
    await show(PAGE, "How does your iPhone reach the server?");
    // The side navigation is open, at its default width, with the index beside the questions.
    const priorities = screen.getByRole("link", { name: "Priorities" }).getBoundingClientRect();
    expect(priorities.width).toBeGreaterThan(100);
    expect(screen.getByRole("navigation", { name: "Questions" })).toBeTruthy();
    const title = screen.getByRole("heading", { name: "How does your iPhone reach the server?" });
    expect(title.getBoundingClientRect().width).toBeGreaterThanOrEqual(600);
  } finally {
    await page.viewport(1440, 900);
  }
});
