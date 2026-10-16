// Mockups of the redesigned sidebar, in the app's shell: the work that needs you first, then the
// inbox, the priorities, the changes, and the features in the flow's order, each item in its card,
// the chats, and the latest done items at the bottom. On the phone, the shell's top bar starts with
// the way home. The cards are drawn from the props the server will give them.
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

const NEEDS_YOU: Array<CardItem> = [
  {
    folder: "2026-10-16-settings-page",
    kind: "feature",
    label: "settings-page",
    status: { label: "Needs you", status: "needs-you" },
    step: { kind: "questions", label: "Questions to answer" },
    title: "Settings page",
  },
  {
    changes: { added: 38, removed: 12 },
    folder: "2026-10-15-flaky-tests",
    kind: "change",
    label: "flaky-tests",
    pullRequest: { number: 24, url: "https://github.com/mrtolkien/uraeda/pull/24" },
    status: { label: "Needs you", status: "needs-you" },
    step: { kind: "pull-request", label: "Pull request ready" },
    title: "Fix the flaky session tests",
  },
];

const CHANGES: Array<CardItem> = [
  {
    changes: { added: 120, removed: 40 },
    folder: "2026-10-16-tasks-reappear",
    hasBackgroundCommand: true,
    kind: "change",
    label: "tasks-reappear",
    status: { label: "Working", status: "working" },
    step: { kind: "change", label: "Change" },
    title: "Done tasks reappear after a reload",
  },
];

/** In the flow's order: the earliest step first. */
const FEATURES: Array<CardItem> = [
  {
    folder: "2026-10-16-look-and-feel",
    kind: "feature",
    label: "look-and-feel",
    status: { label: "Working", status: "working" },
    step: { kind: "discovery", label: "Discovery" },
    subagents: [
      { description: "Research icon sets", id: "a1" },
      { description: "Map the theme's tokens", id: "a2" },
    ],
    title: "Look and feel pass",
  },
  {
    folder: "2026-10-16-redesign-priorities",
    kind: "feature",
    label: "redesign-priorities",
    status: { label: "Idle", status: "idle" },
    step: { kind: "plan", label: "Plan" },
    title: "Redesign home, inbox, and priorities",
  },
  {
    changes: { added: 1050, removed: 250 },
    color: "purple",
    folder: "2026-10-16-redesign-interface",
    kind: "feature",
    label: "Sidebar",
    progress: { position: 7, title: "Session column", total: 11 },
    status: { label: "Working", status: "working" },
    step: { kind: "implementation", label: "Implementation" },
    subagents: [{ description: "Write the card's tests", id: "a3" }],
    title: "Redesign sidebars and global interface",
  },
  {
    changes: { added: 4537, removed: 495 },
    folder: "2026-10-16-basic-security",
    hasBackgroundCommand: true,
    kind: "feature",
    label: "basic-security",
    status: { label: "Working", status: "working" },
    step: { kind: "review", label: "Final review" },
    title: "Auth and login for basic security",
  },
];

const DONE: Array<DoneRow> = [
  "2026-10-15-ui-iteration",
  "2026-10-15-claude-usage",
  "2026-10-15-add-scratchpad",
  "2026-10-15-add-bugfixing",
  "2026-10-14-testing-review",
  "2026-10-14-text-inputs",
  "2026-10-14-session-view",
].map((folder) => ({
  folder,
  href: "#",
  label: folder.slice(11),
  title: folder.slice(11).replaceAll("-", " "),
}));

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

function Cards({ items, tagged = false }: { items: Array<CardItem>; tagged?: boolean }) {
  return items.map((item) => (
    <ItemCard hasChangeTag={tagged} href="#" item={item} key={item.folder} onSettings={() => {}} />
  ));
}

/** The shell with the redesigned sidebar, beside a page. */
function SidebarMockup({
  changes = CHANGES,
  features = FEATURES,
  isFolded = false,
  isRevealed = false,
  needsYou = NEEDS_YOU,
}: {
  changes?: Array<CardItem>;
  features?: Array<CardItem>;
  isFolded?: boolean;
  isRevealed?: boolean;
  needsYou?: Array<CardItem>;
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
            <SideNavSection title="Needs you">
              <Cards items={needsYou} tagged />
            </SideNavSection>
            <FlowRow add="Add a note to the inbox" count={4} label="Inbox" />
            <FlowRow add="Add to the priorities" count={12} label="Priorities" />
            <SideNavSection title="Changes">
              <SideNavItem href="#" icon={<span aria-hidden="true">＋</span>} label="New change" />
              <Cards items={changes} />
            </SideNavSection>
            <SideNavSection title="Features">
              <Cards items={features} />
            </SideNavSection>
            <SideNavSection title="Chats">
              <SideNavItem href="#" icon={<span aria-hidden="true">＋</span>} label="New chat" />
              <SideNavItem href="#" label="Why is CI slow?" />
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
 * The sidebar unfolded: two items need you, a change works with a background command, four features
 * in the flow's order, one renamed "Sidebar" in purple, and the five latest done items at the
 * bottom. On the phone, the top bar starts with Home.
 */
export const Unfolded: Story = { args: {} };

/** Under the pointer: the button that folds the sidebar; every card's "…" is always there. */
export const UnderThePointer: Story = { args: { isRevealed: true } };

/** Folded to its rail: each item's step icon and status, the button that unfolds it on top. */
export const Folded: Story = { args: { isFolded: true } };

/** Fewer items in flight: the latest done items fit at the bottom, as many as the room allows. */
export const FewItems: Story = {
  args: { changes: [], features: FEATURES.slice(2, 3), needsYou: NEEDS_YOU.slice(0, 1) },
};

/** Just after "Submit answers": the card says what runs until the server's status arrives. */
export const Committing: Story = {
  args: {
    needsYou: [{ ...NEEDS_YOU[0]!, pending: "Committing…" }, NEEDS_YOU[1]!],
  },
};
