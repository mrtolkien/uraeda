// "Back and reload keep the human's place and what they were reading" (the UI behaviour decision),
// which needs a real layout and a real scroll: a document keeps its position across a link, Back,
// and a reload; a form that moves under a block and a longer transcript leave the text read where it was; a
// session follows its end only while the human is at the end. Positions are compared with each
// other, never with a size, so a change of design does not fail them.
import { act, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { atRepo, drawn, reload, scrollStopped, opened, watchFor } from "./helpers.tsx";

const SPEC = "/f/2026-10-06-recurring-tasks/spec.md";

/** How far, in px, the text read may move. */
const MOVE = 4;

/** Rounded, as the browser reports it. */
const scrolled = () => Math.round(window.scrollY);

/** Scrolls the spec down to its last link to another page, follows it, and gives the position left. */
async function leave() {
  await opened(SPEC);
  await expect
    .poll(() => within(screen.getByRole("main")).queryAllByRole("link").length)
    .toBeGreaterThan(0);
  const link = within(screen.getByRole("main"))
    .getAllByRole("link")
    .filter((a) => (a.getAttribute("href") ?? "").includes("/f/"))
    .at(-1)!;
  const position = Math.round(
    link.getBoundingClientRect().top + window.scrollY - window.innerHeight / 2,
  );
  expect(position).toBeGreaterThan(200);
  window.scrollTo(0, position);
  await expect.poll(scrolled).toBe(position);
  // A real click: WebKit skips, on Back, an entry that added another without a user's gesture.
  await userEvent.click(link);
  await expect.poll(() => window.location.pathname).not.toBe(atRepo(SPEC));
  await expect.poll(() => link.isConnected).toBe(false);
  await drawn();
  return position;
}

describe("a document", () => {
  test("Back returns to the position, without a loading state in between", async () => {
    const position = await leave();
    const loading = watchFor("Loading…");

    await act(async () => window.history.back());

    await expect.poll(() => window.location.pathname).toBe(atRepo(SPEC));
    await expect.poll(scrolled).toBe(position);
    expect(loading.stop()).toBe(false);
  });

  test("the position survives a reload, then Back", async () => {
    const position = await leave();
    await reload("");

    await act(async () => window.history.back());

    await expect.poll(() => window.location.pathname).toBe(atRepo(SPEC));
    await expect.poll(scrolled).toBe(position);
  });
});

/** US2's heading, wherever the spec's sections put it. */
const heading = () => screen.getAllByText(/^US2\b/)[0]!;

/** The bottom of the phone's top bar, or the window's top on a desktop, which has none. */
const barBottom = () => screen.queryByRole("banner")?.getBoundingClientRect().bottom ?? 0;

/** The blocks after US2's heading a review can select, in order: each toggle holds its text. */
const blocks = () =>
  screen
    .getAllByRole("button")
    .filter(
      (b) =>
        b.hasAttribute("aria-pressed") &&
        heading().compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING,
    );

describe("a comment on a spec", () => {
  test("the form moving down to the block tapped leaves that block where it was", async () => {
    await opened(SPEC);
    await expect.poll(() => screen.queryAllByText(/^US2\b/).length).toBeGreaterThan(2);
    window.scrollBy(0, heading().getBoundingClientRect().top - barBottom());
    await drawn();
    const [first, , third] = blocks();
    await userEvent.click(first!, { force: true });
    await screen.findByRole("textbox", { name: "Comment text" });
    await drawn();
    await scrollStopped();
    const before = third!.getBoundingClientRect().top;

    // The form leaves the first block, which lies above the third, for the third.
    await userEvent.click(third!, { force: true });

    await drawn();
    await scrollStopped();
    expect(Math.abs(third!.getBoundingClientRect().top - before)).toBeLessThanOrEqual(MOVE);
  });
});
