// Mockups of the spec page in the specs redesign (`specs/2026-10-17-redesign-specs/`), over the
// mockup feature's spec, written in the shape the redesign proposes (see
// `.storybook/specMockup.ts`).
import type { Meta, StoryObj } from "@storybook/react-vite";
import { SpecMockup } from "./mockups/SpecMockup.tsx";

const meta = {
  args: { folder: "2026-10-17-spec-mockup", layout: "cards" },
  component: SpecMockup,
  parameters: { layout: "fullscreen" },
  title: "Mockups/Spec page",
} satisfies Meta<typeof SpecMockup>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Each part of the spec in its own card: what is approved, the review answered, each decision, each
 * story with its key scenarios as Given, When, and Then rows, then what else to weigh.
 */
export const Cards: Story = { args: { layout: "cards" } };

/**
 * One document, its parts set apart by a label and a coloured rule down their side, each story
 * under a band, its scenarios as today's numbered list.
 */
export const Document: Story = { args: { layout: "document" } };
