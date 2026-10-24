// The round's cards, in WebKit: the two columns' ratio, the follow-up's joint and indent on a wide
// screen, its top border on the phone, and the options' focus ring. The question card's US1 key 3
// and more 4 and 5, US2 key 1 and 2, SC-001, and SC-004: the header stays at the top while its card
// is on screen, at every width, and the phone's options and points keep the screen's width.
import { screen, within } from "@testing-library/react";
import { describe, expect, test } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { atSize, commands, drawn, show } from "./helpers.tsx";

const FOLDER = "2026-10-11-web-ui";
const PAGE = `/f/${FOLDER}/clarifications-01.md`;
const FIRST = "How does your iPhone reach the server?";

/** The feature a test writes a fixture round in, and its round. */
const ROUND_FOLDER = "2026-10-06-recurring-tasks";
const ROUND_PAGE = `/f/${ROUND_FOLDER}/clarifications-01.md`;
const Q4 = "Where should the session open on the questions page?";
const MERGE_Q1 = "Who may move a chat up to a change, or a change up to a feature?";

/** Writes a fixture round, changed by `edit`, as the feature's round, and shows it. */
async function showRound(name: string, wait: string, edit = (text: string) => text) {
  const round = await commands.fixtureText(`${name}/clarifications-01.md`);
  await commands.commitOnBranch(ROUND_FOLDER, {
    [`specs/${ROUND_FOLDER}/clarifications-01.md`]: edit(round),
  });
  await show(ROUND_PAGE, wait);
}

/** A question's title. */
const titleOf = (id: string) => document.getElementById(`${id}-title`)!;

/**
 * Whether an element shows: its middle inside the window, and on top there, not under a bar or a
 * header that sticks over it.
 */
function seen(element: Element) {
  const box = element.getBoundingClientRect();
  const x = box.left + Math.min(8, box.width / 2);
  const y = box.top + box.height / 2;
  if (y < 0 || y > window.innerHeight) {
    return false;
  }
  const at = document.elementFromPoint(x, y);
  return at !== null && element.contains(at);
}

/** The first box around an element, the element included, with a border on its start side. */
function bordered(element: Element) {
  for (let at: Element | null = element; at; at = at.parentElement) {
    if (getComputedStyle(at).borderInlineStartWidth !== "0px") {
      return at;
    }
  }
  throw new Error("no border around the element");
}

/** A question's card, or its section on the phone. */
const card = (id: string) => document.getElementById(id)!;

/** The checkbox of a question's option, by its letter. */
const checkbox = (id: string, letter: string) =>
  within(card(id)).getByRole("checkbox", { name: new RegExp(String.raw`^Option ${letter}\b`) });

/** The card of a question's option, by its letter: the box its checkbox is in. */
const optionOf = (id: string, letter: string) => checkbox(id, letter).parentElement!;

/** Picks Q1's option B, which asks the follow-up Q1.B, and waits for its card. */
async function askFollowUp() {
  await userEvent.click(checkbox("Q1", "B").parentElement!);
  await expect.poll(() => document.getElementById("Q1.B")).toBeTruthy();
  await drawn();
}

/** The widths of a grid's columns, in px. */
const columns = (grid: Element) =>
  getComputedStyle(grid).gridTemplateColumns.split(" ").map(Number.parseFloat);

/** The grid of a question's card, which holds its title and its options. */
function gridOf(id: string) {
  for (let at = card(id).querySelector("h3, h2")?.parentElement; at; at = at.parentElement) {
    if (getComputedStyle(at).display === "grid") {
      return at;
    }
  }
  return undefined;
}

/** A follow-up's own box, its joint before it: the first ancestor with a joint just before it. */
function followUpBox(id: string) {
  for (let at: Element | null = card(id); at; at = at.parentElement) {
    const joint = at.previousElementSibling;
    if (joint && getComputedStyle(joint).borderInlineStartStyle === "solid") {
      return { box: at, joint };
    }
  }
  throw new Error(`${id} has no joint`);
}

describe("question cards on the desktop", () => {
  atSize("desktop");

  test("a card's title and options are columns of 5 to 6", async () => {
    await show(PAGE, FIRST);
    await drawn();

    const [title, options] = columns(gridOf("Q2")!);

    expect(title! / options!).toBeCloseTo(5 / 6, 2);
  });

  test("a follow-up hangs from its parent by a 4 px accent line, and is indented under it", async () => {
    await show(PAGE, FIRST);
    await askFollowUp();

    const { box, joint } = followUpBox("Q1.B");
    const line = getComputedStyle(joint);

    expect(line.borderInlineStartWidth).toBe("4px");
    expect(line.borderInlineStartColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(box.getBoundingClientRect().left).toBeGreaterThan(
      card("Q1").getBoundingClientRect().left,
    );
    expect(joint.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      box.getBoundingClientRect().top + 0.5,
    );
  });

  test("an option's card is ringed while its checkbox has the focus", async () => {
    await show(PAGE, "Which repositories does the UI open now?");
    const ring = (id: string, letter: string) =>
      getComputedStyle(checkbox(id, letter).parentElement!).outlineStyle;
    expect(ring("Q3", "A")).toBe("none");

    await userEvent.click(
      screen.getByRole("heading", { name: "Which repositories does the UI open now?" }),
    );
    await userEvent.tab();

    expect(document.activeElement).toBe(checkbox("Q3", "A"));
    expect(ring("Q3", "A")).toBe("solid");
    expect(getComputedStyle(checkbox("Q3", "A").parentElement!).outlineWidth).toBe("2px");
    expect(ring("Q3", "B")).toBe("none");
  });
});

/**
 * Scrolls to Q4's option C, then to Q5's card, and to Q5's last option: Q4's header shows at the
 * top while its card is on screen, then leaves with it, and Q5's takes its place (SC-001).
 */
async function headerStays() {
  await showRound("round-layout-look", Q4);

  checkbox("Q4", "C").parentElement!.scrollIntoView({ block: "start" });
  await drawn();
  expect(seen(titleOf("Q4"))).toBe(true);
  expect(titleOf("Q4").getBoundingClientRect().top).toBeLessThan(window.innerHeight / 4);

  card("Q5").scrollIntoView({ block: "start" });
  await drawn();
  expect(seen(titleOf("Q4"))).toBe(false);
  expect(seen(titleOf("Q5"))).toBe(true);

  checkbox("Q5", "C").parentElement!.scrollIntoView({ block: "start" });
  await drawn();
  expect(seen(titleOf("Q5"))).toBe(true);
  expect(titleOf("Q5").getBoundingClientRect().top).toBeLessThan(window.innerHeight / 4);
}

describe("the question's header on the desktop", () => {
  atSize("desktop");

  test("Q4's header stays at the top, then leaves with its card", headerStays);
});

describe("the question's header half a screen wide", () => {
  atSize("semi");

  test("Q4's header stays at the top, then leaves with its card", headerStays);
});

describe("question cards on the phone", () => {
  atSize("phone");

  test("Q4's header stays at the top, then leaves with its card", headerStays);

  test("on the phone, option A's points are boxes at its edge", async () => {
    await showRound("round-merge-chats", MERGE_Q1);
    const option = checkbox("Q1", "A").parentElement!;
    const top = option.getBoundingClientRect().top;

    // Its letter and "★ Recommended" sit in its top border.
    for (const text of ["A", "★ Recommended"]) {
      const box = within(option).getByText(text).getBoundingClientRect();
      expect(box.top, text).toBeLessThan(top);
      expect(box.bottom, text).toBeGreaterThan(top);
    }
    // Its sentence starts at most 11 px from the screen's edge (SC-004).
    const sentence = within(option).getByText(/^The agent offers the upgrade/);
    expect(sentence.getBoundingClientRect().left).toBeLessThanOrEqual(11);
    // Each pro, con, and why is a box at the option's text's edge, its sign in its top border, its
    // text at its inner edge, not after its sign.
    const points: Array<[string, RegExp]> = [
      ["+", /^one click, and nothing starts without you/],
      ["−", /^the agent waits for your click/],
      ["★", /^Why recommended/],
    ];
    for (const [sign, text] of points) {
      const words = within(option).getByText(text);
      const box = bordered(words);
      const edge = box.getBoundingClientRect();
      expect(edge.left, sign).toBeLessThanOrEqual(11);
      expect(edge.right, sign).toBeLessThan(option.getBoundingClientRect().right);
      const mark = within(box as HTMLElement)
        .getByText(sign)
        .getBoundingClientRect();
      expect(mark.top, sign).toBeLessThan(edge.top);
      expect(mark.bottom, sign).toBeGreaterThan(edge.top);
      expect(words.getBoundingClientRect().left - edge.left, sign).toBeLessThanOrEqual(11);
    }
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  });

  test("a picked option's border is twice its neighbour's, in the accent, its text in place", async () => {
    await showRound("round-merge-chats", MERGE_Q1);
    const sentence = () => within(optionOf("Q1", "B")).getByText(/^The agent upgrades by itself/);
    const before = sentence().getBoundingClientRect().left;

    await userEvent.click(optionOf("Q1", "B"));
    await expect.poll(() => (checkbox("Q1", "B") as HTMLInputElement).checked).toBe(true);
    await drawn();

    const width = (letter: string) =>
      Number.parseFloat(getComputedStyle(optionOf("Q1", letter)).borderInlineStartWidth);
    expect(width("B")).toBe(2 * width("C"));
    const picked = within(optionOf("Q1", "B")).getByText("picked");
    expect(getComputedStyle(optionOf("Q1", "B")).borderTopColor).toBe(
      getComputedStyle(picked).color,
    );
    expect(sentence().getBoundingClientRect().left).toBeCloseTo(before, 1);
    expect(sentence().getBoundingClientRect().left).toBeLessThanOrEqual(11);
  });

  test("a follow-up on the phone has a top border, no side line", async () => {
    await showRound("round-merge-chats", MERGE_Q1, (round) =>
      round.replace(
        /(## Q2:[\s\S]*?)\*\*Answer:\*\*\n/,
        (_, before: string) => `${before}**Answer:** A\n`,
      ),
    );
    await expect.poll(() => document.getElementById("Q2.A")).toBeTruthy();
    await drawn();
    const head = within(card("Q2.A")).getByText("Q2.A · follows Q2, because you picked A");

    // From its card's box to the follow-up's own, before its parent's group: no line on a side,
    // and a border on top, above its header.
    const boxes: Array<Element> = [card("Q2.A").firstElementChild!];
    for (
      let at: Element | null = card("Q2.A");
      at && !at.contains(card("Q2"));
      at = at.parentElement
    ) {
      boxes.push(at);
    }
    for (const box of boxes) {
      expect(getComputedStyle(box).borderInlineStartWidth).toBe("0px");
    }
    const tops = boxes.filter((box) => getComputedStyle(box).borderTopWidth !== "0px");
    expect(tops.length).toBeGreaterThan(0);
    const line = getComputedStyle(tops[0]!);
    expect(line.borderTopColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(tops[0]!.getBoundingClientRect().top).toBeLessThanOrEqual(
      head.getBoundingClientRect().top,
    );
  });
});
