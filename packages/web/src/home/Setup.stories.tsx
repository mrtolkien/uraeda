// Mockups of Home's Setup pane, first on Home while a project lacks a file its setup needs: after
// `ura init`, in a repository without `specs/`, with one file left, and without the agent.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { type SetupItem, SetupPane } from "./Setup.tsx";

/** The message "Set up with the agent" puts in a new session's composer. */
const MESSAGE =
  "/uraeda Set this project up for Uraeda: write what is missing, ask me before writing the constitution, never overwrite a file.";

const CONSTITUTION: SetupItem = {
  about: "Your project's principles, written with you",
  name: "Constitution",
  state: "template",
};
const CODE_QUALITY: SetupItem = {
  about: "The limits your linters hold",
  name: "Code-quality decision",
  state: "missing",
};
const TESTING: SetupItem = {
  about: "What your tests cover at this stage",
  name: "Testing decision",
  state: "missing",
};
const PREVIEW: SetupItem = {
  about: "For a project with a UI: mockups as live stories",
  isOptional: true,
  name: "Preview decision",
  state: "missing",
};

const meta = {
  args: {
    hasAgent: true,
    items: [CONSTITUTION, CODE_QUALITY, TESTING, PREVIEW],
    message: MESSAGE,
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
      { about: "Where Uraeda keeps the workflow's files", name: "specs/ folder", state: "missing" },
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
