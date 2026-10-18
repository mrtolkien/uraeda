// The round's cards, in WebKit: the two columns' ratio, the follow-up's joint and indent on a wide
// screen, its accent line on the phone, and the options' focus ring.
import { screen, within } from "@testing-library/react";
import { describe, expect, test } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { atSize, drawn, show } from "./helpers.tsx";

const FOLDER = "2026-10-11-web-ui";
const PAGE = `/f/${FOLDER}/clarifications-01.md`;
const FIRST = "How does your iPhone reach the server?";

/** A question's card, or its section on the phone. */
const card = (id: string) => document.getElementById(id)!;

/** The checkbox of a question's option, by its letter. */
const checkbox = (id: string, letter: string) =>
  within(card(id)).getByRole("checkbox", { name: new RegExp(String.raw`^Option ${letter}\b`) });

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

describe("question cards on the phone", () => {
  atSize("phone");

  test("a follow-up keeps a 4 px accent line on its side", async () => {
    await show(PAGE, FIRST);
    await askFollowUp();

    // The card's own border has no width: the accent is the first ancestor with one.
    let line: CSSStyleDeclaration | undefined;
    for (let at: Element | null = card("Q1.B"); at && !line; at = at.parentElement) {
      const style = getComputedStyle(at);
      line = style.borderInlineStartWidth === "0px" ? undefined : style;
    }

    expect(line?.borderInlineStartWidth).toBe("4px");
    expect(line?.borderInlineStartColor).not.toBe("rgba(0, 0, 0, 0)");
  });
});
