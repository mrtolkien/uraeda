// Mockups of Home's Setup pane, first on Home while a project lacks a file its setup needs: after
// `ura init`, in a repository without `specs/`, with one file left, and without the agent.
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { SetupItem } from "uraeda-binding";
import { SET_UP_PROJECT } from "uraeda-server/round-messages";
import { SetupPane } from "./Setup.tsx";

const CONSTITUTION: SetupItem = {
  key: "constitution",
  name: "Constitution",
  required: true,
  state: "template",
};
const CODE_QUALITY: SetupItem = {
  key: "code-quality",
  name: "Code-quality decision",
  required: true,
  state: "missing",
};
const TESTING: SetupItem = {
  key: "testing",
  name: "Testing decision",
  required: true,
  state: "missing",
};
const PREVIEW: SetupItem = {
  key: "preview",
  name: "Preview decision",
  required: false,
  state: "missing",
};

const meta = {
  args: {
    hasAgent: true,
    items: [CONSTITUTION, CODE_QUALITY, TESTING, PREVIEW],
    message: SET_UP_PROJECT,
    onSetUp: () => {},
  },
  component: SetupPane,
  title: "Home/Setup",
} satisfies Meta<typeof SetupPane>;

export default meta;

type Story = StoryObj<typeof meta>;

/** After `ura init`: the constitution is still the template, and no decision is written. */
export const AfterInit: Story = {};

/** A repository without `specs/`: the folder comes first, and every file is missing. */
export const NoSpecs: Story = {
  args: {
    items: [
      { key: "specs", name: "specs/ folder", required: true, state: "missing" },
      { ...CONSTITUTION, state: "missing" },
      CODE_QUALITY,
      TESTING,
      PREVIEW,
    ],
  },
};

/** One file left: the others written, the preview still optional. */
export const OneLeft: Story = {
  args: {
    items: [
      { ...CONSTITUTION, state: "written" },
      { ...CODE_QUALITY, state: "written" },
      TESTING,
      PREVIEW,
    ],
  },
};

/** Without Claude Code on the machine: the message to copy, and where to install it. */
export const WithoutAgent: Story = { args: { hasAgent: false } };
