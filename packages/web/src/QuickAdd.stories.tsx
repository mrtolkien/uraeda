// The ＋ forms of the priorities and the inbox, with Add, the primary button and Enter's, which
// adds the line uncommitted, for the commit page's Commit. A dialog on wide screens, a sheet on
// narrow ones, over the fixture repository's real priorities and inbox, through fate.
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { userEvent, within } from "storybook/test";
import { AddNote } from "./AddNote.tsx";
import { useWorkspace } from "./data.ts";
import { dropUnsaved } from "./fields/unsaved.ts";
import { Overlay } from "./layout/Overlay.tsx";
import { AddForm } from "./QuickAdd.tsx";
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
function ProposalForm() {
  return (
    <Overlay
      isOpen
      label="New proposal"
      onClose={() => {}}
      size={{ width: "var(--size-quick-add)" }}
    >
      <AddForm onAdded={() => {}} onCancel={() => {}} />
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
      size={{ width: "var(--size-quick-add)" }}
    >
      <AddNote
        closes={() => {}}
        images={[]}
        onAdded={() => {}}
        picked={{ add: () => {}, clear: () => {}, remove: () => {} }}
      />
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
  // Before each story and as it leaves: Proposal and Note type a line, which the others must not
  // restore.
  beforeEach: () => {
    forgetTyped();
    return forgetTyped;
  },
  component: ProposalForm,
  decorators: [inRepositoryFolder],
  title: "Quick add",
} satisfies Meta<typeof ProposalForm>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * "New proposal": a proposal typed, the section, Next by default, then Cancel and Add. The line is
 * typed as the human would, so Add shows enabled.
 */
export const Proposal: Story = {
  play: async () => {
    // The dialog draws outside the story's root, at the end of the page.
    const field = await within(document.body).findByRole("textbox", { name: "Proposal" });
    await userEvent.type(field, "Weekly digest of the agents' runs");
  },
};

/** "New note": the inbox's form, with the same Add, a note typed. */
export const Note: Story = {
  play: async () => {
    const field = await within(document.body).findByPlaceholderText("What did you notice?");
    await userEvent.type(field, "The inbox count is hard to read in dark mode");
  },
  render: () => <NoteForm />,
};
