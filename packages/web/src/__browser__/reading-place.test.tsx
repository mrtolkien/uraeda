// US7 1, 2 of the spec redesign: saving a comment, and a story frame that grows above the screen,
// never move the text read. WebKit's own scroll anchoring cannot be relied on (R25): the page keeps
// the place itself.
import { Theme } from "@astryxdesign/core/theme";
import { act, screen } from "@testing-library/react";
import { createRoot } from "react-dom/client";
import { describe, expect, test } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { StoryFrames } from "../StoryFrames.tsx";
import { uraedaTheme } from "../theme/built/uraeda.js";
import { atSize, drawn, scrollStopped, show } from "./helpers.tsx";

atSize("both");

/** How far, in px, the text read may move. */
const MOVE = 4;

const SPEC = "/f/2026-10-06-recurring-tasks/spec.md";

/** The bottom of the phone's top bar, or the window's top on a desktop, which has none. */
function barBottom() {
  return screen.queryByRole("banner")?.getBoundingClientRect().bottom ?? 0;
}

/** US2's heading, its first text starting "US2", wherever the spec's sections put it. */
function storyHeading() {
  return screen.getAllByText(/^US2\b/)[0]!;
}

/** The blocks after US2's heading a review can select, in order: each toggle holds its text. */
function blocksOf(heading: HTMLElement) {
  return screen
    .getAllByRole("button")
    .filter(
      (b) =>
        b.hasAttribute("aria-pressed") &&
        heading.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
}

/** A tap in the middle of a block, on its text, which lies over its toggle. */
async function tap(block: HTMLElement) {
  await userEvent.click(block, { force: true });
}

test("saving a comment keeps the heading you read in place (US7 1)", async () => {
  await show(SPEC, "Complete a repeating task");
  window.scrollBy(0, storyHeading().getBoundingClientRect().top - barBottom());
  await drawn();
  const before = storyHeading().getBoundingClientRect().top;

  await tap(blocksOf(storyHeading())[0]!);
  const field = await screen.findByRole("textbox", { name: "Comment text" });
  // The phone's sheet has risen, and the page has stopped moving.
  await drawn();
  await scrollStopped();
  await userEvent.type(field, "Log it where I can see it");
  await userEvent.click(screen.getByRole("button", { name: "Add comment" }));

  // Saved: its note under the block, the field closed.
  await expect
    .poll(
      () =>
        screen.queryByText(/saving…/) === null &&
        screen.queryAllByText(/^Log it where/).length > 0 &&
        screen.queryByRole("textbox", { name: "Comment text" }) === null,
    )
    .toBe(true);
  await drawn();
  await scrollStopped();
  expect(Math.abs(storyHeading().getBoundingClientRect().top - before)).toBeLessThanOrEqual(MOVE);
});

describe("on a desktop, where the form opens under the block", () => {
  atSize("desktop");

  test("the form moving down to the block you tap leaves that block in place", async () => {
    await show(SPEC, "Complete a repeating task");
    window.scrollBy(0, storyHeading().getBoundingClientRect().top - barBottom());
    await drawn();
    const [first, , third] = blocksOf(storyHeading());
    await tap(first!);
    await screen.findByRole("textbox", { name: "Comment text" });
    await drawn();
    await scrollStopped();
    const before = third!.getBoundingClientRect().top;

    // The form leaves the first block, above the third, for the third.
    await tap(third!);

    await drawn();
    await scrollStopped();
    expect(Math.abs(third!.getBoundingClientRect().top - before)).toBeLessThanOrEqual(MOVE);
  });
});

/**
 * A story frame scrolled wholly above the screen, the text read at the window's top, `send`, which
 * makes the frame's story report a height, as its `size` message does, and `leave`, which takes the
 * frame and the text off the page, as leaving it does. Runs `check`, then removes what it added to
 * the page.
 */
async function withFrameAbove(
  check: (
    send: (height: number) => void,
    frame: HTMLIFrameElement,
    text: HTMLElement,
    leave: () => void,
  ) => Promise<void>,
) {
  const container = document.createElement("div");
  // Room below the text, to scroll the frame above the screen.
  const below = document.createElement("div");
  below.style.height = "3000px";
  document.body.append(container, below);
  // The browser's scroll anchoring off, as once a page's content is replaced (R25): the page alone
  // keeps the place.
  document.documentElement.style.overflowAnchor = "none";
  const root = createRoot(container);
  let left = false;
  const leave = () => {
    if (left) {
      return;
    }
    left = true;
    root.unmount();
    container.remove();
  };
  try {
    const pick = { onPicked() {}, onPickStopped() {}, onReady() {}, picking: false };
    root.render(
      <Theme mode="light" theme={uraedaTheme}>
        <StoryFrames
          label="Growing"
          pick={pick}
          src="about:blank"
          wide={window.innerWidth >= 768}
          width="phone"
        />
        <p>The text read</p>
      </Theme>,
    );
    const frame = (await screen.findByTitle("Growing, phone")) as HTMLIFrameElement;
    const send = (height: number) => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { height, uraeda: "size" },
          source: frame.contentWindow,
        }),
      );
    };
    await drawn();
    const text = screen.getByText("The text read");
    // The frame above the screen, the text at its top.
    window.scrollBy(0, text.getBoundingClientRect().top + 1);
    await drawn();
    expect(frame.getBoundingClientRect().bottom).toBeLessThan(0);
    await check(send, frame, text, leave);
  } finally {
    leave();
    below.remove();
    document.documentElement.style.overflowAnchor = "";
  }
}

test("a story frame above you that grows does not move the text (US7 2)", async () => {
  await withFrameAbove(async (send, frame, text) => {
    const before = text.getBoundingClientRect().top;
    /** The story reports its height, and the frame has taken it. */
    const report = async (height: number) => {
      await act(async () => send(height));
      await expect.poll(() => frame.getBoundingClientRect().height).toBe(height);
      await drawn();
    };

    await report(560);
    await report(700);

    expect(Math.abs(text.getBoundingClientRect().top - before)).toBeLessThanOrEqual(MOVE);
  });
});

test("a story frame above you that reports sizes in a burst does not move the text", async () => {
  await withFrameAbove(async (dispatch, frame, text) => {
    // The frame far enough above that it stays above the screen as it grows.
    window.scrollBy(0, 400);
    await drawn();
    const before = text.getBoundingClientRect().top;

    // Three sizes, each drawn before the next comes, all before a place is put back: each place is
    // kept while the ones before are still in flight.
    for (const height of [560, 700, 720]) {
      act(() => dispatch(height));
    }
    await expect.poll(() => frame.getBoundingClientRect().height).toBe(720);
    await drawn();
    await drawn();

    expect(Math.abs(text.getBoundingClientRect().top - before)).toBeLessThanOrEqual(MOVE);
  });
});

test("leaving the page as a story frame above you grows scrolls nothing", async () => {
  await withFrameAbove(async (send, _frame, _text, leave) => {
    window.scrollBy(0, 400);
    await drawn();
    act(() => send(700));
    act(leave);
    const before = window.scrollY;

    await drawn();
    await drawn();

    expect(window.scrollY).toBe(before);
  });
});
