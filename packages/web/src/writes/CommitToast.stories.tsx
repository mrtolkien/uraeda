// Mockups of the git writes in flight: the page shows each write's result at once, and the toast at
// the bottom right says what is still landing in git, the next ones waiting their turn.
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CommitToastView, type QueuedWrite } from "./CommitToast.tsx";

function Page({ writes }: { writes: ReadonlyArray<QueuedWrite> }) {
  return (
    <VStack gap={4}>
      <Text>{"Spec: Performance pass, approved."}</Text>
      <Text color="secondary">
        {"The page already reads Approved, and the session opened, its message in the composer."}
      </Text>
      <CommitToastView onDismiss={() => {}} onOpen={() => {}} writes={writes} />
    </VStack>
  );
}

const meta = {
  component: Page,
  title: "Writes/Commit toast",
} satisfies Meta<typeof Page>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Right after Approve: the commit runs the hooks for a few seconds, the page already moved on. */
export const Running: Story = {
  args: {
    writes: [{ id: "1", label: "Approving the spec of Performance pass", state: "running" }],
  },
};

/** An answer committed while the approval still runs: it waits its turn, nothing is blocked. */
export const Queued: Story = {
  args: {
    writes: [
      { id: "1", label: "Approving the spec of Performance pass", state: "running" },
      { id: "2", label: "Committing the answers of Decisions needs", state: "waiting" },
      { id: "3", label: "Moving “Vim in text edit mode” to Now", state: "waiting" },
    ],
  },
};

/** A hook refused the commit: the approval is undone on its page, and the toast stays with why. */
export const Refused: Story = {
  args: {
    writes: [
      {
        id: "1",
        label: "Approving the spec of Performance pass",
        output:
          "✗ vp check --fix\nspecs/2026-10-29-performance-pass/spec.md:12: a sentence of 31 words\n1 problem",
        state: "refused",
      },
      { id: "2", label: "Committing the answers of Decisions needs", state: "running" },
    ],
  },
};
