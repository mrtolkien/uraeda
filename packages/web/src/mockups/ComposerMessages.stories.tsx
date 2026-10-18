// TEMPORARY: mockup of the feature page redesign (specs/2026-10-18-redesign-feature/), replaced by the real page.
// The session's composer with its workflow messages, from static data.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ComposerMessages, FILLED_TEXT, MESSAGES, NOTHING } from "./ComposerMessages.tsx";

const meta = {
  args: { isMenuOpen: true, messages: MESSAGES },
  component: ComposerMessages,
  parameters: { layout: "fullscreen" },
  title: "Mockups/Session messages",
} satisfies Meta<typeof ComposerMessages>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The menu open on the two messages that apply now. */
export const Open: Story = {};

/** The comments message picked: filled, unsent, and the button says what it starts. */
export const Filled: Story = { args: { isMenuOpen: false, text: FILLED_TEXT } };

/** Nothing applies: the menu says why, and the composer still sends anything typed. */
export const Nothing: Story = { args: { messages: NOTHING } };
