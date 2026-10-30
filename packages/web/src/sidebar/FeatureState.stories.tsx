// Mockups of the feature state pass (`specs/2026-10-30-feature-state/spec.md`): a feature's card in
// the states the spec adds or changes, and the session's banner of a run that asks for attention,
// with its Dismiss. The cards are the real `ItemCard` over fixed items, in the phone column's width;
// the card's Dismiss is drawn beside it, where the build puts it at the end of the card's first line.
import { Banner } from "@astryxdesign/core/Banner";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Text } from "@astryxdesign/core/Text";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import type { Meta, StoryObj } from "@storybook/react-vite";
import * as stylex from "@stylexjs/stylex";
import { columnVars } from "../shell/column.stylex.ts";
import { type CardItem, ItemCard } from "./ItemCard.tsx";

const styles = stylex.create({
  column: { maxWidth: columnVars["--column-phone-max"], padding: spacingVars["--spacing-3"] },
  grow: { flexGrow: 1, minWidth: 0 },
});

const open = () => {};

/** The fixed feature every card draws: "Panes size", with its pull request #75. */
const PANES: CardItem = {
  folder: "2026-10-30-panes-size",
  harness: "claude",
  kind: "feature",
  label: "Panes size",
  pullRequest: { number: 75, url: "https://github.com/mrtolkien/uraeda/pull/75" },
  status: { label: "Working", status: "working" },
  step: { kind: "pull-request", label: "PR" },
  title: "Panes size",
};

/** A pane's title, then its cards, as the sidebar draws them. */
function Pane({ cards, title }: { cards: Array<CardItem>; title: string }) {
  return (
    <VStack gap={1} xstyle={styles.column}>
      <Text color="secondary" type="supporting">
        {title}
      </Text>
      {cards.map((item) => (
        <ItemCard href="#" item={item} key={item.label} onOpen={open} onStatus={open} />
      ))}
    </VStack>
  );
}

const meta = {
  component: Pane,
  title: "Mockups/Feature state",
} satisfies Meta<typeof Pane>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * An agent works on a feature whose pull request is open: it is in progress, its step reads "PR",
 * not "PR ready", and its button opens the session at work.
 */
export const WorkingOnAPullRequest: Story = {
  args: { cards: [PANES], title: "In progress" },
};

/** The run ended, the pull request holds the branch's latest commit: ready for your review. */
export const ReadyForReview: Story = {
  args: {
    cards: [
      {
        ...PANES,
        status: { label: "Needs you", status: "needs-you" },
        step: { kind: "pull-request", label: "PR ready" },
      },
    ],
    title: "Needs you",
  },
};

/** The branch holds commits its pull request lacks, and no agent runs: the agent's step, Push. */
export const CommitsToPush: Story = {
  args: {
    cards: [
      {
        ...PANES,
        status: { label: "Idle", status: "idle" },
        step: { kind: "pull-request", label: "Push" },
      },
    ],
    title: "In progress",
  },
};

/** Tasks 13 to 16 built at once, 14 and 15 done on their task branches: 14 of 20 done. */
export const ProgressInAWave: Story = {
  args: {
    cards: [
      {
        ...PANES,
        folder: "2026-10-30-feature-state",
        label: "Feature state",
        progress: { position: 14, title: "The watcher re-watches a worktree", total: 20 },
        step: { kind: "implementation", label: "Implementing" },
        title: "Feature state pass",
      },
    ],
    title: "In progress",
  },
};

/** A run the server stopped, on the feature's latest session: it asks for you until dismissed. */
export const NeedsAttention: Story = {
  args: { cards: [], title: "Needs you" },
  render: () => (
    <VStack gap={1} xstyle={styles.column}>
      <Text color="secondary" type="supporting">
        Needs you
      </Text>
      <HStack align="center" gap={1}>
        <div {...stylex.props(styles.grow)}>
          <ItemCard
            href="#"
            item={{
              folder: "2026-10-26-leader-key",
              harness: "claude",
              kind: "feature",
              label: "Leader key",
              status: { label: "Needs attention", status: "attention" },
              step: { kind: "implementation", label: "Implementing" },
              title: "Leader key",
            }}
            onOpen={open}
            onStatus={open}
          />
        </div>
        <IconButton icon={<Icon icon="close" />} label="Dismiss" size="sm" variant="ghost" />
      </HStack>
    </VStack>
  ),
};

/** Each banner of a run that asks for attention, on its session's page, each with its Dismiss. */
export const SessionBanners: Story = {
  args: { cards: [], title: "" },
  render: () => (
    <VStack gap={3} xstyle={styles.column}>
      <Banner
        collapsible={false}
        description="It was running when the server stopped. Tell the agent how to go on, or dismiss this."
        dismissLabel="Dismiss"
        isDismissable
        status="warning"
        title="The server stopped the agent."
      />
      <Banner
        collapsible={false}
        description="Tell the agent how to go on when you are ready, or dismiss this."
        dismissLabel="Dismiss"
        isDismissable
        status="warning"
        title="You stopped the agent."
      />
      <Banner
        collapsible={false}
        description="You've hit your session limit · resets 1:20am (Asia/Tokyo). Read how it ended, then tell the agent how to go on, or dismiss this."
        dismissLabel="Dismiss"
        isDismissable
        status="error"
        title="The agent's run failed."
      />
    </VStack>
  ),
};
