// US5 and approval comment C3: the New page's three cards side by side on wide screens and stacked
// on the phone, without their examples, the picked kind's form after them; each fact's value on its
// label's line, right beside it. The page passes the UI checks at both sizes, in light and dark.
import { screen, within } from "@testing-library/react";
import { describe, expect, test } from "vite-plus/test";
import { atSize, checkLayout, colorScheme, drawn, show } from "./helpers.tsx";

atSize("both");

const KINDS = ["Session", "Change", "Feature"];

/** A kind's card, in the group of cards. */
function card(kind: string) {
  const group = screen.getByRole("radiogroup", { name: "What to start" });
  return within(group).getByRole("radio", { name: kind });
}

/** The boxes of the lines an element's words are drawn on, its icons left out. */
function lines(element: Element) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  const words = walker.nextNode()!;
  range.setStart(words, 0);
  let last = words;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    last = node;
  }
  range.setEnd(last, last.textContent!.length);
  return [...range.getClientRects()];
}

/** The width of two characters in an element's font: the room C3 leaves between label and value. */
function twoCh(element: Element) {
  const probe = document.createElement("span");
  probe.textContent = "00";
  probe.style.font = getComputedStyle(element).font;
  probe.style.position = "absolute";
  document.body.append(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return width;
}

// C3: "right now 'Ends with' is 10km from the text".
test("C3: each fact's value sits on its label's line, beside it", async () => {
  await show("/new?kind=feature", "Waits on you");

  for (const kind of KINDS) {
    const labels = within(card(kind)).getAllByRole("term");
    const values = within(card(kind)).getAllByRole("definition");
    expect(labels).toHaveLength(2);
    labels.forEach((label, index) => {
      // The label's end, and the value's start.
      const labelText = lines(label).at(-1)!;
      const valueText = lines(values[index])[0];
      const name = `${kind}: ${label.textContent}`;
      // On the label's line: the lines' middles within half a line.
      expect(
        Math.abs((labelText.top + labelText.bottom) / 2 - (valueText.top + valueText.bottom) / 2),
        name,
      ).toBeLessThan(labelText.height / 2);
      // Right after the label: within two characters of its end.
      const gap = valueText.left - labelText.right;
      expect(gap, name).toBeGreaterThanOrEqual(0);
      expect(gap, name).toBeLessThanOrEqual(twoCh(label));
    });
  }
});

describe("on the phone", () => {
  atSize("phone");

  // US5 more 1
  test("US5 more 1: on the phone, the cards stack, without their examples, the form after them", async () => {
    await show("/new?kind=change", "Waits on you");
    await screen.findByRole("textbox", { name: "Message Claude Code" });
    await drawn();

    const boxes = KINDS.map((kind) => card(kind).getBoundingClientRect());
    for (let index = 1; index < boxes.length; index += 1) {
      expect(boxes[index].top).toBeGreaterThanOrEqual(boxes[index - 1].bottom);
      expect(boxes[index].left).toBe(boxes[0].left);
    }
    for (const example of [
      "“Why is CI slow?”",
      "“Fix the due-date typo”",
      "“Add recurring tasks”",
    ]) {
      expect(screen.queryByText(example)).toBeNull();
    }
    const composer = screen.getByRole("textbox", { name: "Message Claude Code" });
    expect(composer.getBoundingClientRect().top).toBeGreaterThanOrEqual(boxes[2].bottom);
  });
});

describe("on the desktop", () => {
  atSize("desktop");

  // US5: three cards side by side, with their examples.
  test("the cards stand side by side, with their examples, the form under them", async () => {
    await show("/new?kind=change", "Waits on you");
    await screen.findByRole("textbox", { name: "Message Claude Code" });
    await drawn();

    const boxes = KINDS.map((kind) => card(kind).getBoundingClientRect());
    for (let index = 1; index < boxes.length; index += 1) {
      expect(boxes[index].left).toBeGreaterThanOrEqual(boxes[index - 1].right);
      expect(boxes[index].top).toBe(boxes[0].top);
      expect(boxes[index].height).toBe(boxes[0].height);
    }
    expect(within(card("Change")).getByText("“Fix the due-date typo”")).toBeTruthy();
    const composer = screen.getByRole("textbox", { name: "Message Claude Code" });
    expect(composer.getBoundingClientRect().top).toBeGreaterThanOrEqual(boxes[0].bottom);
  });
});

const MODES = (["light", "dark"] as const).map((mode) => ({ mode }));

// The UI checks on New, Feature picked.
test.each(MODES)("New, Feature picked, in $mode", async ({ mode }) => {
  await colorScheme(mode);
  await show("/new?kind=feature", "Write the proposal");
  expect(document.documentElement.getAttribute("data-theme")).toBe(mode);
  await drawn();
  await checkLayout();
});
