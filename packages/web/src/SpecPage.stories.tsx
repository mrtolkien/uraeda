// Mockup of the spec page in the specs redesign (`specs/2026-10-17-redesign-specs/`), over the
// mockup feature's spec, written in the shape the redesign proposes (see
// `.storybook/specMockup.ts`).
import type { Meta, StoryObj } from "@storybook/react-vite";
import { SpecMockup } from "./mockups/SpecMockup.tsx";

const meta = {
  args: { folder: "2026-10-17-spec-mockup" },
  component: SpecMockup,
  parameters: { layout: "fullscreen" },
  title: "Mockups/Spec page",
} satisfies Meta<typeof SpecMockup>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * A spec at its second revision. On a wide screen, each part is a card: what you approve, your
 * review answered, each decision with its change, each story with its key scenarios as Given, When,
 * and Then rows, the data model as a table, then what else to weigh. The index and the verdict sit
 * in the right column. On the phone, the parts take the screen's width, without cards, each title
 * sticking at the top under its breadcrumbs.
 */
export const Waiting: Story = {};
