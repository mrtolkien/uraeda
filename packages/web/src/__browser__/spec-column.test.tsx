// Spec page US4 key 1, SC-005, Review focus 7, and the edge case "the column folded with ]": in
// WebKit, the spec's column is the questions page's, 480 px at 1440 px with Contents open (R5 of
// the plan's review comments, C3); switching its tabs moves no pane of the spec by a pixel; folded,
// the spec takes the room and a desktop live window's scale grows; and the spec with its column
// passes axe in both schemes.
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { COLUMN_KEY } from "../layout/documentColumnWidth.ts";
import {
  atSize,
  checkAccessibility,
  colorScheme,
  commands,
  drawn,
  LIVE,
  show,
} from "./helpers.tsx";

const FEATURE = "2026-10-17-spec-page";
const PAGE = `/f/${FEATURE}/spec.md`;
const STORY = "Repeat menu, open";
/** The panes whose boxes switching tabs must not move. */
const PANES = [
  "Spec to review, revision 2, about 10 minutes.",
  "Your review, answered",
  "Task storage",
  "US2 · Complete a repeating task",
];

/** The spec's column. */
const column = () => screen.getByRole("complementary", { name: "The spec's column" });

/** Where each pane is, and how wide, rounded to the pixel. */
function paneBoxes() {
  return PANES.map((name) => {
    const { left, top, width } = screen.getByRole("region", { name }).getBoundingClientRect();
    return `${name} ${Math.round(left)} ${Math.round(top)} ${Math.round(width)}`;
  });
}

/** The scale a live window's title says, in percent. */
function scaleOf(label: string) {
  const title = within(screen.getByRole("region", { name: `live · ${label}` })).getAllByRole(
    "heading",
  )[0]!.textContent;
  return Number(/(\d+)%/.exec(title ?? "")?.[1]);
}

beforeEach(() => {
  window.localStorage.removeItem(COLUMN_KEY);
});

describe("on the desktop", () => {
  atSize("desktop");

  test("at 1440 px the column is 480 px, Contents open (US4 key 1)", async () => {
    await commands.addSpecFeature();
    await show(PAGE, "Task storage");

    expect(Math.round(column().getBoundingClientRect().width)).toBe(480);
    const contents = within(column()).getByRole("tab", { name: "Contents" });
    expect(contents.getAttribute("aria-selected")).toBe("true");
    expect(within(column()).getByRole("tab", { name: "Review" })).toBeTruthy();
    // The part at the top is marked: the block's, before any scroll.
    const marked = within(within(column()).getByRole("list", { name: "Parts" }))
      .getAllByRole("listitem")
      .filter((row) => row.getAttribute("aria-current") === "true")
      .map((row) => row.textContent);
    expect(marked).toEqual(["What you approve"]);
  });

  test("switching tabs moves no part of the spec (SC-005)", async () => {
    await commands.addSpecFeature();
    await show(PAGE, "Task storage");
    const before = paneBoxes();

    for (const name of ["Review", "Contents", "Review"]) {
      await userEvent.click(within(column()).getByRole("tab", { name }));
      await drawn();
      expect(paneBoxes(), name).toEqual(before);
      expect(Math.round(column().getBoundingClientRect().width)).toBe(480);
    }
  });

  test("folded with ], a live window grows with the spec (Review focus 7)", async () => {
    await commands.addSpecFeature({ stories: true });
    await show(PAGE, "Recurring tasks");
    const live = screen.getByRole("region", { name: `live · ${STORY}` });
    live.scrollIntoView({ block: "center" });
    await expect.poll(() => scaleOf(STORY), LIVE).toBeGreaterThan(0);
    const before = scaleOf(STORY);

    // The keys reach the page once it has the focus, as after the human's first click in it.
    await userEvent.click(screen.getByRole("heading", { level: 1 }));
    await userEvent.keyboard("]");

    await expect.poll(() => scaleOf(STORY), LIVE).toBeGreaterThan(before);
    expect(screen.queryByRole("list", { name: "Parts" })).toBeNull();
  });
});

/** The boxes the status line shows: each control of the page's, and each count it shows. */
function lineParts() {
  const line = screen.getByRole("contentinfo", { name: "Status line" });
  const parts = [
    ...within(line).getAllByRole("button"),
    within(line).getByText(/need you/),
    within(line).getByText(/running/),
  ];
  return parts
    .filter((part) => getComputedStyle(part).visibility !== "hidden")
    .map((part) => ({ box: part.getBoundingClientRect(), text: part.textContent }));
}

/** Whether two boxes share any pixel. */
const overlap = (a: DOMRect, b: DOMRect) =>
  a.left < b.right - 0.5 &&
  b.left < a.right - 0.5 &&
  a.top < b.bottom - 0.5 &&
  b.top < a.bottom - 0.5;

describe("on the phone", () => {
  atSize("phone");

  test("the status line's controls and counts never cover each other (US1 key 3)", async () => {
    await commands.addSpecFeature();
    await show(PAGE, "Task storage");
    const line = screen.getByRole("contentinfo", { name: "Status line" });
    await within(line).findByRole("button", { name: "Verdict" });
    await expect.poll(() => line.textContent, LIVE).toMatch(/need you/);
    await drawn();

    const parts = lineParts();
    const covered = parts.flatMap((part, index) =>
      parts
        .slice(index + 1)
        .filter((other) => overlap(part.box, other.box))
        .map((other) => `${part.text} / ${other.text}`),
    );
    expect(covered).toEqual([]);
    const past = parts.filter(({ box }) => box.left < -0.5 || box.right > window.innerWidth + 0.5);
    expect(past.map(({ text }) => text)).toEqual([]);
  });
});

describe("accessibility", () => {
  atSize("both");

  test("the spec with its column passes axe in light and dark", async () => {
    await commands.addSpecFeature();
    await show(PAGE, "Task storage");
    for (const mode of ["light", "dark"] as const) {
      await colorScheme(mode);
      await drawn();
      await checkAccessibility();
    }
  });
});
