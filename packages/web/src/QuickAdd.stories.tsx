// The ＋ forms with "Add and commit", mockups of the redesign of the priorities and the inbox (Q8):
// beside Add, the primary button and Enter's, which commits that file alone; when the file had
// other changes, it only adds, and says so in the form. A dialog on wide screens, a sheet on narrow
// ones, over the fixture repository's real priorities and inbox, through fate.
import { Selector } from "@astryxdesign/core/Selector";
import { VStack } from "@astryxdesign/core/VStack";
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { userEvent, within } from "storybook/test";
import { useInbox, useWorkspace } from "./data.ts";
import { TextField } from "./fields/TextField.tsx";
import { dropUnsaved } from "./fields/unsaved.ts";
import { Overlay } from "./layout/Overlay.tsx";
import { useWidthClass } from "./layout/useWidthClass.ts";
import { AddButtons, AddForm, notCommitted } from "./QuickAdd.tsx";
import { RepositoryPathContext } from "./routes.tsx";

/** The fixture's folder, as `App` sets it: what keeps the forms' unsaved text apart. */
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

/** The priorities' ＋ form, open, as the navigation's ＋ opens it. */
function PriorityForm({ notice }: { notice?: string }) {
  return (
    <Overlay isOpen label="New priority" onClose={() => {}}>
      <AddForm canCommit notice={notice} onAdded={() => {}} onCancel={() => {}} />
    </Overlay>
  );
}

/**
 * The inbox's ＋ form, open, with the same buttons: its text, its Category, then Cancel, Add, and
 * "Add and commit". TEMPORARY: drawn here from `AddNote`'s parts, which take `AddButtons` in the
 * redesign's implementation.
 */
function NoteForm() {
  const wide = useWidthClass() === "wide";
  const names = useInbox()?.names ?? [];
  return (
    <Overlay isOpen label="New note" onClose={() => {}} sheetHeight="hug">
      <VStack gap={4}>
        <TextField
          hasAutoFocus
          isLabelHidden
          kind="line"
          label="Note"
          placeholder="What did you notice?"
          value="The inbox count is hard to read in dark mode"
        />
        <Selector
          label="Category"
          options={[
            { label: "No category", value: "none" },
            ...names.map((one) => ({ label: one, value: `:${one}` })),
            { type: "divider" as const },
            { label: "New category…", value: "new" },
          ]}
          presentation={wide ? "popover" : "bottom-sheet"}
          value="none"
        />
        <AddButtons
          isReady
          onAdd={async () => {}}
          onAddAndCommit={async () => {}}
          onCancel={() => {}}
        />
      </VStack>
    </Overlay>
  );
}

/** Forgets the line typed in the priorities' form: each story opens it as it shows, not restored. */
function forgetTyped() {
  for (const key of Object.keys(window.localStorage)) {
    if (key.startsWith("uraeda:unsaved:") && key.endsWith(":quick-add")) {
      dropUnsaved(key);
    }
  }
}

const meta = {
  // Before each story and as it leaves: Priority types a line, which the others must not restore.
  beforeEach: () => {
    forgetTyped();
    return forgetTyped;
  },
  component: PriorityForm,
  decorators: [inRepositoryFolder],
  title: "Quick add",
} satisfies Meta<typeof PriorityForm>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * "New priority": a line typed, the section, Next by default, then Add and "Add and commit". The
 * line is typed as the human would, so the buttons show enabled.
 */
export const Priority: Story = {
  play: async () => {
    // The dialog draws outside the story's root, at the end of the page.
    const field = await within(document.body).findByRole("textbox", { name: "Priority" });
    await userEvent.type(field, "Weekly digest of the agents' runs");
  },
};

/** "New note": the inbox's form, with the same two buttons. */
export const Note: Story = { render: () => <NoteForm /> };

/**
 * After "Add and commit", when `PRIORITIES.md` had other uncommitted changes: the line is added,
 * not committed, and the form says so where the human looks, staying open, its field emptied.
 */
export const NotCommitted: Story = { args: { notice: notCommitted("next") } };
