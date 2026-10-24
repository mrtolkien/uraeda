// The questions page's US3 and its high edge case "The session's transcript cannot follow its end
// inside the column": on wide and semi-wide screens, the round's Session column draws the feature's
// session, its transcript scrolling in the column, which follows its end while the human is there,
// and its composer at the column's foot; the round never moves. Review focus 1: Back to the round
// keeps its place, and the column's transcript opens at its end, never at the window's saved
// position.
import { act, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import {
  agent,
  atRepo,
  atSize,
  drawn,
  LIVE,
  repository,
  scrollStopped,
  show,
  startTurn,
} from "./helpers.tsx";

const FOLDER = "2026-10-11-web-ui";
const PAGE = `/f/${FOLDER}/clarifications-01.md`;
const OPENING = "How does your iPhone reach the server?";

beforeEach(() => {
  // A browser that never opened the round: it opens at its top.
  window.localStorage.removeItem(`uraeda.round.${repository()}/${FOLDER}/clarifications-01.md`);
});

/** Lines of the agent's text, numbered. */
function lines(count: number, prefix: string) {
  return Array.from({ length: count }, (_, index) => ({
    text: `${prefix} ${index + 1}.`,
    type: "text" as const,
  }));
}

/** The round's Session column, which scrolls on its own. */
function column() {
  return screen.getByRole("complementary", { name: "Session" });
}

/** The composer's text field, in the column. */
function composer() {
  return within(column()).getByRole("textbox", { name: "Message Claude Code" });
}

/** Whether an element shows in the column, above its composer. */
function inView(element: Element) {
  const { bottom, top } = element.getBoundingClientRect();
  return (
    top >= column().getBoundingClientRect().top &&
    bottom <= composer().getBoundingClientRect().top + 1
  );
}

/** How far a question's top is from where a jump puts it, under the bar. */
function offset(id: string) {
  const section = document.getElementById(id)!;
  return Math.abs(
    section.getBoundingClientRect().top -
      Number.parseFloat(getComputedStyle(section).scrollMarginTop),
  );
}

/** Opens the round with its Session column, and starts a turn that writes `count` lines. */
async function openWorkingColumn(count: number) {
  await show(`${PAGE}?tab=session`, OPENING);
  await startTurn("Explain the round.", lines(count, "Line"));
  const log = await within(column()).findByRole("log", { name: "Conversation" }, LIVE);
  await within(log).findByText(`Line ${count}.`, undefined, LIVE);
  await drawn();
  return log;
}

/** The bottom of the composer's last row, its buttons and its field, in the column. */
function composerFoot() {
  const send = within(column()).getByRole("button", { name: /^(Send|Stop)$/ });
  return Math.max(send.getBoundingClientRect().bottom, composer().getBoundingClientRect().bottom);
}

/**
 * Whether the column's last pixel row is the composer's: what is drawn there is held with the text
 * field, never with the transcript.
 */
function composerAtFoot(log: HTMLElement) {
  const { bottom, left, width } = column().getBoundingClientRect();
  let holder = document.elementFromPoint(left + width / 2, bottom - 1);
  while (holder && !holder.contains(composer())) {
    holder = holder.parentElement;
  }
  return holder !== null && !holder.contains(log);
}

function columnTests() {
  test("the column's transcript follows its end, the round stays", async () => {
    const log = await openWorkingColumn(80);
    const box = column();
    expect(box.scrollHeight).toBeGreaterThan(box.clientHeight);
    await expect.poll(() => inView(within(log).getByText("Line 80.")), LIVE).toBe(true);
    expect(window.scrollY).toBe(0);

    // Scrolled up, the column keeps its place as lines arrive, and offers the jump back.
    box.scrollTo(0, box.scrollTop - 400);
    await drawn();
    const position = box.scrollTop;
    await agent.agentEmit(lines(10, "More"));
    const last = await within(log).findByText("More 10.", undefined, LIVE);
    await drawn();
    expect(box.scrollTop).toBe(position);
    expect(inView(last)).toBe(false);
    expect(window.scrollY).toBe(0);

    await userEvent.click(
      await within(box).findByRole("button", { name: "Jump to the latest" }, LIVE),
    );
    await expect.poll(() => inView(last), LIVE).toBe(true);
    expect(window.scrollY).toBe(0);
  });

  test("the composer stays at the column's foot", async () => {
    const log = await openWorkingColumn(80);
    const box = column();
    // Where the composer's last row is, from the column's bottom: the same at both ends.
    const gap = () => box.getBoundingClientRect().bottom - composerFoot();
    const atEnd = gap();
    expect(atEnd).toBeGreaterThanOrEqual(0);
    expect(composerAtFoot(log)).toBe(true);

    box.scrollTo(0, 0);
    await drawn();
    expect(Math.abs(gap() - atEnd)).toBeLessThanOrEqual(1);
    expect(composerAtFoot(log)).toBe(true);
  });

  test("Back to the round keeps its place and the transcript's end", async () => {
    const log = await openWorkingColumn(80);
    await agent.agentEmit([
      { denials: [], errors: [], interrupted: false, ok: true, type: "result" },
    ]);
    await expect
      .poll(() => within(column()).queryByRole("button", { name: "Stop" }), LIVE)
      .toBeNull();
    await expect.poll(() => inView(within(log).getByText("Line 80.")), LIVE).toBe(true);

    // The round read at Q3.
    const q3 = document.getElementById("Q3")!;
    window.scrollTo(0, window.scrollY + offsetTop(q3));
    await scrollStopped();
    await expect.poll(() => offset("Q3")).toBeLessThan(3);
    // The page saves its position as the human scrolls, not at once.
    await new Promise((resolve) => setTimeout(resolve, 700));

    // A real click: WebKit skips, on Back, an entry that added another without a user's gesture.
    await userEvent.click(within(column()).getByRole("link", { name: "Open the session's page" }));
    await expect.poll(() => window.location.pathname).toBe(atRepo(`/f/${FOLDER}/session`));
    await screen.findByRole("log", { name: "Conversation" }, LIVE);
    await act(async () => window.history.back());
    await expect.poll(() => window.location.pathname).toBe(atRepo(PAGE));

    await expect.poll(() => offset("Q3"), LIVE).toBeLessThan(3);
    const again = await within(column()).findByRole("log", { name: "Conversation" }, LIVE);
    await expect.poll(() => inView(within(again).getByText("Line 80.")), LIVE).toBe(true);
    await drawn();
    expect(offset("Q3")).toBeLessThan(3);
  });
}

/** How far down the window a question's top is, from where a jump puts it. */
function offsetTop(section: HTMLElement) {
  return (
    section.getBoundingClientRect().top -
    Number.parseFloat(getComputedStyle(section).scrollMarginTop)
  );
}

describe("on the desktop", () => {
  atSize("desktop");
  columnTests();
});

describe("semi-wide", () => {
  atSize("semi");
  columnTests();
});
