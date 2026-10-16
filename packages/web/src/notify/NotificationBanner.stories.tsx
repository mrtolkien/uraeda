// Mockups of the banner asking whether Uraeda may notify this browser, above every page.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { NotificationBanner } from "./NotificationBanner.tsx";

const meta = {
  args: { onDismiss: () => {}, onTurnOn: async () => {} },
  component: NotificationBanner,
  title: "Notifications/Banner",
} satisfies Meta<typeof NotificationBanner>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The first visit in a browser that can notify, until "Turn on" or "Not now". */
export const Ask: Story = { args: { state: "ask" } };

/** After "Turn on", when the browser's question was answered "Block". */
export const Blocked: Story = { args: { state: "blocked" } };

/** After "Turn on", in a browser where pages cannot notify, like Chrome on Android. */
export const Unsupported: Story = { args: { state: "unsupported" } };
