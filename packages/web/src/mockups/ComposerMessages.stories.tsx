// TEMPORARY: mockup of the feature page redesign (specs/2026-10-18-redesign-feature/), replaced by the real page.
// The session's composer with its recommended workflow message, from static data.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ComposerMessages, FILLED_TEXT, RECOMMENDED } from "./ComposerMessages.tsx";

const meta = {
  args: { recommended: RECOMMENDED },
  component: ComposerMessages,
  parameters: { layout: "fullscreen" },
  title: "Mockups/Session messages",
} satisfies Meta<typeof ComposerMessages>;

export default meta;

type Story = StoryObj<typeof meta>;

/** One message applies: a button inserts it, named by what it asks. */
export const Recommended: Story = {};

/** The message inserted: unsent, and the button says what it starts. */
export const Filled: Story = { args: { text: FILLED_TEXT } };

/** Nothing applies: no button, a line saying why; anything typed still sends. */
export const Nothing: Story = { args: { recommended: undefined } };
