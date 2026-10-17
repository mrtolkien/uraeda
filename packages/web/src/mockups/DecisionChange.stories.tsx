// Mockups of a decision's change in the specs redesign (`specs/2026-10-17-redesign-specs/`): task
// storage, as the mockup feature's spec changes it (see `.storybook/specMockup.ts`).
import type { Meta, StoryObj } from "@storybook/react-vite";
import { DecisionChange } from "./DecisionChange.tsx";
import { TASK_STORAGE_AFTER, TASK_STORAGE_BEFORE } from "./decisionTexts.ts";

const meta = {
  args: { after: TASK_STORAGE_AFTER, before: TASK_STORAGE_BEFORE, mode: "inline" },
  component: DecisionChange,
  title: "Mockups/Decision change",
} satisfies Meta<typeof DecisionChange>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The new text, with added words underlined in green and removed words struck in red. */
export const Inline: Story = { args: { mode: "inline" } };

/** Each changed part as two columns, before and after, one above the other on a phone. */
export const SideBySide: Story = { args: { mode: "sideBySide" } };

/** The new text, each changed part marked, its previous wording behind a toggle. */
export const Marked: Story = { args: { mode: "marked" } };
