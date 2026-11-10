// The mockups of several Claude Code accounts (`specs/2026-11-10-multi-accounts/spec.md`): the
// usage of each account on Home and in the sidebar, an account signed out, an account whose week
// is used up, and a session's header naming its account. Built from the real components over fixed
// values, with no server: the stories show the look, and the panes' data is the server's once
// built.
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import type { Meta, StoryObj } from "@storybook/react-vite";
import * as stylex from "@stylexjs/stylex";
import { HarnessMark } from "./HarnessMark.tsx";
import { Pane } from "./layout/Pane.tsx";
import { SessionHeader } from "./SessionHeader.tsx";
import { UsageWindow, type Window } from "./UsageWindow.tsx";

const styles = stylex.create({
  body: {
    paddingBlockEnd: spacingVars["--spacing-2"],
    paddingBlockStart: spacingVars["--spacing-1"],
    paddingInline: spacingVars["--spacing-2"],
  },
  // Home's pane, at a widget's width: a pane's least, 400 px.
  home: { maxWidth: "var(--size-pane-min)" },
  // The sidebar's column, 240 px, which the settings' search field also measures.
  sidebar: { maxWidth: "var(--size-settings-search)" },
});

/** A reset at `hours` from now, in ISO 8601. */
const inHours = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();

/** An account of the mockups: its name, and its windows, none when it is signed out. */
type Account = { name: string; week?: Window; window?: Window };

const five = (used: number, hours: number): Window => ({
  label: "5h",
  resetsAt: inHours(hours),
  used,
});
const week = (used: number, hours: number): Window => ({
  label: "Week",
  resetsAt: inHours(hours),
  used,
});

/** Three accounts: one in use, one fresh, one with its five hours nearly gone. */
const THREE: ReadonlyArray<Account> = [
  { name: "default", week: week(0.34, 80), window: five(0.42, 2.5) },
  { name: "b", week: week(0.12, 120), window: five(0, 5) },
  { name: "c", week: week(0.61, 30), window: five(0.88, 1) },
];

/** The same, b signed out and c's week used up. */
const NEEDING_YOU: ReadonlyArray<Account> = [
  THREE[0]!,
  { name: "b" },
  { name: "c", week: week(1, 30), window: five(0.2, 4) },
];

/** Codex's one login, under the accounts, as today. */
const CODEX: ReadonlyArray<Window> = [five(0.25, 3), week(0.4, 100)];

/** A line of text beside the harness's mark, as a window's line has it. */
function MarkLine({ children, kind }: { children: string; kind: string }) {
  return (
    <HStack align="center" gap={2}>
      <HarnessMark isDecorative kind={kind} />
      <Text color="secondary" type="supporting">
        {children}
      </Text>
    </HStack>
  );
}

/** Home's pane: each account's name, then its five hours and its week. */
function HomeUsage({ accounts }: { accounts: ReadonlyArray<Account> }) {
  return (
    <Pane level={3} title="Usage" xstyle={[styles.home]}>
      <VStack gap={4} xstyle={styles.body}>
        {accounts.map(({ name, week: weekly, window }) => (
          <VStack gap={2} key={name}>
            <Text type="supporting" weight="semibold">
              {window ? name : `${name} · signed out`}
            </Text>
            {window && <UsageWindow kind="claude" window={window} />}
            {weekly && <UsageWindow kind="claude" window={weekly} />}
          </VStack>
        ))}
        <VStack gap={2}>
          {CODEX.map((window) => (
            <UsageWindow key={window.label} kind="codex" window={window} />
          ))}
        </VStack>
      </VStack>
    </Pane>
  );
}

/**
 * The sidebar's pane: one line per account, its five hours, or its week once the week is used up,
 * which is why no session starts on it.
 */
function SidebarUsage({ accounts }: { accounts: ReadonlyArray<Account> }) {
  return (
    <Pane isGroup title="Usage" xstyle={[styles.sidebar]}>
      <VStack gap={2} xstyle={styles.body}>
        {accounts.map(({ name, week: weekly, window }) => {
          if (!window) {
            return (
              <MarkLine key={name} kind="claude">
                {`${name} signed out`}
              </MarkLine>
            );
          }
          const shown = weekly && weekly.used >= 1 ? weekly : window;
          return (
            <UsageWindow
              isCompact
              key={name}
              kind="claude"
              window={{ ...shown, label: `${name} ${shown.label}` }}
            />
          );
        })}
        {CODEX.map((window) => (
          <UsageWindow isCompact key={window.label} kind="codex" window={window} />
        ))}
      </VStack>
    </Pane>
  );
}

const meta = { title: "Mockups/Accounts" } satisfies Meta;

export default meta;

/** Home's Usage pane with three accounts listed, then Codex's one login. */
export const HomeThreeAccounts: StoryObj = { render: () => <HomeUsage accounts={THREE} /> };

/** Home's pane with b signed out, and c's week used up. */
export const HomeNeedingYou: StoryObj = { render: () => <HomeUsage accounts={NEEDING_YOU} /> };

/** The sidebar's Usage pane with three accounts: one line each. */
export const SidebarThreeAccounts: StoryObj = {
  render: () => <SidebarUsage accounts={THREE} />,
};

/** The sidebar's pane with b signed out, and c's week used up. */
export const SidebarNeedingYou: StoryObj = {
  render: () => <SidebarUsage accounts={NEEDING_YOU} />,
};

/** A session's header: its account after its agent, before its model and effort. */
export const SessionOnAccount: StoryObj = {
  render: () => (
    <SessionHeader
      agent="claude"
      place="multi-accounts"
      runsOn="b · Opus 5.5 · High"
      title="Build the plan"
    />
  ),
};
