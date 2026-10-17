// Mockup of a decision's change in the specs redesign (`specs/2026-10-17-redesign-specs/`): task
// storage, as the mockup feature's spec changes it (see `.storybook/specMockup.ts`).
import type { Meta, StoryObj } from "@storybook/react-vite";
import { DecisionChange } from "./DecisionChange.tsx";
import { TASK_STORAGE_AFTER, TASK_STORAGE_BEFORE } from "./decisionTexts.ts";

const meta = {
  args: { after: TASK_STORAGE_AFTER, before: TASK_STORAGE_BEFORE },
  component: DecisionChange,
  title: "Mockups/Decision change",
} satisfies Meta<typeof DecisionChange>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Task storage's change: a reworded rule with its words marked, a new rule and consequence, the
 * unchanged parts folded, and the rule merged away folded as "1 removed".
 */
export const Change: Story = {};
