// The ＋ forms with "Add and commit", mockups of the redesign of the priorities and the inbox (Q8):
// beside Add, the primary button and Enter's, which commits that file alone; when the file had
// other changes, it only adds, and says so in the form. A dialog on wide screens, a sheet on narrow
// ones, over the fixture repository's real priorities and inbox, through fate.
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { userEvent, within } from "storybook/test";
import { AddNote } from "./AddNote.tsx";
import { useWorkspace } from "./data.ts";
import { dropUnsaved } from "./fields/unsaved.ts";
import { Overlay } from "./layout/Overlay.tsx";
import { AddForm, type CommitNotice, uncommitted } from "./QuickAdd.tsx";
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
function PriorityForm({ notice }: { notice?: CommitNotice }) {
  return (
    <Overlay isOpen label="New priority" onClose={() => {}} width="var(--size-quick-add)">
      <AddForm notice={notice} onAdded={() => {}} onCancel={() => {}} />
    </Overlay>
  );
}

/** The inbox's ＋ form, open, with the same buttons: its text, its Category, then the buttons. */
function NoteForm() {
  return (
    <Overlay
      isOpen
      label="Add a note"
      onClose={() => {}}
      sheetHeight="hug"
      width="var(--size-quick-add)"
    >
      <AddNote onAdded={() => {}} onCancel={() => {}} onImage={() => {}} />
    </Overlay>
  );
}

/** Forgets the lines typed in the forms: each story opens its form as it shows, not restored. */
function forgetTyped() {
  let keys: Array<string>;
  try {
    keys = Object.keys(window.localStorage);
  } catch {
    // No storage, as in Uraeda's sandboxed frames: nothing typed was kept to forget.
    return;
  }
  for (const key of keys) {
    if (key.startsWith("uraeda:unsaved:") && /:(quick-add|inbox-add(#category)?)$/.test(key)) {
      dropUnsaved(key);
    }
  }
}

const meta = {
  // Before each story and as it leaves: Priority and Note type a line, which the others must not
  // restore.
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

/** "New note": the inbox's form, with the same two buttons, a note typed. */
export const Note: Story = {
  play: async () => {
    const field = await within(document.body).findByPlaceholderText("What did you notice?");
    await userEvent.type(field, "The inbox count is hard to read in dark mode");
  },
  render: () => <NoteForm />,
};

/**
 * After "Add and commit", when `PRIORITIES.md` had other uncommitted changes: the line is added,
 * not committed, and the form says so where the human looks, staying open, its field emptied.
 */
export const NotCommitted: Story = {
  args: { notice: uncommitted({ committed: false, reason: "other-changes" }, "Next") },
};
