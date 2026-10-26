// A comment on a story joins the question's answer on a line of its own: the saved comment, then
// the line, and the unsaved text gets the line after it too, so saving it later keeps the line (R36).
import { expect, test } from "vite-plus/test";
import { savedWithLine, unsavedWithLine } from "../useAnswer.ts";

const LINE = "Story SidebarHandle.stories.tsx#Grip, desktop, separator: Thicker grip.";

test.each([
  { expected: `B: Keep it visible.\n${LINE}`, saved: "B: Keep it visible.", what: "a comment" },
  {
    expected: `B: Keep it visible.\n${LINE}`,
    saved: "B: Keep it visible.\n\n  ",
    what: "a comment ending in blank lines",
  },
  { expected: LINE, saved: "", what: "no comment" },
  { expected: LINE, saved: " \n ", what: "a comment of only spaces" },
])("the answer saves with $what, then the line", ({ expected, saved }) => {
  expect(savedWithLine(saved, LINE)).toBe(expected);
});

test.each([
  {
    expected: `Keep it visible. Not sent yet.\n${LINE}`,
    unsaved: "Keep it visible. Not sent yet.",
    what: "text",
  },
  {
    expected: `Keep it visible. Not sent yet.\n${LINE}`,
    unsaved: "Keep it visible. Not sent yet. \n\n",
    what: "text ending in spaces and line breaks",
  },
])("the unsaved comment of $what gets the line after it", ({ expected, unsaved }) => {
  expect(unsavedWithLine(unsaved, LINE)).toBe(expected);
});
