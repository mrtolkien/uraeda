// What a session runs on, as Codex runtime + model settings built it: the button in a
// composer, and the app's key picker it opens, the model then the effort, over the models and the
// efforts Claude Code and Codex listed on this machine on 2026-11-08; the effort alone in a session
// that runs already; and a session's header once it ran, naming its model and effort.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { userEvent, within } from "storybook/test";
import { SessionHeader } from "./SessionHeader.tsx";
import { CLAUDE, CODEX } from "./sampleRuntimes.ts";
import { type PickerRuntime, type SessionPick, SessionPicker } from "./SessionPicker.tsx";

/** The picker, holding its pick as a composer does. */
function Picker({
  isStarted,
  runtimes,
  step,
  value,
}: {
  isStarted?: boolean;
  runtimes: ReadonlyArray<PickerRuntime>;
  step?: "model" | "effort";
  value?: SessionPick;
}) {
  const [pick, setPick] = useState(value);
  return (
    <SessionPicker
      onChange={setPick}
      runtimes={runtimes}
      value={pick}
      {...(isStarted ? { isStarted } : {})}
      {...(step ? { step } : {})}
    />
  );
}

const meta = {
  args: { runtimes: [CLAUDE, CODEX] },
  component: Picker,
  parameters: { layout: "fullscreen" },
  title: "Session picker",
} satisfies Meta<typeof Picker>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Nothing picked yet: the first agent on, on its defaults, named as they resolve. */
export const Defaults: Story = {};

/** Codex picked, on a model and an effort of its own. */
export const Picked: Story = {
  args: { value: { effort: "high", model: "gpt-6-astra", runtime: "codex" } },
};

/** The first step, `Space a` or the button: every agent's models, each agent's Default first. */
export const ModelStep: Story = { args: { step: "model", value: { runtime: "codex" } } };

/** The first step, "luna" typed: the models matching, the first under the cursor. */
export const ModelSearch: Story = {
  args: { step: "model" },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.type(await body.findByRole("combobox", { name: "Find a model" }), "luna");
  },
};

/** The second step, after GPT-6-Astra: its efforts, Default first. */
export const EffortStep: Story = {
  args: { step: "effort", value: { model: "gpt-6-astra", runtime: "codex" } },
};

/** One agent on: the first step lists its models alone. */
export const OneAgent: Story = { args: { runtimes: [CLAUDE], step: "model" } };

/** A session that runs already: the button names the effort, and opens the second step alone. */
export const Started: Story = {
  args: { isStarted: true, value: { effort: "high", model: "sonnet", runtime: "claude" } },
};

/** A model that takes no effort: the button names none, and no second step follows its pick. */
export const NoEffort: Story = {
  args: { value: { model: "claude-haiku-4-5-20251001", runtime: "claude" } },
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
