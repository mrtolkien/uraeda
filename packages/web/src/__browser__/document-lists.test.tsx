// US1 more scenario 3 and SC-004, in WebKit: on the phone, a document's list hangs its marker in the
// page's margin, its first-level text on the paragraphs' left edge, and a nested list one character
// in; on the desktop, the marker stays in the text's column. Shown in a round, in its block and in
// its context, the lists every document draws through the same component, beside the paragraph of
// its Scope: the round's panes keep one text edge. On the phone, too, every marker, a number past 9
// or a task's box, stays whole on the screen and on its item's first line, on the round's page and
// on the spec's tighter one (R11).
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
        "> - Two choices last beyond this feature.\n",
        "> - Two choices last beyond this feature.\n>   - Nested under the block's item.\n",
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
    item: "Two choices last beyond this feature.",
    nested: "Nested under the block's item.",
    paragraph: "The human steps, and how the phone reaches the server.",
    where: "block",
  },
  {
    item: "The proposal, and the stack decision.",
    nested: "Nested under the sources.",
    paragraph: "The human steps, and how the phone reaches the server.",
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

/** A wrapping item, a task, and an ordered list past 9, with a typed sign and a task in it. */
const MARKED = `
- [ ] A task to check before the round.
- A source whose text runs long enough to wrap on the phone, over several lines, so that a marker
  centred on the row instead of its first line would sit well below that line, far from its start.

8. Eighth, a plain number.
9. [pro] Ninth, with its sign.
10. [ ] Tenth, a task.
`;

/** The wrapping item's text, as drawn: on one line in the file's text, it would be too long. */
const LONG =
  "A source whose text runs long enough to wrap on the phone, over several lines, so that a marker centred on the row instead of its first line would sit well below that line, far from its start.";

/** The round's Sources and the spec's Assumptions, each followed by the marked lists. */
const PAGES = [
  {
    after: "  - Nested under the sources.\n",
    branch: FEATURE,
    file: FILE,
    fixture: `repo/branches/${FEATURE}/${FILE}`,
    path: PAGE,
    text: FIRST,
    where: "round",
  },
  {
    after: "- The title parser knows English phrases only, at the end of the title.\n",
    branch: "2026-10-17-spec-page",
    file: "specs/2026-10-17-spec-page/spec.md",
    fixture: "spec-page/branch/specs/2026-10-17-spec-page/spec.md",
    path: "/f/2026-10-17-spec-page/spec.md",
    text: "Complete a repeating task",
    where: "spec",
  },
];

/** A page, its list followed by the marked lists. */
async function markedPage({ after, branch, file, fixture, path, text }: (typeof PAGES)[number]) {
  let source = await commands.fixtureText(fixture);
  if (!fixture.startsWith("repo/")) {
    await commands.addSpecFeature();
  } else {
    source = source.replace(
      "- The proposal, and the stack decision.\n",
      "- The proposal, and the stack decision.\n  - Nested under the sources.\n",
    );
  }
  expect(source).toContain(after);
  await commands.commitOnBranch(branch, { [file]: source.replace(after, `${after}${MARKED}`) });
  await show(path, text);
  await drawn();
}

/** The boxes of a marker's own glyphs, in an item's row: where its text, not its element, is drawn. */
function glyphs(marker: string, item: string) {
  const row = screen.getByText(item).closest("li")!;
  const element = [...row.querySelectorAll("span")].find(
    (span) => span.textContent === marker && span.closest("li") === row,
  );
  expect(element, `the marker ${marker} of "${item}"`).toBeTruthy();
  return [...element!.childNodes].flatMap((text) => {
    const range = document.createRange();
    range.selectNodeContents(text);
    return [...range.getClientRects()].filter((box) => box.width > 0);
  });
}

/** The first line's box of an item's text. */
function firstLine(text: string) {
  const range = document.createRange();
  range.selectNodeContents(screen.getByText(text));
  return range.getClientRects()[0]!;
}

describe("markers on the phone", () => {
  atSize("phone");

  test.each(PAGES)(
    "on the phone, every marker's glyphs stay on the screen, on one line, before the text, on the $where page",
    async (page) => {
      await markedPage(page);

      for (const [marker, item] of [
        ["☐", "A task to check before the round."],
        ["-", LONG],
        ["8.", "Eighth, a plain number."],
        ["9.", "Ninth, with its sign."],
        ["10.", "Tenth, a task."],
        ["☐", "Tenth, a task."],
      ] as const) {
        const boxes = glyphs(marker, item);
        const left = Math.min(...boxes.map((box) => box.left));
        expect(left, `${marker} of "${item}"`).toBeGreaterThanOrEqual(0);
        expect(
          new Set(boxes.map((box) => Math.round(box.top))).size,
          `${marker} of "${item}", its lines`,
        ).toBe(1);
        expect(Math.max(...boxes.map((box) => box.right))).toBeLessThanOrEqual(
          textLeft(item) + 0.5,
        );
      }
    },
  );

  test.each(PAGES)(
    "on the phone, a wrapping item's marker sits on its first line, on the $where page",
    async (page) => {
      await markedPage(page);

      const line = firstLine(LONG);
      expect(screen.getByText(LONG).getBoundingClientRect().height).toBeGreaterThan(
        line.height * 2,
      );
      const [dash] = glyphs("-", LONG);
      const middle = (dash!.top + dash!.bottom) / 2;
      expect(middle).toBeGreaterThanOrEqual(line.top);
      expect(middle).toBeLessThanOrEqual(line.bottom);
    },
  );
});

describe("typed signs in ordered lists", () => {
  atSize("both");

  test("an ordered item keeps its typed sign and its task's box, after its number", async () => {
    await markedPage(PAGES[0]!);

    for (const [sign, item] of [
      ["+", "Ninth, with its sign."],
      ["☐", "Tenth, a task."],
    ] as const) {
      const [box] = glyphs(sign, item);
      expect(box!.right).toBeLessThanOrEqual(textLeft(item) + 0.5);
    }
  });
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

describe("a plan's lists on the phone", () => {
  atSize("phone");

  test("a marker hung before its text never sits on its pane's border", async () => {
    const folder = "2026-10-13-plan-review";
    const plan = await commands.fixtureText("plan-page/plan.md");
    await commands.commitOnBranch(folder, { [`specs/${folder}/plan.md`]: plan });
    await show(`/f/${folder}/plan.md`, "Global constraints");
    await drawn();

    const item =
      '"The UI MUST adapt to three width classes, narrow, semi-wide, and wide, not to the device, through the theme and never per-view media queries."';
    const pane = screen.getByRole("region", { name: "Global constraints" });
    const border = Number.parseFloat(getComputedStyle(pane).borderLeftWidth);
    const inside = pane.getBoundingClientRect().left + border;
    const left = Math.min(...glyphs("-", item).map((box) => box.left));
    // Drawn left of a side border, it would cross it; with none, it hangs in the page's margin.
    expect(
      border === 0 || left >= inside - 0.5,
      `the marker at ${left}, the border's inner edge at ${inside}`,
    ).toBe(true);
  });
});
