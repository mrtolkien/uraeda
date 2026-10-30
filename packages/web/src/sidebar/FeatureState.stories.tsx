// The states of the feature state pass (`specs/2026-10-30-feature-state/spec.md`): a feature's card
// in the states the spec adds or changes, and the session's banner of a run that asks for
// attention, with its Dismiss. The cards are the real `ItemCard` over fixed items, in the phone
// column's width, its Dismiss at the end of its first line; the banners, the real `RunBanner`.
import { Text } from "@astryxdesign/core/Text";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import type { Meta, StoryObj } from "@storybook/react-vite";
import * as stylex from "@stylexjs/stylex";
import { RunBanner } from "../SessionAttention.tsx";
import { columnVars } from "../shell/column.stylex.ts";
import { type CardItem, ItemCard } from "./ItemCard.tsx";

const styles = stylex.create({
  column: { maxWidth: columnVars["--column-phone-max"], padding: spacingVars["--spacing-3"] },
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

/**
 * A pane's title, then its cards, as the sidebar draws them, each with Dismiss while a failed or
 * stopped run asks.
 */
function Pane({ cards, title }: { cards: Array<CardItem>; title: string }) {
  return (
    <VStack gap={1} xstyle={styles.column}>
      <Text color="secondary" type="supporting">
        {title}
      </Text>
      {cards.map((item) => (
        <ItemCard
          href="#"
          item={item}
          key={item.label}
          onDismiss={item.status.status === "attention" ? open : undefined}
          onOpen={open}
          onStatus={open}
        />
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
        progress: { done: 14, title: "The watcher re-watches a worktree", total: 20 },
        step: { kind: "implementation", label: "Implementing" },
        title: "Feature state pass",
      },
    ],
    title: "In progress",
  },
};

/** A run the server stopped, on the feature's latest session: it asks for you until dismissed. */
export const NeedsAttention: Story = {
  args: {
    cards: [
      {
        folder: "2026-10-26-leader-key",
        harness: "claude",
        kind: "feature",
        label: "Leader key",
        status: { label: "Needs attention", status: "attention" },
        step: { kind: "implementation", label: "Implementing" },
        title: "Leader key",
      },
    ],
    title: "Needs you",
  },
};

/** Each banner of a run that asks for attention, on its session's page, each with its Dismiss. */
export const SessionBanners: Story = {
  args: { cards: [], title: "" },
  render: () => (
    <VStack gap={3} xstyle={styles.column}>
      <RunBanner onDismiss={open} reason="interrupted" />
      <RunBanner onDismiss={open} reason="stopped" />
      <RunBanner
        onDismiss={open}
        reason="failed"
        why="You've hit your session limit · resets 1:20am (Asia/Tokyo)"
      />
    </VStack>
  ),
};
