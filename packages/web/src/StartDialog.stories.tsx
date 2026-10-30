// The New page's start dialog, as `Ctrl+Enter` opens it over the composer: a change's slug, and a
// feature's slug with its research effort under it, High picked first, as a proposal without the
// field reads; and a feature's slug refused as taken, its text kept.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { inRepositoryFolder } from "../.storybook/inRepositoryFolder.tsx";
import { type Effort, type Question, StartDialog } from "./StartDialog.tsx";

/** The research efforts, as the proposal's `discovery` field holds them. */
const EFFORT: Effort = { initial: "high", levels: ["low", "medium", "high"] };

const CHANGE: Question = {
  confirm: "Start the change",
  description: "Two words at most: it names the folder and the branch.",
  label: "Slug",
  title: "Name the change",
};

const FEATURE: Question = {
  confirm: "Start the feature",
  description: "Two words at most: it names the folder and the branch.",
  label: "Slug",
  title: "Name the feature",
};

const meta = {
  args: {
    initial: "dark-mode",
    isOpen: true,
    onCancel: () => {},
    onConfirm: async () => undefined,
    question: FEATURE,
  },
  component: StartDialog,
  decorators: [inRepositoryFolder],
  title: "New page/Start dialog",
} satisfies Meta<typeof StartDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A change: the slug the core proposes for the text, alone. */
export const NameTheChange: Story = { args: { initial: "centre-x", question: CHANGE } };

/** A feature: the slug, then its research effort, High picked; Enter starts it. */
export const NameTheFeature: Story = { args: { effort: EFFORT } };

/** A feature's slug already taken: the reason under the field, the dialog open, the text kept. */
export const FeatureSlugTaken: Story = {
  args: { effort: EFFORT, error: "A feature named dark-mode exists already." },
};
