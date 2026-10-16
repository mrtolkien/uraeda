// The entry pane: a priority's and a note's detail, read-only on arrival, Edit in its bar. Over the
// fixture repository's real priorities and inbox (see `.storybook/fixture.ts`), through fate;
// beside the real list on wide screens, the page itself on narrow ones.
import { borderVars, colorVars } from "@astryxdesign/core/theme/tokens.stylex";
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useEffect } from "react";
import { userEvent, within } from "storybook/test";
import { useInbox, usePriorities, useWorkspace } from "../data.ts";
import { InboxPage } from "../InboxPage.tsx";
import { useWidthClass } from "../layout/useWidthClass.ts";
import { PrioritiesPage } from "../PrioritiesPage.tsx";
import { dropUnsaved, unsavedKey } from "../fields/unsaved.ts";
import { RepositoryPathContext, useRepositoryPath } from "../routes.tsx";
import { NotePane } from "./NotePane.tsx";
import { PriorityPane } from "./PriorityPane.tsx";

const styles = stylex.create({
  list: { minWidth: 0 },
  pane: {
    borderInlineStartColor: colorVars["--color-border"],
    borderInlineStartStyle: "solid",
    borderInlineStartWidth: borderVars["--border-width"],
    boxSizing: "border-box",
    height: "var(--size-viewport-height)",
    overflowY: "auto",
    position: "sticky",
    top: 0,
  },
  panes: {
    alignItems: "start",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(var(--size-pane-min), 40%)",
  },
});

/** The pane beside its list on wide screens, as `Panes` lays it out; alone on narrow ones. */
function Beside({ list, pane }: { list: ReactNode; pane: ReactNode }) {
  if (useWidthClass() !== "wide") {
    return <>{pane}</>;
  }
  return (
    <div {...stylex.props(styles.panes)}>
      <div {...stylex.props(styles.list)}>{list}</div>
      <section {...stylex.props(styles.pane)} aria-label="Detail">
        {pane}
      </section>
    </div>
  );
}

/**
 * A priority's pane, found by its text in the fixture's `PRIORITIES.md`. What a story types in its
 * line is forgotten as the story leaves, so another never finds it restored.
 */
function Priority({ text }: { text: string }) {
  const entry = usePriorities()
    ?.sections.flatMap((section) => section.entries)
    .find((one) => one.text.includes(text));
  const field = unsavedKey(useRepositoryPath(), `priorities#${entry?.key}`);
  useEffect(() => () => dropUnsaved(field), [field]);
  if (!entry) {
    return null;
  }
  return (
    <Beside
      list={<PrioritiesPage />}
      pane={<PriorityPane entryKey={entry.key} onClose={() => {}} />}
    />
  );
}

/** A note's pane, found by its text in the fixture's `INBOX.md`. */
function InboxNote({ text }: { text: string }) {
  const note = useInbox()
    ?.categories.flatMap((category) => category.notes)
    .find((one) => one.text === text);
  if (!note) {
    return null;
  }
  return <Beside list={<InboxPage />} pane={<NotePane noteKey={note.key} onClose={() => {}} />} />;
}

/** The fixture's folder, as `App` sets it: what keeps the fields' unsaved text apart. */
function InRepositoryFolder({ children }: { children: ReactNode }) {
  const root = useWorkspace()?.root;
  return root === undefined ? null : (
    <RepositoryPathContext value={root}>{children}</RepositoryPathContext>
  );
}

const inRepositoryFolder: Decorator = (Story) => (
  <InRepositoryFolder>
    <Story />
  </InRepositoryFolder>
);

const meta = {
  component: Priority,
  decorators: [inRepositoryFolder],
  // The pane fills the frame, as in the app's main column.
  parameters: { layout: "fullscreen" },
  title: "Entry pane",
} satisfies Meta<typeof Priority>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * A drafted priority, as a click opens it: its text, its draft drawn with its slug and Start the
 * feature, its section, Delete, and its neighbours. Nothing has the focus.
 */
export const Reading: Story = { args: { text: "Git listener process" } };

/**
 * The same, after Edit: the one-line field in place, its text changed, so "Unsaved changes", and
 * the draft's text under it, with Save and Commit.
 */
export const Editing: Story = {
  args: { text: "Git listener process" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The pane beside the list on wide screens; the page itself on narrow ones.
    const detail = canvas.queryByRole("region", { name: "Detail" });
    const pane = detail ? within(detail) : canvas;
    await userEvent.click(await pane.findByRole("button", { name: "Edit" }));
    const line = await pane.findByRole("textbox", { name: "Line" });
    await userEvent.clear(line);
    await userEvent.type(line, "Git listener process, polling every minute");
  },
};

/** A Now priority whose feature is started: Running in green, its step, and Open the feature. */
export const Running: Story = { args: { text: "Recurring tasks" } };

/**
 * An inbox note, read-only, with its children under it: its category, Organize, Delete, and its
 * neighbours.
 */
export const Note: Story = {
  args: { text: "Icons are blurry on retina screens" },
  render: ({ text }) => <InboxNote text={text} />,
};
