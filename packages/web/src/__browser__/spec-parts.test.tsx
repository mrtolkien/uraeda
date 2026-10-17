// The parts after the stories, as WebKit draws them (US8): the architecture's units side by side on
// a wide screen, and the data model's changes as green, yellow, and red pills.
import { screen, within } from "@testing-library/react";
import { describe, expect, test } from "vite-plus/test";
import {
  atSize,
  checkAccessibility,
  checkAlignment,
  checkMeasure,
  checkPage,
  checkTextSizes,
  commands,
  show,
} from "./helpers.tsx";

const FOLDER = "2026-10-17-spec-page";
const PAGE = `/f/${FOLDER}/spec.md`;

/** A data model with one field of each change. */
const DATA = `# Data model: Recurring tasks

## Task

| Field     | Type     | Meaning                  | Change  |
| --------- | -------- | ------------------------ | ------- |
| \`title\`   | text     | what the task is         |         |
| \`dueDate\` | day      | the day it is due        | Changed |
| \`repeat\`  | rule     | how it comes back        | New     |
| \`done\`    | yes, no  | whether it is done       | Removed |
`;

/**
 * The layout decision's checks on parts of the page, by their titles: their own text and boxes. The
 * page's other parts, and its controls, are checked whole by the spec page's tests.
 */
async function checkParts(names: ReadonlyArray<string>) {
  for (const name of names) {
    const part = screen.getByRole("region", { name });
    checkPage(part);
    checkTextSizes(part);
    checkMeasure(part);
    checkAlignment(part);
  }
  await checkAccessibility();
}

/** The units' cards of the architecture. */
function units() {
  const part = screen.getByRole("region", { name: "Architecture" });
  return within(within(part).getByRole("list", { name: "Units" })).getAllByRole("listitem");
}

/** The colour behind an element: its own, or that of the nearest box around it that has one. */
function background(element: Element | null): string {
  for (let at = element; at; at = at.parentElement) {
    const colour = getComputedStyle(at).backgroundColor;
    if (colour !== "rgba(0, 0, 0, 0)" && colour !== "transparent") {
      return colour;
    }
  }
  return "";
}

/** A colour's red, green, and blue. */
function channels(colour: string) {
  const [red = 0, green = 0, blue = 0] = (colour.match(/[\d.]+/g) ?? []).map(Number);
  return { blue, green, red };
}

describe("on the desktop", () => {
  atSize("desktop");

  test("the units are three small cards side by side (US8 3)", async () => {
    await commands.addSpecFeature();
    await show(PAGE, "Date helpers");

    const cards = units().map((unit) => unit.getBoundingClientRect());
    expect(cards).toHaveLength(3);
    for (const card of cards) {
      expect(card.top).toBeCloseTo(cards[0]!.top, 0);
    }
    expect(cards[0]!.right).toBeLessThanOrEqual(cards[1]!.left);
    expect(cards[1]!.right).toBeLessThanOrEqual(cards[2]!.left);
    await checkParts(["Architecture", "Edge cases", "Success criteria"]);
  });

  test("the data model's changes are green, yellow, and red pills (US8 more 2)", async () => {
    await commands.addSpecFeature();
    await commands.commitOnBranch(FOLDER, { [`specs/${FOLDER}/data-model.md`]: DATA });
    await show(PAGE, "whether it is done");

    const task = screen.getByRole("region", { name: "Task" });
    const cell = within(task).getByText("what the task is");
    const [created, changed, removed] = ["New", "Changed", "Removed"].map((change) =>
      channels(background(within(task).getByText(change))),
    );
    // Each pill has a colour of its own, apart from the table's.
    expect(
      new Set([created, changed, removed, channels(background(cell))].map((c) => JSON.stringify(c)))
        .size,
    ).toBe(4);
    expect(created!.green).toBeGreaterThan(created!.red);
    expect(removed!.red).toBeGreaterThan(removed!.green);
    expect(changed!.red).toBeGreaterThan(changed!.blue);
    expect(changed!.green).toBeGreaterThan(changed!.blue);
    await checkParts(["Task"]);
  });
});

describe("on the phone", () => {
  atSize("phone");

  test("the units stack, and the parts fit the screen", async () => {
    await commands.addSpecFeature();
    await show(PAGE, "Date helpers");

    const cards = units().map((unit) => unit.getBoundingClientRect());
    expect(cards[1]!.top).toBeGreaterThanOrEqual(cards[0]!.bottom);
    await checkParts(["Architecture", "Edge cases", "Success criteria", "Task"]);
  });
});
