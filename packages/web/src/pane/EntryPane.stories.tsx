// The entry pane: a priority's detail, read-only on arrival, Edit in its bar. Over the
// fixture repository's real priorities (see `.storybook/fixture.ts`), through fate, in
// the detail overlay over the real page: a dialog on wide screens, a bottom sheet on the phone.
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { type ReactNode, useEffect } from "react";
import { userEvent, within } from "storybook/test";
import { usePriorities, useWorkspace } from "../data.ts";
import { PrioritiesPage } from "../PrioritiesPage.tsx";
import { dropUnsaved, unsavedKey } from "../fields/unsaved.ts";
import { RepositoryPathContext, useRepositoryPath } from "../routes.tsx";
import { DetailOverlay } from "./DetailOverlay.tsx";
import { PriorityPane } from "./PriorityPane.tsx";

/** The page, with the detail in its overlay over it, as a click on a card opens it. */
function Over({ label, list, pane }: { label: string; list: ReactNode; pane: ReactNode }) {
  return (
    <>
      {list}
      <DetailOverlay label={label} onClose={() => {}}>
        {pane}
      </DetailOverlay>
    </>
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
    <Over label="Priority" list={<PrioritiesPage />} pane={<PriorityPane entryKey={entry.key} />} />
  );
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
 * The detail overlay over the priorities page: a dialog of 108 characters and 60% of the window
 * tall over the dimmed columns, a bottom sheet on the phone, with Close, Previous and Next.
 */
export const Overlay: Story = { args: { text: "Git listener process" } };

/** The same at 390 px: a sheet from the bottom edge, with its Close at the top, over the stacked panes. */
export const OverlayPhone: Story = {
  args: { text: "Git listener process" },
  globals: { viewport: { isRotated: false, value: "phone" } },
  parameters: {
    viewport: {
      options: {
        phone: { name: "Phone", styles: { height: "844px", width: "390px" }, type: "mobile" },
      },
    },
  },
};

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
  play: async () => {
    // The overlay is drawn outside the canvas, in the top layer.
    const pane = within(await within(document.body).findByRole("dialog"));
    await userEvent.click(await pane.findByRole("button", { name: "Edit" }));
    const line = await pane.findByRole("textbox", { name: "Line" });
    await userEvent.clear(line);
    await userEvent.type(line, "Git listener process, polling every minute");
  },
};

/** A Now priority whose feature is started: Running in green, its step, and Open the feature. */
export const Running: Story = { args: { text: "Recurring tasks" } };
