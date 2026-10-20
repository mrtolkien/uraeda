// The sidebar, in the app's shell (`specs/done/2026-10-20-merge-chats.md`): the work that needs you
// first, then the inbox, the priorities, and one Sessions section, oldest started first, where a
// session, a change, and a feature share one card: one line of its icon, name, status, and "…", its
// icon telling its kind. A second line shows only while there is a task's progress or lines changed.
// The latest done items sit at the bottom. On the phone, the shell's top bar starts with the way
// home. Drawn from fixed props, with the real cards.
import { AppShell } from "@astryxdesign/core/AppShell";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import {
  SideNav,
  SideNavItem,
  SideNavSection,
  useSideNavCollapse,
} from "@astryxdesign/core/SideNav";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import type { Meta, StoryObj } from "@storybook/react-vite";
import * as stylex from "@stylexjs/stylex";
import { useRef, useState } from "react";
import { DoneArea, type DoneRow } from "./DoneArea.tsx";
import { type CardItem, ItemCard } from "./ItemCard.tsx";
import { SidebarHeading } from "./SidebarHeading.tsx";

const styles = stylex.create({
  page: {
    paddingBlock: spacingVars["--spacing-6"],
    paddingInline: spacingVars["--spacing-8"],
  },
});

const WORKING = { label: "Working", status: "working" } as const;
const IDLE = { label: "Idle", status: "idle" } as const;
const NEEDS = { label: "Needs you", status: "needs-you" } as const;

const NEEDS_YOU: Array<CardItem> = [
  {
    folder: "session-3",
    kind: "session",
    label: "Why does the login redirect twice?",
    status: NEEDS,
    title: "",
  },
  {
    folder: "2026-10-16-settings-page",
    kind: "feature",
    label: "settings-page",
    status: NEEDS,
    step: { kind: "questions", label: "Questions to answer" },
    title: "Settings page",
  },
];

/** Oldest started first: a session keeps its place when it becomes a change. */
const SESSIONS: Array<CardItem> = [
  {
    folder: "2026-10-17-look-and-feel",
    kind: "feature",
    label: "look-and-feel",
    status: WORKING,
    step: { kind: "discovery", label: "Discovery" },
    subagents: [{ description: "Research icon sets", id: "a1" }],
    title: "Look and feel pass",
  },
  {
    changes: { added: 42, removed: 9 },
    folder: "2026-10-18-flaky-tests",
    hasBackgroundCommand: true,
    kind: "change",
    label: "flaky-tests",
    status: WORKING,
    step: { kind: "change", label: "Change" },
    title: "Fix the flaky session tests",
  },
  { folder: "session-4", kind: "session", label: "Why is CI slow?", status: WORKING, title: "" },
  {
    changes: { added: 1050, removed: 250 },
    folder: "2026-10-19-redesign-interface",
    kind: "feature",
    label: "redesign-interface",
    progress: { position: 7, title: "Session column", total: 11 },
    status: WORKING,
    step: { kind: "implementation", label: "Implementation" },
    title: "Redesign sidebars and global interface",
  },
  {
    folder: "2026-10-19-tasks-reappear",
    kind: "change",
    label: "tasks-reappear",
    status: IDLE,
    step: { kind: "change", label: "Change" },
    title: "Done tasks reappear after a reload",
  },
  {
    folder: "session-5",
    kind: "session",
    label: "Explain the fate protocol's views",
    status: { label: "New reply", status: "unread" },
    title: "",
  },
];

/** The latest done items: sessions read to their end, and merged changes and features. */
const DONE: Array<DoneRow> = [
  { folder: "session-1", kind: "session" as const, label: "Rename the toolchain task" },
  { folder: "2026-10-20-session-transcript", label: "session-transcript" },
  { folder: "2026-10-20-ctrl-enter", label: "ctrl-enter" },
  { folder: "session-2", kind: "session" as const, label: "What does ura clean keep?" },
  { folder: "2026-10-20-inbox-noise", label: "inbox-noise" },
].map((row) => ({ ...row, href: "#", title: row.label }));

/** The repository menu's trigger, as the shell draws it. */
function Menu() {
  const { isCollapsed } = useSideNavCollapse();
  return isCollapsed ? (
    <IconButton icon={<Icon icon="chevronDown" />} label="Repositories, uraeda" variant="ghost" />
  ) : (
    <Button label="uraeda" variant="ghost" />
  );
}

/** A row of the flow, with its count and its ＋. */
function FlowRow({ add, count, label }: { add: string; count: number; label: string }) {
  return (
    <SideNavItem
      actions={
        <IconButton
          icon={<span aria-hidden="true">＋</span>}
          label={add}
          size="sm"
          variant="ghost"
        />
      }
      endContent={<Badge label={String(count)} variant="neutral" />}
      href="#"
      label={label}
    />
  );
}

/** The cards: a session's "…" lists its actions, a change's or a feature's opens its settings. */
function Cards({ items }: { items: Array<CardItem> }) {
  return items.map((item) =>
    item.kind === "session" ? (
      <ItemCard
        actions={[
          { label: "Rename", onClick: () => {} },
          { label: "Archive", onClick: () => {} },
        ]}
        href="#"
        item={item}
        key={item.folder}
      />
    ) : (
      <ItemCard href="#" item={item} key={item.folder} onSettings={() => {}} />
    ),
  );
}

/** The shell with the sidebar, beside a page. */
function SidebarMockup({
  isFolded = false,
  isRevealed = false,
  needsYou = NEEDS_YOU,
  sessions = SESSIONS,
}: {
  isFolded?: boolean;
  isRevealed?: boolean;
  needsYou?: Array<CardItem>;
  sessions?: Array<CardItem>;
}) {
  const [pointer, setPointer] = useState(false);
  const rows = useRef<HTMLDivElement>(null);
  return (
    <AppShell
      contentPadding={0}
      height="fill"
      sideNav={
        <SideNav
          collapsible={{ defaultIsCollapsed: isFolded, hasButton: false }}
          footer={<DoneArea allHref="#done" content={rows} rows={DONE} />}
          header={
            <SidebarHeading
              homeHref="#"
              isHome
              isRevealed={isRevealed || pointer}
              menu={<Menu />}
            />
          }
          resizable={{ defaultWidth: 280, maxWidth: 480, minWidth: 200 }}
        >
          <div
            onPointerEnter={() => setPointer(true)}
            onPointerLeave={() => setPointer(false)}
            ref={rows}
          >
            <SideNavItem href="#" icon={<Icon icon="uraeda:home" />} isSelected label="Home" />
            {needsYou.length > 0 && (
              <SideNavSection title="Needs you">
                <Cards items={needsYou} />
              </SideNavSection>
            )}
            <FlowRow add="Add a note to the inbox" count={4} label="Inbox" />
            <FlowRow add="Add to the priorities" count={12} label="Priorities" />
            <SideNavSection title="Sessions">
              {!isFolded && (
                <SideNavItem href="#" icon={<span aria-hidden="true">＋</span>} label="New" />
              )}
              <Cards items={sessions} />
            </SideNavSection>
          </div>
        </SideNav>
      }
    >
      <VStack gap={3} xstyle={styles.page}>
        <Heading level={1}>Home</Heading>
        <Text color="secondary">The page beside the sidebar.</Text>
      </VStack>
    </AppShell>
  );
}

const meta = {
  component: SidebarMockup,
  parameters: { layout: "fullscreen" },
  title: "Sidebar",
} satisfies Meta<typeof SidebarMockup>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * One Sessions section, oldest started first: two features, two changes, and two sessions, each a
 * card of one line, its icon telling its kind. The feature being built shows its task and the lines
 * it changed under it. Done holds the sessions read to their end, and the merged changes and
 * features. On the phone, the top bar starts with Home.
 */
export const Merged: Story = { args: {} };

/** Nothing in flight: only "＋ New" under Sessions, and the done items below. */
export const Empty: Story = { args: { needsYou: [], sessions: [] } };

/** Under the pointer: the button that folds the sidebar; every card's "…" is always there. */
export const UnderThePointer: Story = { args: { isRevealed: true } };

/** Folded to its rail: each item's kind icon and status, the button that unfolds it on top. */
export const Folded: Story = { args: { isFolded: true } };

/** Just after "Submit answers": the card says what runs until the server's status arrives. */
export const Committing: Story = {
  args: {
    needsYou: [NEEDS_YOU[0]!, { ...NEEDS_YOU[1]!, pending: "Committing…" }],
  },
};
