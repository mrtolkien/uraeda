// Mockups of a git write in flight: the clicked button spins with what it does, the other writing
// buttons are blocked, and a thin bar runs at the top of the page.
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { type WriteState, WriteButtonView, WriteProgress } from "./WriteFeedback.tsx";

function Page({ running }: { running: boolean }) {
  const state = (own: boolean): WriteState => (running ? (own ? "running" : "blocked") : "idle");
  return (
    <VStack gap={4}>
      <WriteProgress isRunning={running} />
      <Text>{"The proposal of Settings page, edited."}</Text>
      <HStack gap={2} justify="end">
        <WriteButtonView
          label="Commit only"
          onClick={() => {}}
          runningLabel="Committing…"
          state={state(false)}
        />
        <WriteButtonView
          label="Commit and start the agent"
          onClick={() => {}}
          runningLabel="Committing…"
          state={state(true)}
          variant="primary"
        />
      </HStack>
    </VStack>
  );
}

const meta = {
  component: Page,
  title: "Writes/Feedback",
} satisfies Meta<typeof Page>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Before the click. */
export const Ready: Story = { args: { running: false } };

/** Right after "Commit and start the agent": the commit's hooks run for a few seconds. */
export const Committing: Story = { args: { running: true } };
