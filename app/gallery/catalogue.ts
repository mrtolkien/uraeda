// The gallery's catalogue, as plain data: its groups, each a place of the layout shell reached
// from the rail and by `g` then its key, and each group's pages, each a pane, the main stack's
// tabs. `pages.tsx` gives each page its view; the pictures' test reads this alone, as it runs
// where the app's native module is not.
import type { IconName } from "../ui/controls";

export type PageEntry = {
  /** Draws to its pane's edges, and fills it: a scene, which scrolls itself. */
  fills?: boolean;
  icon: IconName;
  /** Its picture's name, and its pane's kind after `gallery-`. */
  name: string;
  /** A text it shows once drawn: what the pictures' test waits for. */
  shows: string;
  title: string;
};

export type GroupEntry = {
  icon: IconName;
  /** The second key of its sequence: `g` then this. */
  key: string;
  label: string;
  name: string;
  /** Its pages; the panes group shows the layout shell's sample panes in their place. */
  pages: ReadonlyArray<PageEntry>;
};

export const CATALOGUE: ReadonlyArray<GroupEntry> = [
  {
    icon: "layers",
    key: "s",
    label: "Surfaces",
    name: "surfaces",
    pages: [
      { icon: "layers", name: "heights", shows: "overlay", title: "Heights" },
      { icon: "square", name: "states", shows: "With the focus", title: "States" },
      { icon: "triangle-alert", name: "dialog", shows: "Delete task 27?", title: "Dialog" },
      {
        icon: "shield",
        name: "confirm",
        shows: "Push 3 commits to origin/main?",
        title: "Confirmation",
      },
      {
        icon: "trash-2",
        name: "discard",
        shows: "Discard the changes to README.md?",
        title: "Confirmation that loses",
      },
      { icon: "rows-3", name: "sheet", shows: "Outline", title: "Sheet" },
      { icon: "chevron-down", name: "popover", shows: "Codex", title: "Popover" },
      { icon: "bell", name: "toasts", shows: "Landing in git", title: "Toasts" },
      { icon: "space", name: "corner", shows: "Keyboard shortcuts", title: "Corner" },
      { icon: "info", name: "tip", shows: "Send", title: "Tip" },
      { icon: "globe", name: "web", shows: "A page that does not load", title: "Web frame" },
    ],
  },
  {
    icon: "component",
    key: "c",
    label: "Controls",
    name: "controls",
    pages: [
      { icon: "mouse-pointer-click", name: "buttons", shows: "Approve", title: "Buttons" },
      { icon: "list-checks", name: "choices", shows: "Night", title: "Choices" },
      { icon: "chevron-down", name: "select", shows: "Claude Code", title: "Select" },
      { icon: "menu", name: "menu", shows: "Copy its path", title: "Menu" },
      { icon: "file-text", name: "words", shows: "Importing sessions", title: "Words" },
      { icon: "palette", name: "icons", shows: "file-text", title: "Icons" },
    ],
  },
  {
    icon: "list",
    key: "l",
    label: "Lists",
    name: "lists",
    pages: [
      { icon: "list", name: "rows", shows: "Priorities", title: "Rows" },
      { icon: "layout-template", name: "cards", shows: "Clean merged branches", title: "Cards" },
      { icon: "columns-3", name: "table", shows: "Work · Claude Max", title: "Tables" },
      { icon: "grip-vertical", name: "order", shows: "Scheduled jobs", title: "Order" },
    ],
  },
  {
    icon: "text-cursor-input",
    key: "t",
    label: "Text",
    name: "text",
    pages: [{ icon: "text-cursor-input", name: "fields", shows: "Vim's modes", title: "Fields" }],
  },
  {
    icon: "book-open",
    key: "d",
    label: "Documents",
    name: "document",
    pages: [
      { icon: "file-text", name: "spec", shows: "Recurring tasks", title: "spec.md" },
      { icon: "workflow", name: "diagrams", shows: "could not be drawn", title: "Diagrams" },
      { icon: "message-square", name: "reply", shows: "Step 1", title: "A reply" },
      { icon: "git-compare", name: "diff", shows: "doneAt", title: "A diff" },
    ],
  },
  {
    icon: "keyboard",
    key: "k",
    label: "Keys",
    name: "keys",
    pages: [{ icon: "keyboard", name: "keys", shows: "What the registry opens", title: "Keys" }],
  },
  {
    icon: "layout-panel-left",
    key: "p",
    label: "Panes",
    name: "panes",
    pages: [],
  },
  {
    icon: "gauge",
    key: "x",
    label: "Scenes",
    name: "scenes",
    pages: [
      {
        fills: true,
        icon: "message-square",
        name: "streaming",
        shows: "one app now",
        title: "Streaming",
      },
      { fills: true, icon: "chevrons-down", name: "scrolling", shows: "Read", title: "Scrolling" },
      { fills: true, icon: "layers", name: "glass", shows: "working", title: "Glass over it" },
      {
        fills: true,
        icon: "file-text",
        name: "reading",
        shows: "The part number",
        title: "Reading",
      },
    ],
  },
];
