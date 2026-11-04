// The Git page over the fixture repository's main checkout (see `.storybook/fixture.ts`): its data
// comes from Uraeda's server in Storybook, through fate. The fixture has no remote and nothing to
// commit, so the page reads "main · no remote", its history, and its worktrees; the states the
// spec names, a pull waiting, a stopped pull, an agent at work, are the mockups'
// (`GitMockups.stories.tsx`), which the shared fixture cannot show.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { inRepositoryFolder } from "../../.storybook/inRepositoryFolder.tsx";
import { atMostWidth, PHONE } from "../../.storybook/widthClass.ts";
import { GitPage } from "./GitPage.tsx";

const meta = {
  component: GitPage,
  decorators: [inRepositoryFolder],
  // The page fills the frame, as in the app's main column.
  parameters: { layout: "fullscreen" },
  title: "Git page",
} satisfies Meta<typeof GitPage>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Wide: the sections, and the first commit's files beside them. */
export const Wide: Story = {};

/** The phone: the sections alone, until a row opens its detail as a page of its own. */
export const Narrow: Story = { beforeEach: atMostWidth(PHONE) };
