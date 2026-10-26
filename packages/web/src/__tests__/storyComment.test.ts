// The text of a comment on a story, and its form's anchor, as the spec writes them: the story by its
// file's name and export, then the element picked in it.
import { expect, test } from "vite-plus/test";
import { type Picked, storyAnchor, storyComment } from "../storyComment.ts";

const STORY = { export: "Dragging", path: "packages/web/src/SidebarHandle.stories.tsx" };
const LABEL = "Dragging the handle";
const LONG = "This unnamed element holds a text longer than forty characters.";
/** `LONG`'s first 40 characters, with the space the cut ends on dropped. */
const SNIPPET = "This unnamed element holds a text longer";

const cases: Array<{ anchor: string; comment: string; picked?: Picked; what: string }> = [
  {
    anchor: `Comment on ${LABEL}`,
    comment: "Story SidebarHandle.stories.tsx#Dragging: Too slow.",
    what: "no element picked: the story alone",
  },
  {
    anchor: `Comment on ${LABEL}, button “Hide the sidebar”`,
    comment: "Story SidebarHandle.stories.tsx#Dragging, button “Hide the sidebar”: Too slow.",
    picked: { name: "Hide the sidebar", role: "button" },
    what: "a named element, whose frame's width is not told",
  },
  {
    anchor: `Comment on ${LABEL}, desktop, button “Hide the sidebar”`,
    comment:
      "Story SidebarHandle.stories.tsx#Dragging, desktop, button “Hide the sidebar”: Too slow.",
    picked: { name: "Hide the sidebar", role: "button", width: "desktop" },
    what: "a named element, picked in the desktop's frame",
  },
  {
    anchor: `Comment on ${LABEL}, phone, separator`,
    comment: "Story SidebarHandle.stories.tsx#Dragging, phone, separator: Too slow.",
    picked: { name: "", role: "separator", width: "phone" },
    what: "an element with no name and no text, picked in the phone's frame",
  },
  {
    anchor: `Comment on ${LABEL}, link with “Read more”`,
    comment: "Story SidebarHandle.stories.tsx#Dragging, link with “Read more”: Too slow.",
    picked: { name: "", role: "link", text: "Read more" },
    what: "an unnamed element, told by its text",
  },
  {
    anchor: `Comment on ${LABEL}, button “Save”`,
    comment: "Story SidebarHandle.stories.tsx#Dragging, button “Save”: Too slow.",
    picked: { name: "Save", role: "button", text: "Save changes" },
    what: "a named element, whose text is not told",
  },
  {
    anchor: `Comment on ${LABEL}, group with “${SNIPPET}…”`,
    comment: `Story SidebarHandle.stories.tsx#Dragging, group with “${SNIPPET}…”: Too slow.`,
    picked: { name: "", role: "group", text: LONG },
    what: "an unnamed element whose text is over 40 characters: a snippet of 40, trimmed, then …",
  },
  {
    anchor: `Comment on ${LABEL}, group with “${"x".repeat(40)}”`,
    comment: `Story SidebarHandle.stories.tsx#Dragging, group with “${"x".repeat(40)}”: Too slow.`,
    picked: { name: "", role: "group", text: "x".repeat(40) },
    what: "an unnamed element whose text is exactly 40 characters: all of it",
  },
];

test.each(cases)("a comment on $what is written as the spec says", ({ comment, picked }) => {
  expect(storyComment(STORY, picked, "Too slow.")).toBe(comment);
});

test.each(cases)(
  "the form's anchor for $what is written as the spec says",
  ({ anchor, picked }) => {
    expect(storyAnchor(LABEL, picked)).toBe(anchor);
  },
);
