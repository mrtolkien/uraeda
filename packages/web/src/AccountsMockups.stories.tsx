// The mockups of several Claude Code accounts (`specs/2026-11-10-multi-accounts/spec.md`): the
// usage of each account on Home, with its week, and in the sidebar, its five hours alone, an
// account signed out, an account whose week is used up, and a session's header naming its account.
// The stories render the real components over fixed records, with no server.
import type { Meta, StoryObj } from "@storybook/react-vite";
import * as stylex from "@stylexjs/stylex";
import { UsageBody } from "./home/Usage.tsx";
import { Pane } from "./layout/Pane.tsx";
import type { Runtime } from "./runtimes.ts";
import { AllowancePane } from "./sidebar/Allowance.tsx";
import { SessionHeader } from "./SessionHeader.tsx";

const styles = stylex.create({
  // Home's pane, at a widget's width: a pane's least, 400 px.
  home: { maxWidth: "var(--size-pane-min)" },
  // The sidebar's column, 240 px, which the settings' search field also measures.
  sidebar: { maxWidth: "var(--size-settings-search)" },
});

/** A reset at `hours` from now, in ISO 8601. */
const inHours = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();

type Window = Runtime["usage"][number];
type Account = Runtime["accounts"][number];

const five = (used: number, hours: number): Window => ({
  id: "five_hour",
  label: "5h",
  resetsAt: inHours(hours),
  used,
});
const week = (used: number, hours: number): Window => ({
  id: "seven_day",
  label: "Week",
  resetsAt: inHours(hours),
  used,
});

/** An account signed in, with its windows. */
const ready = (name: string, windows: Array<Window>, isNext = false): Account => ({
  id: `/home/gary/.claude-${name}`,
  isNext,
  name,
  state: "ready",
  windows,
});

/** An account signed out, which reads no usage. */
const signedOut = (name: string): Account => ({
  id: `/home/gary/.claude-${name}`,
  isNext: false,
  name,
  state: "signed-out",
  windows: [],
});

/** A runtime's record, as the server gives it. */
const runtime = (
  kind: string,
  name: string,
  accounts: Array<Account>,
  usage: Array<Window>,
): Runtime => ({
  accounts,
  available: true,
  capabilities: {
    approvals: true,
    images: true,
    queue: true,
    steer: false,
    subagents: true,
    takeBack: false,
  },
  icon: "",
  isOn: true,
  kind,
  models: null,
  name,
  title: name,
  usage,
  version: null,
});

/** Codex's one login, under the accounts, as today. */
const CODEX = runtime("codex", "Codex", [], [five(0.25, 3), week(0.4, 100)]);

/** Three accounts: one in use, one fresh, one with its five hours nearly gone. */
const THREE = runtime(
  "claude",
  "Claude Code",
  [
    ready("default", [five(0.42, 2.5), week(0.34, 80)], true),
    ready("b", [five(0, 5), week(0.12, 120)]),
    ready("c", [five(0.88, 1), week(0.61, 30)]),
  ],
  [],
);

/** The same, b signed out and c's week used up. */
const NEEDING_YOU = runtime(
  "claude",
  "Claude Code",
  [
    ready("default", [five(0.42, 2.5), week(0.34, 80)], true),
    signedOut("b"),
    ready("c", [five(0.2, 4), week(1, 30)]),
  ],
  [],
);

const meta = { title: "Mockups/Accounts" } satisfies Meta;

export default meta;

/** Home's Usage pane over fixed records: Claude Code's accounts, then Codex's one login. */
function Home({ claude }: { claude: Runtime }) {
  return (
    <div {...stylex.props(styles.home)}>
      <Pane level={3} title="Usage">
        <UsageBody runtimes={[claude, CODEX]} />
      </Pane>
    </div>
  );
}

/** The sidebar's Usage pane over the same records. */
function Sidebar({ claude }: { claude: Runtime }) {
  return (
    <div {...stylex.props(styles.sidebar)}>
      <AllowancePane runtimes={[claude, CODEX]} />
    </div>
  );
}

/** Home's Usage pane with three accounts listed, then Codex's one login. */
export const HomeThreeAccounts: StoryObj = { render: () => <Home claude={THREE} /> };

/** Home's pane with b signed out, and c's week used up. */
export const HomeNeedingYou: StoryObj = { render: () => <Home claude={NEEDING_YOU} /> };

/** The sidebar's Usage pane with three accounts: one line each, and no week. */
export const SidebarThreeAccounts: StoryObj = { render: () => <Sidebar claude={THREE} /> };

/** The sidebar's pane with b signed out; c, its week used up, reads as any other. */
export const SidebarNeedingYou: StoryObj = { render: () => <Sidebar claude={NEEDING_YOU} /> };

/** A session's header: its account after its agent, before its model and effort. */
export const SessionOnAccount: StoryObj = {
  render: () => (
    <SessionHeader
      account="b"
      agent="claude"
      place="multi-accounts"
      runsOn="Opus 5.5 · High"
      title="Build the plan"
    />
  ),
};
