// The leader menu, as the leader-key spec's mockups: open at the top level, and open in the New
// group after Space then `n`, over the shell around the home (see `.storybook/fixture.ts`). On the
// phone's frame it spans the window's width.
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { inRepositoryFolder } from "../../.storybook/inRepositoryFolder.tsx";
import { DESTINATIONS } from "../destinations.ts";
import { Home } from "../Home.tsx";
import { Shell } from "../Shell.tsx";
import { LeaderMenu, type MenuEntry } from "./LeaderMenu.tsx";
import { KIND_ICONS } from "./kinds.ts";

/** The shell around the home, with the menu over it. */
function Over({ children }: { children: ReactNode }) {
  return (
    <>
      <Shell>
        <Home />
      </Shell>
      {children}
    </>
  );
}

const TOP: ReadonlyArray<MenuEntry> = [
  { icon: "search", key: "space", label: "Find anything…" },
  { icon: "uraeda:arrow-right", key: "c", label: "Continue" },
  { icon: DESTINATIONS.home.icon, key: "h", label: DESTINATIONS.home.label },
  { icon: DESTINATIONS.inbox.icon, key: "i", label: DESTINATIONS.inbox.label },
  { icon: DESTINATIONS.priorities.icon, key: "p", label: DESTINATIONS.priorities.label },
  { icon: DESTINATIONS.decisions.icon, key: "d", label: DESTINATIONS.decisions.label },
  { icon: DESTINATIONS.sessions.icon, key: "s", label: DESTINATIONS.sessions.label },
  { icon: DESTINATIONS.settings.icon, key: ",", label: DESTINATIONS.settings.label },
  { icon: "uraeda:plus", isGroup: true, key: "n", label: "New" },
  { icon: "search", isGroup: true, key: "f", label: "Find" },
  { icon: "uraeda:palette", isGroup: true, key: "u", label: "UI" },
  { icon: "uraeda:layers", key: "r", label: "Switch repository…" },
];

const NEW: ReadonlyArray<MenuEntry> = [
  { icon: KIND_ICONS.sessions, key: "s", label: "Session" },
  { icon: KIND_ICONS.changes, key: "c", label: "Change" },
  { icon: KIND_ICONS.features, key: "f", label: "Feature" },
  { icon: KIND_ICONS.notes, key: "n", label: "Note (inbox entry)" },
  { icon: KIND_ICONS.priorities, key: "p", label: "Proposal" },
];

const meta = {
  component: Over,
  decorators: [inRepositoryFolder],
  parameters: { layout: "fullscreen" },
  title: "Keys/Leader menu",
} satisfies Meta<typeof Over>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Space pressed, half a second ago: the top level, destinations first, then the groups. */
export const TopLevel: Story = {
  args: { children: <LeaderMenu entries={TOP} path={["Space"]} /> },
};

/** Space then `n`: the New group, titled `Space n`. */
export const NewGroup: Story = {
  args: { children: <LeaderMenu entries={NEW} path={["Space", "n"]} /> },
};
