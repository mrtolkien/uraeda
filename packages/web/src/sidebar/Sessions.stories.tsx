// Mockups of the sidebar once chats and changes merge (`specs/2026-10-20-merge-chats/spec.md`): one
// Sessions section, oldest started first, where a session, a change, and a feature share one card:
// one line of its icon, name, status, and "…". The icon tells the kind: a speech bubble for a
// session, a wrench for a change, and a feature's step. A second line shows only while there is
// activity to read: a task's progress or the lines changed. A session the human has read to its end
// is done, at the bottom. Drawn from fixed props.
import { AppShell } from "@astryxdesign/core/AppShell";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { MoreMenu } from "@astryxdesign/core/MoreMenu";
import { SideNav, SideNavItem, SideNavSection } from "@astryxdesign/core/SideNav";
import { Text } from "@astryxdesign/core/Text";
import {
  borderVars,
  colorVars,
  radiusVars,
  spacingVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import type { Meta, StoryObj } from "@storybook/react-vite";
import * as stylex from "@stylexjs/stylex";
import { useRef } from "react";
import type { SessionStatus } from "uraeda-server/fate";
import { StatusMark } from "../StatusMark.tsx";
import { DoneArea, type DoneRow } from "./DoneArea.tsx";
import { SidebarHeading } from "./SidebarHeading.tsx";
import { type StepKind, StepIcon } from "./StepIcon.tsx";

const styles = stylex.create({
  added: { color: colorVars["--color-success"] },
  card: {
    borderColor: colorVars["--color-border"],
    borderRadius: radiusVars["--radius-element"],
    borderStyle: "solid",
    borderWidth: borderVars["--border-width"],
    marginBlockEnd: spacingVars["--spacing-1"],
    overflow: "hidden",
  },
  line: {
    // Under the name, as the sub-agents' lines are.
    paddingBlockEnd: spacingVars["--spacing-1"],
    paddingInlineEnd: spacingVars["--spacing-2"],
    paddingInlineStart: spacingVars["--spacing-6"],
  },
  page: {
    paddingBlock: spacingVars["--spacing-6"],
    paddingInline: spacingVars["--spacing-8"],
  },
  removed: { color: colorVars["--color-error"] },
  subagent: {
    paddingBlockEnd: spacingVars["--spacing-1"],
    paddingInlineStart: spacingVars["--spacing-6"],
  },
});

type Kind = "change" | "feature" | "session";

/** A row of the list: a session, a change, or a feature, drawn the same way. */
type Entry = {
  changes?: { added: number; removed: number };
  kind: Kind;
  name: string;
  /** Its task's progress, during a feature's implementation. */
  progress?: { position: number; title: string; total: number };
  status: { label: string; status: SessionStatus };
  /** A change's or a feature's step; a session has none. */
  step?: { kind: StepKind; label: string };
  subagents?: Array<string>;
};

/** The kind's icon: a feature's is its step's, since its steps are its own. */
function KindIcon({ entry }: { entry: Entry }) {
  if (entry.kind === "feature" && entry.step) {
    return <StepIcon step={entry.step.kind} />;
  }
  return (
    <Icon
      color="secondary"
      icon={entry.kind === "change" ? "wrench" : "uraeda:comment"}
      size="sm"
    />
  );
}

const WORKING = { label: "Working", status: "working" } as const;
const IDLE = { label: "Idle", status: "idle" } as const;
const NEEDS = { label: "Needs you", status: "needs-you" } as const;

const NEEDS_YOU: Array<Entry> = [
  { kind: "session", name: "Why does the login redirect twice?", status: NEEDS },
  {
    kind: "feature",
    name: "settings-page",
    status: NEEDS,
    step: { kind: "questions", label: "Questions to answer" },
  },
];

/** Oldest started first: a session keeps its place when it becomes a change. */
const SESSIONS: Array<Entry> = [
  {
    kind: "feature",
    name: "look-and-feel",
    status: WORKING,
    step: { kind: "discovery", label: "Discovery" },
    subagents: ["Research icon sets"],
  },
  {
    changes: { added: 42, removed: 9 },
    kind: "change",
    name: "flaky-tests",
    status: WORKING,
    step: { kind: "change", label: "Change" },
  },
  { kind: "session", name: "Why is CI slow?", status: WORKING },
  {
    changes: { added: 1050, removed: 250 },
    kind: "feature",
    name: "redesign-interface",
    progress: { position: 7, title: "Session column", total: 11 },
    status: WORKING,
    step: { kind: "implementation", label: "Implementation" },
  },
  {
    kind: "change",
    name: "tasks-reappear",
    status: IDLE,
    step: { kind: "change", label: "Change" },
  },
  { kind: "session", name: "Explain the fate protocol's views", status: NEEDS },
];

const DONE: Array<DoneRow> = [
  { folder: "session-1", label: "Rename the toolchain task", title: "" },
  { folder: "2026-10-20-session-transcript", label: "session-transcript", title: "" },
  { folder: "2026-10-20-ctrl-enter", label: "ctrl-enter", title: "" },
  { folder: "session-2", label: "What does ura clean keep?", title: "" },
  { folder: "2026-10-20-inbox-noise", label: "inbox-noise", title: "" },
].map((row) => ({ ...row, href: "#", title: row.title || row.label }));

/** The "…" of a row: rename and archive for a session, the name for a change or a feature. */
function Actions({ entry }: { entry: Entry }) {
  return (
    <MoreMenu
      items={
        entry.kind === "session"
          ? [
              { label: "Rename", onClick: () => {} },
              { label: "Archive", onClick: () => {} },
            ]
          : [{ label: "Rename", onClick: () => {} }]
      }
      label={`Actions of ${entry.name}`}
      size="sm"
    />
  );
}

/** One card, whatever the kind: one line, then its activity while it has any. */
function Card({ entry }: { entry: Entry }) {
  const { changes, progress } = entry;
  return (
    <div {...stylex.props(styles.card)}>
      <SideNavItem
        actions={<Actions entry={entry} />}
        aria-label={[entry.name, entry.kind, entry.step?.label, entry.status.label]
          .filter(Boolean)
          .join(", ")}
        endContent={<StatusMark label={entry.status.label} status={entry.status.status} />}
        href="#"
        icon={<KindIcon entry={entry} />}
        label={entry.name}
      />
      {(changes || progress) && (
        <HStack align="center" gap={2} justify="between" xstyle={styles.line}>
          <Text color="secondary" maxLines={1} type="supporting">
            {progress ? `${progress.position}/${progress.total} · ${progress.title}` : ""}
          </Text>
          {changes && (
            <HStack gap={1}>
              <Text hasTabularNumbers type="supporting" xstyle={styles.added}>
                {`+${changes.added}`}
              </Text>
              <Text hasTabularNumbers type="supporting" xstyle={styles.removed}>
                {`−${changes.removed}`}
              </Text>
            </HStack>
          )}
        </HStack>
      )}
      {entry.subagents?.map((subagent) => (
        <HStack align="center" gap={2} key={subagent} xstyle={styles.subagent}>
          <StatusMark label="Working" small status="working" />
          <Text color="secondary" maxLines={1} type="supporting">
            {subagent}
          </Text>
        </HStack>
      ))}
    </div>
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
                {needsYou.map((entry) => (
                  <Card entry={entry} key={entry.name} />
                ))}
              </SideNavSection>
            )}
            <FlowRow add="Add a note to the inbox" count={4} label="Inbox" />
            <FlowRow add="Add to the priorities" count={12} label="Priorities" />
            <SideNavSection title="Sessions">
              <SideNavItem href="#" icon={<span aria-hidden="true">＋</span>} label="New" />
              {sessions.map((entry) => (
                <Card entry={entry} key={entry.name} />
              ))}
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
 * One Sessions section, oldest started first: two features, two changes, and two sessions, each a
 * card of one line, its icon telling its kind. The feature being built shows its task and the lines
 * it changed under it. Done holds the sessions read to their end, and the merged changes and
 * features.
 */
export const Merged: Story = {};

/** Nothing in flight: only "＋ New" under Sessions, and the done items below. */
export const Empty: Story = { args: { needsYou: [], sessions: [] } };
