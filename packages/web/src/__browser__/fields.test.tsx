// US6 and SC-005: every multi-line field has the fixed height of its kind, at both sizes, empty and
// full, measured against its own line height and padding: the editor 20 rows, the notes 12, every
// comment and the review's summary 7, the chat composer 4, quick add 3. Past it, the field scrolls,
// and the page's layout never moves as the human types; the resize handle still drags it taller.
import { screen, within } from "@testing-library/react";
import { describe, expect, test } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { atSize, drawn, show } from "./helpers.tsx";

const ROUND = "/f/2026-10-11-web-ui/clarifications-01.md";
const QUESTION = "How does your iPhone reach the server?";
const SETTLED = "The actions' commits move into the core";
const SPEC = "/f/2026-10-06-recurring-tasks/spec.md";

/** Numbered lines of text, one a line. */
const lines = (count: number) =>
  Array.from({ length: count }, (_, index) => `Line ${index + 1}`).join("\n");

/** A length in px from a computed style. */
const pixels = (value: string) => Number.parseFloat(value);

/** An element's line height in px: a unitless one is a multiple of its font size. */
function lineHeight(element: Element) {
  const style = getComputedStyle(element);
  return style.lineHeight.endsWith("px")
    ? pixels(style.lineHeight)
    : Number.parseFloat(style.lineHeight) * pixels(style.fontSize);
}

/** How many of its own lines a field shows: its inner height, padding off, over its line height. */
function rows(field: Element, text: Element = field) {
  const style = getComputedStyle(field);
  const inner = field.clientHeight - pixels(style.paddingTop) - pixels(style.paddingBottom);
  return inner / lineHeight(text);
}

/** A text area by its label, in the page or in an overlay. */
const area = (label: string, root: HTMLElement = document.body) =>
  within(root).getByLabelText(label) as HTMLTextAreaElement;

/** The first question's comment field, not its follow-ups'. */
const questionComment = () =>
  within(document.getElementById("Q1")!).getAllByRole("textbox", {
    name: "Comment, or your own answer instead of a letter",
  })[0] as HTMLTextAreaElement;

/**
 * Checks a field is `count` rows tall empty, with one line, and with 30 lines, scrolling then
 * (SC-005, US6 2).
 */
async function checkRows(field: HTMLTextAreaElement, count: number) {
  await userEvent.fill(field, "");
  await drawn();
  expect(rows(field)).toBeCloseTo(count, 1);
  await userEvent.fill(field, "One line");
  await drawn();
  expect(rows(field)).toBeCloseTo(count, 1);
  await userEvent.fill(field, lines(30));
  await drawn();
  expect(rows(field)).toBeCloseTo(count, 1);
  expect(field.scrollHeight).toBeGreaterThan(field.clientHeight);
}

/** Taps a block of the review, opening its comment form: a sheet on the phone. */
async function commentOn(phrase: string) {
  const block = screen
    .getAllByRole("button", { name: (name) => name.includes(phrase) })
    .find((b) => b.hasAttribute("aria-pressed")) as HTMLElement;
  await userEvent.click(block, { force: true });
  return (await screen.findAllByLabelText("Comment text"))[0] as HTMLTextAreaElement;
}

/** The fixture's settled point, under "Under the hood", opened first. */
async function settledPoint() {
  await userEvent.click(await screen.findByRole("button", { name: /^Show the \d+ points$/ }), {
    force: true,
  });
  return screen.findByRole("button", { name: new RegExp(`^${SETTLED}`) });
}

test("a round's comments are 7 rows and its notes 12, empty or full (US6 1, 2, 4)", async () => {
  await show(ROUND, QUESTION);
  await checkRows(questionComment(), 7);
  await checkRows(area("Anything else"), 12);

  const point = await settledPoint();
  await userEvent.click(point, { force: true });
  await checkRows((await screen.findAllByLabelText("Comment text"))[0] as HTMLTextAreaElement, 7);
});

// The "Unsaved changes" status shows at the first letter typed: its line is kept for it, so the
// content further down, the next question, stays where it was with the field empty (R28).
test("the content below a comment does not move as 12 lines are typed (US6 3)", async () => {
  await show(ROUND, QUESTION);
  const field = questionComment();
  const save = within(document.getElementById("Q1")!).getByRole("button", { name: "Save comment" });
  const below = document.getElementById("Q2")!;
  const from = (element: Element) =>
    element.getBoundingClientRect().top - field.getBoundingClientRect().top;
  const empty = { below: from(below), height: field.clientHeight, save: from(save) };

  await userEvent.click(field);
  await userEvent.keyboard("L");
  await drawn();
  expect(screen.getByText("Unsaved changes")).toBeTruthy();
  expect(from(below)).toBe(empty.below);
  await userEvent.keyboard("ine 1{Enter}");
  for (const line of lines(12).split("\n").slice(1)) {
    await userEvent.keyboard(`${line}{Enter}`);
  }
  await drawn();

  expect(field.value.split("\n")).toHaveLength(13);
  expect(field.scrollHeight).toBeGreaterThan(field.clientHeight);
  expect({ below: from(below), height: field.clientHeight, save: from(save) }).toEqual(empty);
});

// A comment form's "Unsaved changes" has its line kept too: on the phone, it wraps over the
// form's buttons (R28). A settled point's form and a review's, with its Add image.
test.each([
  [
    "a settled point's",
    async () => {
      await show(ROUND, QUESTION);
      const point = await settledPoint();
      await userEvent.click(point, { force: true });
      return (await screen.findAllByLabelText("Comment text"))[0] as HTMLTextAreaElement;
    },
  ],
  [
    "a review's",
    async () => {
      await show(SPEC, "Complete a repeating task");
      return commentOn("a repeat menu offers");
    },
  ],
])(
  "%s comment form keeps its buttons and its end in place at the first letter (US6 3)",
  async (_, open) => {
    const field = await open();
    const form = field.closest("form")!;
    const buttons = within(form).getAllByRole("button");
    // Where each button, and the form's end, are from the field's top left corner.
    const at = () => {
      const corner = field.getBoundingClientRect();
      return {
        buttons: buttons.map((button) => {
          const box = button.getBoundingClientRect();
          return [box.left - corner.left, box.top - corner.top];
        }),
        end: form.getBoundingClientRect().bottom - corner.top,
      };
    };
    await drawn();
    const empty = at();

    await userEvent.click(field);
    await userEvent.keyboard("L");
    await drawn();

    expect(within(form).getByText("Unsaved changes")).toBeTruthy();
    expect(at()).toEqual(empty);
  },
);

test("a review's comment and its summary are 7 rows, empty or full (US6 1, 2)", async () => {
  await show(SPEC, "Complete a repeating task");
  await checkRows(await commentOn("a repeat menu offers"), 7);
  await checkRows(area("Summary"), 7);
});

test("the editor is 20 rows, whatever its text (US6 5)", async () => {
  await show("/edit/specs/drafts/git-listener.md", "Git listener");
  await userEvent.click(screen.getByRole("button", { name: "Edit" }));
  await checkRows((await screen.findByLabelText("Text")) as HTMLTextAreaElement, 20);
});

test("quick add's field is 3 rows (US6 6)", async () => {
  await show("/priorities", "Git listener process");
  // The sidebar's ＋, in the phone's drawer, opened from its menu first.
  if (window.innerWidth < 768) {
    await userEvent.click(screen.getByRole("button", { name: "Open navigation" }));
  }
  await userEvent.click(await screen.findByRole("button", { name: "Add to the priorities" }));
  const overlay = await screen.findByRole("dialog", { name: "New priority" });
  await checkRows(area("Priority", overlay), 3);
});

test("the chat composer is 7 rows, grows upward to 20, and scrolls past them (US6 7)", async () => {
  await show("/f/2026-10-12-cli-tuis/session", "CLI TUIs");
  const input = await screen.findByRole("textbox", { name: "Message Claude Code" });
  // The field is the composer's input as a whole, of its own text's rows: its editable region
  // holds the text and scrolls inside it.
  const field = input.parentElement!;
  await drawn();
  expect(rows(field, input)).toBeCloseTo(7, 1);
  // It grows upward: the composer is held at the window's bottom once the transcript fills it.
  let docked: HTMLElement | null = field;
  while (docked && getComputedStyle(docked).position !== "sticky") {
    docked = docked.parentElement;
  }
  expect(docked && getComputedStyle(docked).bottom).toBe("0px");

  await userEvent.fill(input, lines(12));
  await drawn();
  expect(rows(field, input)).toBeCloseTo(12, 1);

  await userEvent.fill(input, lines(30));
  await drawn();
  expect(input.textContent).toContain("Line 30");
  expect(rows(field, input)).toBeCloseTo(20, 1);
  // The text scrolls inside the field, never past its edge.
  expect(input.getBoundingClientRect().bottom).toBeLessThanOrEqual(
    field.getBoundingClientRect().bottom,
  );
  expect(input.scrollHeight).toBeGreaterThan(input.clientHeight);
});

// A resize handle is dragged with a mouse: the desktop's.
describe("on the desktop", () => {
  atSize("desktop");

  // The browser's resize handle cannot be dragged from the tests: WebKit ignores Playwright's mouse on
  // it (R28). Its handle is checked to be there, and a height set as dragging it does to be kept.
  test("a comment keeps its resize handle, and a height dragged while typing (US6 8)", async () => {
    await show(ROUND, QUESTION);
    const field = questionComment();
    expect(getComputedStyle(field).resize).toBe("vertical");
    const before = field.getBoundingClientRect().height;

    // What dragging the handle down 100 px does: the field's own height, set on it.
    field.style.height = `${before + 100}px`;
    await drawn();
    const dragged = field.getBoundingClientRect().height;
    expect(dragged).toBeGreaterThan(before + 50);

    await userEvent.click(field);
    await userEvent.keyboard("Taller");
    await drawn();
    expect(field.value).toBe("Taller");
    expect(field.getBoundingClientRect().height).toBe(dragged);
  });
});

// The mockup's sections 1 and 6: on a wide screen, a multi-line field's Save says its key beside it,
// as a line's does; the phone, with no such key, shows nothing.
test("Ctrl+Enter saves shows beside a comment's, the notes', and the editor's Save on a wide screen", async () => {
  const shown = window.innerWidth >= 768 ? 1 : 0;
  await show(ROUND, QUESTION);
  expect(within(document.getElementById("Q1")!).queryAllByText("Ctrl+Enter saves")).toHaveLength(
    shown,
  );
  // Each question's comment, and the notes.
  expect(screen.queryAllByText("Ctrl+Enter saves").length).toBe(
    shown * (screen.getAllByRole("button", { name: "Save comment" }).length + 1),
  );
  await show("/edit/specs/drafts/git-listener.md", "Git listener");
  await userEvent.click(screen.getByRole("button", { name: "Edit" }));
  await screen.findByLabelText("Text");
  expect(screen.queryAllByText("Ctrl+Enter saves")).toHaveLength(shown);
});
