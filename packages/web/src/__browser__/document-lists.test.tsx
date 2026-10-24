// US1 more scenario 3 and SC-004, in WebKit: on the phone, a document's list hangs its marker in the
// page's margin, its first-level text on the paragraphs' left edge, and a nested list one character
// in; on the desktop, the marker stays in the text's column. Shown in a round, in its block and in
// its context, the lists every document draws through the same component.
import { screen } from "@testing-library/react";
import { describe, expect, test } from "vite-plus/test";
import { atSize, commands, drawn, show } from "./helpers.tsx";

const FEATURE = "2026-10-11-web-ui";
const PAGE = `/f/${FEATURE}/clarifications-01.md`;
const FILE = `specs/${FEATURE}/clarifications-01.md`;
const FIRST = "How does your iPhone reach the server?";

/** The round, with a nested item in its block's list and in its Sources' list, on its branch. */
async function nestedRound() {
  const round = await commands.fixtureText(`repo/branches/${FEATURE}/${FILE}`);
  await commands.commitOnBranch(FEATURE, {
    [FILE]: round
      .replace(
        "> - Verdict: worth building as proposed.\n",
        "> - Verdict: worth building as proposed.\n>   - Nested under the verdict.\n",
      )
      .replace(
        "- The proposal, and the stack decision.\n",
        "- The proposal, and the stack decision.\n  - Nested under the sources.\n",
      ),
  });
  await show(PAGE, FIRST);
  await drawn();
}

/** Where a text starts on the screen: its first line's left edge, not its box's. */
function textLeft(text: string) {
  const element = screen.getByText(text);
  const range = document.createRange();
  range.selectNodeContents(element);
  return range.getClientRects()[0]!.left;
}

/** The width of one character in the font a text is drawn in: what `1ch` is to it. */
function characterWidth(text: string) {
  const context = document.createElement("canvas").getContext("2d")!;
  context.font = getComputedStyle(screen.getByText(text)).font;
  return context.measureText("0").width;
}

/** The marker drawn before an item's text: the drawn part of its row left of the text. */
function markerOf(text: string) {
  const item = screen.getByText(text).closest("li")!;
  const left = textLeft(text);
  const marker = [...item.querySelectorAll("*")]
    .map((element) => element.getBoundingClientRect())
    .find((box) => box.width > 0 && box.height > 0 && box.right <= left + 0.5);
  expect(marker).toBeTruthy();
  return marker!;
}

/** The lists the test reads: the block's and the context's, each beside a paragraph. */
const LISTS = [
  {
    item: "Verdict: worth building as proposed.",
    nested: "Nested under the verdict.",
    paragraph: "3 questions and 1 follow-up on the web UI, about 35 minutes.",
    where: "block",
  },
  {
    item: "The proposal, and the stack decision.",
    nested: "Nested under the sources.",
    paragraph: "Every human step happens in a text editor.",
    where: "context",
  },
];

describe("lists on the phone", () => {
  atSize("phone");

  test.each(LISTS)(
    "on the phone, a list's text starts at the paragraphs' edge, in the $where (SC-004)",
    async ({ item, nested, paragraph }) => {
      await nestedRound();

      expect(Math.abs(textLeft(item) - textLeft(paragraph))).toBeLessThanOrEqual(1);
      // Its marker hangs before it, in the page's margin, still on the screen.
      const marker = markerOf(item);
      expect(marker.right).toBeLessThanOrEqual(textLeft(item));
      expect(marker.left).toBeGreaterThanOrEqual(0);
      // A nested item's text starts one character right of its parent's.
      expect(
        Math.abs(textLeft(nested) - textLeft(item) - characterWidth(nested)),
      ).toBeLessThanOrEqual(1);
      expect(markerOf(nested).right).toBeLessThanOrEqual(textLeft(nested));
    },
  );
});

describe("lists on the desktop", () => {
  atSize("desktop");

  test.each(LISTS)(
    "on the desktop, a list's marker stays in its column, in the $where",
    async ({ item, paragraph }) => {
      await nestedRound();

      expect(markerOf(item).left).toBeGreaterThanOrEqual(textLeft(paragraph) - 0.5);
      expect(textLeft(item)).toBeGreaterThan(textLeft(paragraph));
    },
  );
});
