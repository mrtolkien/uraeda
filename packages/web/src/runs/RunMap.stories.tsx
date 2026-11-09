// Run options' mockups (spec of Run options): the run map in the settings' Runs section, on the
// defaults and changed; the picker open on a step; a joint selected, cut, and a cut the models
// force; the strip in a feature's and a change's start dialog; a feature's page, in place of its
// timeline, its build at work, on the phone, merged, and a change's; and the settings on the phone. Built from the real components over the runtimes Claude Code and
// Codex listed on 2026-11-08, with no server: the stories show the look and the keys.
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { useState } from "react";
import { atMostWidth, PHONE } from "../../.storybook/widthClass.ts";
import { inRepositoryFolder } from "../../.storybook/inRepositoryFolder.tsx";
import { Page } from "../layout/Page.tsx";
import { Pane } from "../layout/Pane.tsx";
import { CLAUDE, CODEX } from "../sampleRuntimes.ts";
import { StartDialog } from "../StartDialog.tsx";
import type { Pos } from "./runCursor.ts";
import { RunMap } from "./RunMap.tsx";
import type { RunOptions } from "./runOptions.ts";
import { RunStrip } from "./RunStrip.tsx";
import { FeatureRuns } from "./FeatureRuns.tsx";
import { BUILDING, CHANGE, MERGED } from "./sampleStages.ts";

const RUNTIMES = [CLAUDE, CODEX];

const CLAUDE_DEFAULT = { runtime: "claude" };

/** Today's behaviour as defaults: one session to the spec, a clean one for the build on. */
const DEFAULTS: RunOptions = {
  cuts: [2],
  depth: "waves",
  implementers: CLAUDE_DEFAULT,
  reviewers: [{ kind: "agent", pick: CLAUDE_DEFAULT }],
  steps: {
    build: CLAUDE_DEFAULT,
    comments: CLAUDE_DEFAULT,
    discovery: CLAUDE_DEFAULT,
    plan: CLAUDE_DEFAULT,
    review: CLAUDE_DEFAULT,
    spec: CLAUDE_DEFAULT,
  },
};

const OPUS_HIGH = { effort: "high", model: "opus", runtime: "claude" };
const SONNET = { effort: "medium", model: "sonnet", runtime: "claude" };

/** Strong thinking, a cheaper build, and three reviewers, one of them Codex's own review. */
const CUSTOM: RunOptions = {
  cuts: [2],
  depth: "waves",
  implementers: { effort: "low", model: "sonnet", runtime: "claude" },
  reviewers: [
    { kind: "agent", pick: OPUS_HIGH },
    {
      kind: "agent",
      ownReview: true,
      pick: { effort: "high", model: "gpt-6.1-sol", runtime: "codex" },
    },
    { command: "coderabbit review --plain", kind: "command" },
  ],
  steps: {
    build: SONNET,
    comments: SONNET,
    discovery: OPUS_HIGH,
    plan: { effort: "xhigh", model: "opus", runtime: "claude" },
    review: SONNET,
    spec: OPUS_HIGH,
  },
};

/** The map holding its options, as the Runs section holds the saved ones. */
function Map({
  opened,
  start,
  value,
}: {
  opened?: "model" | "effort";
  start?: Pos;
  value: RunOptions;
}) {
  const [options, setOptions] = useState(value);
  return (
    <Pane title="How each step runs">
      <RunMap
        defaults={DEFAULTS}
        onChange={setOptions}
        runtimes={RUNTIMES}
        value={options}
        {...(opened ? { opened } : {})}
        {...(start ? { start } : {})}
      />
    </Pane>
  );
}

/** A feature's page's map, in the page's measure, as it stands where the timeline was. */
function OnPage({ children }: { children: ReactNode }) {
  return <Page kind="rows">{children}</Page>;
}

/** The strip in the start dialog, holding its options. */
function Start({ isChange = false, value }: { isChange?: boolean; value: RunOptions }) {
  const [options, setOptions] = useState(value);
  return (
    <StartDialog
      initial={isChange ? "tasks-reappear" : "recurring-tasks"}
      isOpen
      onCancel={() => {}}
      onConfirm={async () => undefined}
      question={{
        confirm: isChange ? "Start the change" : "Start the feature",
        description: "Names its folder and its branch.",
        label: "Slug",
        title: isChange ? "Start a change" : "Start a feature",
      }}
      runs={
        <RunStrip
          defaults={DEFAULTS}
          isChange={isChange}
          onChange={setOptions}
          runtimes={RUNTIMES}
          value={options}
        />
      }
      {...(isChange ? {} : { effort: { initial: "high", levels: ["low", "medium", "high"] } })}
    />
  );
}

const meta = {
  args: { value: DEFAULTS },
  component: Map,
  parameters: { layout: "padded" },
  title: "Run options",
} satisfies Meta<typeof Map>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The settings on the defaults: discovery and spec share a session, a clean one starts at the plan. */
export const SettingsDefaults: Story = {};

/** The settings changed: Opus thinks, Sonnet builds on cheap implementers, three reviewers. */
export const SettingsCustom: Story = { args: { value: CUSTOM } };

/** Enter on the spec: the key picker, the agent and model first. */
export const StepPicking: Story = {
  args: { opened: "model", start: { index: 2, row: "track" }, value: CUSTOM },
};

/** The joint between discovery and spec selected and cut: the spec starts a clean session. */
export const JointSelected: Story = {
  args: { start: { index: 1, row: "track" }, value: { ...CUSTOM, cuts: [1, 2] } },
};

/** The joint between plan and build: the models differ, so the cut is locked. */
export const ForcedCut: Story = { args: { start: { index: 5, row: "track" }, value: CUSTOM } };

/** A reviewer selected, under the review: its keys in the hints. */
export const ReviewerSelected: Story = {
  args: { start: { index: 2, row: "below" }, value: CUSTOM },
};

/**
 * A feature's page, its build at work on task 4 of 9: the proposal and the steps before it done,
 * timed, their files linked, the gates passed; the steps ahead still editable.
 */
export const FeaturePage: Story = {
  decorators: [inRepositoryFolder],
  render: () => (
    <OnPage>
      <FeatureRuns defaults={DEFAULTS} options={CUSTOM} runtimes={RUNTIMES} {...BUILDING} />
    </OnPage>
  ),
};

/** The same page on the phone: the column, its ends at the top and the bottom. */
export const FeaturePagePhone: Story = { ...FeaturePage, beforeEach: atMostWidth(PHONE) };

/** A merged feature: every step done, the merge at the end, nothing to edit. */
export const FeatureDone: Story = {
  decorators: [inRepositoryFolder],
  render: () => (
    <OnPage>
      <FeatureRuns defaults={DEFAULTS} options={CUSTOM} runtimes={RUNTIMES} {...MERGED} />
    </OnPage>
  ),
};

/** A change's page: its questions, its fix waiting on your review of its pull request. */
export const FeatureChange: Story = {
  decorators: [inRepositoryFolder],
  render: () => (
    <OnPage>
      <FeatureRuns defaults={DEFAULTS} options={DEFAULTS} runtimes={RUNTIMES} {...CHANGE} />
    </OnPage>
  ),
};

/** The settings on the phone: the track stands as a column. */
export const Phone: Story = { args: { value: CUSTOM }, beforeEach: atMostWidth(PHONE) };

/** A feature's start dialog, on the defaults. */
export const StartFeatureDefaults: Story = { render: () => <Start value={DEFAULTS} /> };

/** A feature's start dialog, its spec moved to Opus, high. */
export const StartFeatureChanged: Story = {
  render: () => <Start value={{ ...DEFAULTS, steps: { ...DEFAULTS.steps, spec: OPUS_HIGH } }} />,
};

/** A change's start dialog: its one step and its reviewers. */
export const StartChange: Story = {
  render: () => (
    <Start
      isChange
      value={{
        ...DEFAULTS,
        reviewers: CUSTOM.reviewers,
        steps: { ...DEFAULTS.steps, build: SONNET },
      }}
    />
  ),
};
