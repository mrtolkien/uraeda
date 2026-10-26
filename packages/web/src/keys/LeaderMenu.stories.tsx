// The leader menu, as the leader-key spec's mockups: open at the top level, and open in the New
// group after Space then `n`, over the shell around the home (see `.storybook/fixture.ts`). On the
// phone's frame it spans the window's width.
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { inRepositoryFolder } from "../../.storybook/inRepositoryFolder.tsx";
import { Home } from "../Home.tsx";
import { Shell } from "../Shell.tsx";
import { LeaderMenu, type MenuEntry } from "./LeaderMenu.tsx";

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
  { key: "space", label: "Find anything…" },
  { key: "h", label: "Home" },
  { key: "i", label: "Inbox" },
  { key: "p", label: "Priorities" },
  { key: "d", label: "Decisions" },
  { key: "s", label: "Sessions" },
  { key: ",", label: "Settings" },
  { isGroup: true, key: "n", label: "new" },
  { isGroup: true, key: "f", label: "find" },
  { isGroup: true, key: "u", label: "ui" },
  { key: "r", label: "Switch repository…" },
];

const NEW: ReadonlyArray<MenuEntry> = [
  { key: "s", label: "Session" },
  { key: "c", label: "Change" },
  { key: "f", label: "Feature" },
  { key: "n", label: "Note (inbox entry)" },
  { key: "p", label: "Priority" },
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
  args: { children: <LeaderMenu entries={TOP} path={[]} /> },
};

/** Space then `n`: the New group, titled `Space n`. */
export const NewGroup: Story = {
  args: { children: <LeaderMenu entries={NEW} path={["n"]} /> },
};
