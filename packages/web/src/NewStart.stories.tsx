// Mockups of the New page's Feature card once it starts the feature: its composer, holding a line's
// Start, takes images and sends with "Start the feature"; and the toast a Start shows when it
// replaced the draft the composer held, whose Undo brings the draft back.
import { VStack } from "@astryxdesign/core/VStack";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { inRepositoryFolder } from "../.storybook/inRepositoryFolder.tsx";
import type { DraftImage } from "./attach/chatImages.ts";
import { Composer } from "./Composer.tsx";
import { useUndoToast } from "./layout/useUndoToast.ts";

/** A line of Now, as its Start fills the composer: the line, then its nested lines. */
const LINE = `Proposal start flow
- "Proposal > Start" should not append text to the dialog
- The multi-line text box should be shared between all 3 start types`;

/** The draft the line replaced. */
const DRAFT = "Widen the sidebar";

/** The Feature card's composer, holding `text`; with `replaced`, the toast of the replaced draft. */
function FeatureStart({ replaced = false, text }: { replaced?: boolean; text: string }) {
  const [value, setValue] = useState(text);
  const [images, setImages] = useState<ReadonlyArray<DraftImage>>([]);
  const toast = useUndoToast();
  useEffect(() => {
    if (replaced) {
      toast("Draft replaced", async () => {
        setValue(DRAFT);
        return undefined;
      });
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- once, as the Start shows it
  }, []);
  return (
    <VStack gap={4}>
      <Composer
        images={images}
        onChange={setValue}
        onImagesChange={setImages}
        onSend={async () => false}
        placeholder="Write Proposal"
        sendLabel="Start the feature"
        value={value}
      />
    </VStack>
  );
}

const meta = {
  args: { text: LINE },
  component: FeatureStart,
  decorators: [inRepositoryFolder],
  title: "New page/Feature start",
} satisfies Meta<typeof FeatureStart>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A line's Start into an empty composer: the line alone, no link line, nothing to undo. */
export const FromALine: Story = {};

/** A line's Start over a draft: the line replaced it, and the toast's Undo, or `u`, brings it back. */
export const DraftReplaced: Story = { args: { replaced: true } };
