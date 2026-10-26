// The key picker, as the leader-key spec's mockup: open over the decisions, "ui" typed, the first
// decision's file as raw markdown beside the list; and over every kind, each row labelled by its
// kind. Over the shell around the home (see `.storybook/fixture.ts`); on the phone's frame a sheet
// of the list alone.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { inRepositoryFolder } from "../../.storybook/inRepositoryFolder.tsx";
import { DESTINATIONS } from "../destinations.ts";
import { Home } from "../Home.tsx";
import { Shell } from "../Shell.tsx";
import { KeyPicker } from "./KeyPicker.tsx";
import type { PickerItem } from "./pickerSources.ts";

const UI_BEHAVIOUR = `---
status: active
approved-by: mrtolkien
icon: mouse-pointer-click
---

# UI behaviour

The web UI acts on things where they are, and never loses what the human typed or where they were.

## Rules

- Small edits MUST happen in place, and a dialog MUST only confirm an irreversible action or hold a
  short form. Checked by the UI tests.
`;

const ITEMS: ReadonlyArray<PickerItem> = [
  {
    icon: "uraeda:decision-mouse-pointer-click",
    id: "/decisions/ui-behaviour",
    kind: "decisions",
    path: "/decisions/ui-behaviour",
    preview: UI_BEHAVIOUR,
    title: "UI behaviour",
  },
  {
    icon: "uraeda:decision-file-text",
    id: "/decisions/ui-layout",
    kind: "decisions",
    path: "/decisions/ui-layout",
    preview: "---\nstatus: active\n---\n\n# UI layout\n",
    title: "UI layout",
  },
  {
    icon: "uraeda:step-proposal",
    id: "/f/2026-10-26-leader-key",
    kind: "features",
    path: "/f/2026-10-26-leader-key",
    preview: "# Leader key/shortcut map\n\n## What\n\nThe whole UI from the keyboard.\n",
    title: "Leader key/shortcut map",
  },
  {
    icon: DESTINATIONS.sessions.icon,
    id: "/sessions/1",
    kind: "sessions",
    path: "/sessions/1",
    preview: "Fix the status line\nNeeds you\nmain",
    title: "Fix the status line",
  },
  {
    icon: DESTINATIONS.inbox.icon,
    id: "/inbox/text-input-feels-laggy",
    kind: "notes",
    path: "/inbox/text-input-feels-laggy",
    preview: "Text input feels laggy on the sessions page",
    title: "Text input feels laggy on the sessions page",
  },
  {
    icon: DESTINATIONS.priorities.icon,
    id: "/priorities/nix-docker",
    kind: "priorities",
    path: "/priorities/nix-docker",
    preview: "- Nix + Docker based execution environments\n  - with a cache",
    title: "Nix + Docker based execution environments",
  },
];

/** The shell around the home, with the picker over it. */
function Over({
  items,
  showKinds,
  title,
}: {
  items: ReadonlyArray<PickerItem>;
  showKinds: boolean;
  title: string;
}) {
  return (
    <>
      <Shell>
        <Home />
      </Shell>
      <KeyPicker
        isOpen
        items={items}
        onClose={() => {}}
        onPick={() => {}}
        showKinds={showKinds}
        title={title}
      />
    </>
  );
}

const meta = {
  component: Over,
  decorators: [inRepositoryFolder],
  parameters: { layout: "fullscreen" },
  title: "Keys/Key picker",
} satisfies Meta<typeof Over>;

export default meta;

type Story = StoryObj<typeof meta>;

/** `Space f d`, then "ui": the decisions matching, the first selected, its file raw beside them. */
export const Decisions: Story = {
  args: {
    items: ITEMS.filter((item) => item.kind === "decisions"),
    showKinds: false,
    title: "Find decisions",
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.type(await body.findByRole("combobox", { name: "Find decisions" }), "ui");
  },
};

/** `Space Space`: every kind in one list, each row labelled by its kind. */
export const Everything: Story = {
  args: { items: ITEMS, showKinds: true, title: "Find anything" },
};
