// Mockups of what a new session runs on, as Codex runtime + model settings plans it: the picker in
// a composer that makes a session, closed and open, over the models Claude Code and Codex listed on
// this machine on 2026-11-08; and a session's header once it ran, naming its model and effort.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { userEvent, within } from "storybook/test";
import { SessionHeader } from "./SessionHeader.tsx";
import { type PickerRuntime, type SessionPick, SessionPicker } from "./SessionPicker.tsx";

const CLAUDE_EFFORTS = [
  { id: "low", name: "Low" },
  { id: "medium", name: "Medium" },
  { id: "high", name: "High" },
  { id: "xhigh", name: "Extra high" },
  { id: "max", name: "Max" },
];

const CODEX_EFFORTS = [...CLAUDE_EFFORTS, { id: "ultra", name: "Ultra" }];

/** Claude Code, as `list_models` gave it: the aliases, then a pinned model without efforts. */
const CLAUDE: PickerRuntime = {
  defaults: { effort: "medium", model: "opus" },
  icon: "uraeda:harness-claude",
  kind: "claude",
  models: [
    { description: "Opus 5.5", efforts: CLAUDE_EFFORTS, id: "opus", name: "Opus" },
    { description: "Fable 5.1", efforts: CLAUDE_EFFORTS, id: "fable", name: "Fable" },
    { description: "Sonnet 5.5", efforts: CLAUDE_EFFORTS, id: "sonnet", name: "Sonnet" },
    { description: "Haiku 5.5", efforts: CLAUDE_EFFORTS, id: "haiku", name: "Haiku" },
    { efforts: [], id: "claude-haiku-4-5-20251001", name: "Haiku 4.5" },
  ],
  name: "Claude Code",
};

/** Codex, as `model/list` gave it, its hidden models left out. */
const CODEX: PickerRuntime = {
  defaults: { effort: "medium", model: "gpt-6.1-sol" },
  icon: "uraeda:harness-openai",
  kind: "codex",
  models: [
    {
      description: "Latest workhorse model for coding and everyday work.",
      efforts: CODEX_EFFORTS,
      id: "gpt-6.1-sol",
      name: "GPT-6.1-Sol",
    },
    {
      description: "Frontier intelligence for the most demanding work.",
      efforts: CODEX_EFFORTS,
      id: "gpt-6-astra",
      name: "GPT-6-Astra",
    },
    {
      description: "Fast and affordable model for easier tasks.",
      efforts: CLAUDE_EFFORTS,
      id: "gpt-6-luna",
      name: "GPT-6-Luna",
    },
  ],
  name: "Codex",
};

/** The picker, holding its pick as a composer does. */
function Picker({
  runtimes,
  value,
}: {
  runtimes: ReadonlyArray<PickerRuntime>;
  value?: SessionPick;
}) {
  const [pick, setPick] = useState(value);
  return <SessionPicker onChange={setPick} runtimes={runtimes} value={pick} />;
}

const meta = {
  args: { runtimes: [CLAUDE, CODEX] },
  component: Picker,
  title: "Session picker",
} satisfies Meta<typeof Picker>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Nothing picked yet: the first agent on, on its defaults, named as they resolve. */
export const Defaults: Story = {};

/** One agent on: the button still names the model and the effort, and the menu has no Agent group. */
export const OneAgent: Story = { args: { runtimes: [CLAUDE] } };

/** Codex picked, on a model and an effort of its own. */
export const Picked: Story = {
  args: { value: { effort: "high", model: "gpt-6-astra", runtime: "codex" } },
};

/** Open: the agents, then the agent's models, Default first, then the model's efforts. */
export const Open: Story = {
  args: { value: { runtime: "codex" } },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button"));
  },
};

/** A model that takes no effort: the menu has no Effort group, and the button names none. */
export const NoEffort: Story = {
  args: { value: { model: "claude-haiku-4-5-20251001", runtime: "claude" } },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button"));
  },
};

/** A session's header once it ran: the agent, then the model and the effort it reported. */
export const Header: Story = {
  render: () => (
    <SessionHeader
      agent="codex"
      place="Codex runtime + model settings"
      runsOn="GPT-6.1-Sol · Medium"
      title="Write the spec"
    />
  ),
};
