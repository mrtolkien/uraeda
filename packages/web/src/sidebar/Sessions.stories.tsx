// Mockups of the sidebar once chats and changes merge (`specs/2026-10-20-merge-chats/spec.md`): one
// Sessions section, oldest started first, where a session without a workflow is a plain row and a
// change or a feature is its card, one "＋ New" row on top, and the latest done items at the bottom,
// sessions included. Drawn from fixed props, as the sidebar's own mockups are.
import { AppShell } from "@astryxdesign/core/AppShell";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { SideNav, SideNavItem, SideNavSection } from "@astryxdesign/core/SideNav";
import { Text } from "@astryxdesign/core/Text";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import type { Meta, StoryObj } from "@storybook/react-vite";
import * as stylex from "@stylexjs/stylex";
import { useRef } from "react";
import { StatusMark } from "../StatusMark.tsx";
import { DoneArea, type DoneRow } from "./DoneArea.tsx";
import { type CardItem, ItemCard } from "./ItemCard.tsx";
import { SidebarHeading } from "./SidebarHeading.tsx";

const styles = stylex.create({
  page: {
    paddingBlock: spacingVars["--spacing-6"],
    paddingInline: spacingVars["--spacing-8"],
  },
});

/** A row of the list: a session without a workflow, or a change's or a feature's card. */
type Entry =
  | { kind: "session"; status: "idle" | "needs-you" | "working"; title: string }
  | { item: CardItem; kind: "card" };

const NEEDS_YOU: Array<Entry> = [
  { kind: "session", status: "needs-you", title: "Why does the login redirect twice?" },
  {
    item: {
      folder: "2026-10-18-settings-page",
      kind: "feature",
      label: "settings-page",
      status: { label: "Needs you", status: "needs-you" },
      step: { kind: "questions", label: "Questions to answer" },
      title: "Settings page",
    },
    kind: "card",
  },
];

/** Oldest started first: a session keeps its place when it becomes a change. */
const SESSIONS: Array<Entry> = [
  {
    item: {
      folder: "2026-10-17-look-and-feel",
      kind: "feature",
      label: "look-and-feel",
      status: { label: "Working", status: "working" },
      step: { kind: "discovery", label: "Discovery" },
      title: "Look and feel pass",
    },
    kind: "card",
  },
  {
    item: {
      changes: { added: 42, removed: 9 },
      folder: "2026-10-19-flaky-tests",
      kind: "change",
      label: "flaky-tests",
      status: { label: "Working", status: "working" },
      step: { kind: "change", label: "Change" },
      title: "Fix the flaky session tests",
    },
    kind: "card",
  },
  { kind: "session", status: "idle", title: "Why is CI slow?" },
  {
    item: {
      folder: "2026-10-20-tasks-reappear",
      kind: "change",
      label: "tasks-reappear",
      status: { label: "Idle", status: "idle" },
      step: { kind: "change", label: "Change" },
      title: "Done tasks reappear after a reload",
    },
    kind: "card",
  },
  { kind: "session", status: "working", title: "Explain the fate protocol's views" },
];

const DONE: Array<DoneRow> = [
  { folder: "2026-10-20-session-transcript", label: "session-transcript", title: "" },
  { folder: "session-1", label: "Rename the toolchain task", title: "" },
  { folder: "2026-10-20-ctrl-enter", label: "ctrl-enter", title: "" },
  { folder: "2026-10-20-inbox-noise", label: "inbox-noise", title: "" },
  { folder: "session-2", label: "What does ura clean keep?", title: "" },
].map((row) => ({ ...row, href: "#", title: row.title || row.label }));

function Entries({ entries, tagged = false }: { entries: Array<Entry>; tagged?: boolean }) {
  return entries.map((entry) =>
    entry.kind === "card" ? (
      <ItemCard
        hasChangeTag={tagged || entry.item.kind === "change"}
        href="#"
        item={entry.item}
        key={entry.item.folder}
        onSettings={() => {}}
      />
    ) : (
      <SideNavItem
        href="#"
        icon={
          <StatusMark
            label={entry.status === "needs-you" ? "Needs you" : entry.status}
            status={entry.status}
          />
        }
        key={entry.title}
        label={entry.title}
      />
    ),
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

/** The shell with the merged sidebar, beside a page. */
function SessionsSidebar({
  needsYou = NEEDS_YOU,
  sessions = SESSIONS,
}: {
  needsYou?: Array<Entry>;
  sessions?: Array<Entry>;
}) {
  const rows = useRef<HTMLDivElement>(null);
  return (
    <AppShell
      contentPadding={0}
      height="fill"
      sideNav={
        <SideNav
          collapsible={{ defaultIsCollapsed: false, hasButton: false }}
          footer={<DoneArea allHref="#done" content={rows} rows={DONE} />}
          header={
            <SidebarHeading
              homeHref="#"
              isHome
              isRevealed={false}
              menu={<Button label="uraeda" variant="ghost" />}
            />
          }
          resizable={{ defaultWidth: 280, maxWidth: 480, minWidth: 200 }}
        >
          <div ref={rows}>
            <SideNavItem href="#" icon={<Icon icon="uraeda:home" />} isSelected label="Home" />
            {needsYou.length > 0 && (
              <SideNavSection title="Needs you">
                <Entries entries={needsYou} tagged />
              </SideNavSection>
            )}
            <FlowRow add="Add a note to the inbox" count={4} label="Inbox" />
            <FlowRow add="Add to the priorities" count={12} label="Priorities" />
            <SideNavSection title="Sessions">
              <SideNavItem href="#" icon={<span aria-hidden="true">＋</span>} label="New" />
              <Entries entries={sessions} />
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
  component: SessionsSidebar,
  parameters: { layout: "fullscreen" },
  title: "Mockups/Sessions sidebar",
} satisfies Meta<typeof SessionsSidebar>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * One Sessions section, oldest started first: a feature, two changes, and two sessions without a
 * workflow, one "＋ New" row on top. A session and a feature need you, above. The latest done items,
 * sessions included, at the bottom.
 */
export const Merged: Story = {};

/** Nothing in flight: only "＋ New" under Sessions, and the done items below. */
export const Empty: Story = { args: { needsYou: [], sessions: [] } };
