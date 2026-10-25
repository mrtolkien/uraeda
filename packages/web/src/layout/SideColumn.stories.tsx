// Mockups of a page's right column, as the session's: resized from its edge, folded to a rail from
// its top, its width kept by its caller.
import { useResizable } from "@astryxdesign/core/Resizable";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { SideColumn } from "./SideColumn.tsx";

function Column({ isRevealed, shown }: { isRevealed?: boolean; shown: boolean }) {
  const [isShown, setShown] = useState(shown);
  const width = useResizable({ defaultSize: 360, maxSize: 720, minSize: 300 });
  return (
    <SideColumn
      content={<Text>{"The session's transcript."}</Text>}
      isShown={isShown}
      label="The session's column"
      onShownChange={setShown}
      rail={<Text type="supporting">7/11</Text>}
      width={width}
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

/** Folded: a rail with its key information, and the button that unfolds it, at the page's top right. */
export const Folded: Story = { args: { shown: false } };
