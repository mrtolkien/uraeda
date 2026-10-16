// Mockups of the session's right column, "Progress": resized from its edge, hidden from its top.
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { SideColumn } from "./SideColumn.tsx";

function Column({ isRevealed, shown }: { isRevealed?: boolean; shown: boolean }) {
  const [isShown, setShown] = useState(shown);
  return (
    <SideColumn
      content={<Text>{"The session's transcript."}</Text>}
      isShown={isShown}
      label="Progress"
      onShownChange={setShown}
      storageKey="uraeda.story.column"
      {...(isRevealed === undefined ? {} : { isRevealed })}
    >
      <VStack gap={2}>
        <Text type="label">Implementation</Text>
        <Text color="secondary">7 of 11 tasks done</Text>
      </VStack>
    </SideColumn>
  );
}

const meta = {
  component: Column,
  parameters: { layout: "fullscreen" },
  title: "Layout/Side column",
} satisfies Meta<typeof Column>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Shown, under the pointer: its hide button at its top, the resize handle on its edge. */
export const Shown: Story = { args: { isRevealed: true, shown: true } };

/** Hidden: the button that shows it again, at the page's top right. */
export const Hidden: Story = { args: { shown: false } };
