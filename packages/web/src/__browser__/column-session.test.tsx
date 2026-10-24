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

/** The round's column, Session open, which scrolls on its own. */
function column() {
  return screen.getByRole("complementary", { name: "The round's column" });
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

/** Ends the turn, and waits for the column's composer to stop working. */
async function endTurn() {
  await agent.agentEmit([
    { denials: [], errors: [], interrupted: false, ok: true, type: "result" },
  ]);
  await expect
    .poll(() => within(column()).queryByRole("button", { name: "Stop" }), LIVE)
    .toBeNull();
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
    await endTurn();
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

/**
 * Scrolls the column to its top, and waits until it stays there three frames in a row: the end of
 * the turn moves it to its end once more as it draws.
 */
async function toTop(box: HTMLElement) {
  let still = 0;
  await expect
    .poll(async () => {
      if (box.scrollTop === 0) {
        still += 1;
      } else {
        box.scrollTo(0, 0);
        still = 0;
      }
      await drawn();
      return still;
    }, LIVE)
    .toBeGreaterThanOrEqual(3);
}

/** Tests of the column's transcript drawn in parts, from its end. */
function tailTests() {
  test("Show earlier messages keeps the message read in the column, the round stays", async () => {
    const log = await openWorkingColumn(60);
    await endTurn();
    const box = column();
    const drawnLines = () => within(log).queryAllByText(/^Line \d+\.$/);
    expect(drawnLines()).toHaveLength(20);

    // Read at the top of the column, at the press: the window is not scrolled.
    await toTop(box);
    expect(window.scrollY).toBe(0);
    const reading = drawnLines()[0]!;
    const place = () => reading.getBoundingClientRect().top - box.getBoundingClientRect().top;
    const before = place();
    await userEvent.click(within(log).getByRole("button", { name: "Show earlier messages" }));
    await expect.poll(() => drawnLines().length, LIVE).toBe(40);

    expect(drawnLines()[20]).toBe(reading);
    // The place is put back once the earlier messages are drawn, which a busy machine may draw late.
    await expect.poll(() => Math.abs(place() - before), LIVE).toBeLessThanOrEqual(1);
    await drawn();
    await drawn();
    expect(Math.abs(place() - before)).toBeLessThanOrEqual(1);
    expect(window.scrollY).toBe(0);
  });

  test("a turn the address names leaves the column at its end and the round at its top", async () => {
    const log = await openWorkingColumn(80);
    await endTurn();
    const turn = log.querySelector('[id^="turn-"]')!.id;

    // The turn named is the session's page's: the round's window and its column keep their own.
    await show(`${PAGE}?tab=session#${turn}`, OPENING);
    const again = await within(column()).findByRole("log", { name: "Conversation" }, LIVE);
    const last = await within(again).findByText("Line 80.", undefined, LIVE);
    await expect.poll(() => inView(last), LIVE).toBe(true);
    await drawn();
    expect(inView(last)).toBe(true);
    expect(window.scrollY).toBe(0);
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
  tailTests();
});

describe("semi-wide", () => {
  atSize("semi");
  columnTests();
  tailTests();
});
