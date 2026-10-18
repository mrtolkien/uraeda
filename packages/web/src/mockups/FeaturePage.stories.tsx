// TEMPORARY: mockup of the feature page redesign (specs/2026-10-18-redesign-feature/), replaced by the real page.
// Each state of the planned feature page, from static data. The done page's decisions are the app's
// own decision cards, over the spec page's fixture feature, from Uraeda's server in Storybook.
import { VStack } from "@astryxdesign/core/VStack";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { SPEC_PAGES } from "../../.storybook/checkouts.ts";
import { inRepositoryFolder } from "../../.storybook/inRepositoryFolder.tsx";
import { useBranchDecision } from "../data.ts";
import { DecisionCard } from "../spec/DecisionCard.tsx";
import { decisionId, GROUPS } from "../spec/parts.ts";
import { BLOCKED, DONE, DONE_CHANGE, PULL_REQUEST, WAITING, WORKING } from "./featureMockupData.ts";
import { FeaturePageMockup } from "./FeaturePageMockup.tsx";

/** A decision's card, as the spec page draws it: its change against the default branch. */
function RecordDecision({ name }: { name: string }) {
  const decision = useBranchDecision(SPEC_PAGES.waiting, name);
  if (!decision || decision.missing) {
    return null;
  }
  const { change } = decision;
  return (
    <DecisionCard
      change={change}
      comments={[]}
      crumbs={[GROUPS.decisions.title]}
      href={undefined}
      id={decisionId(name)}
      kind={change.kind}
      name={name}
      parts={undefined}
      title={change.title}
    />
  );
}

const meta = {
  args: { feature: WORKING },
  component: FeaturePageMockup,
  parameters: { layout: "fullscreen" },
  title: "Mockups/Feature page",
} satisfies Meta<typeof FeaturePageMockup>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The agent builds task 7 of 11; three format notes, folded. */
export const Working: Story = {};

/** The spec waits for your review: "Next" holds its one button, the agent rests beside it. */
export const WaitingOnYou: Story = { args: { feature: WAITING } };

/** The pull request is open: "Next" opens it; the session's recommended message covers comments. */
export const PullRequest: Story = { args: { feature: PULL_REQUEST } };

/** A status the workflow cannot read: the one problem that blocks, above "Next". */
export const Blocked: Story = { args: { feature: BLOCKED } };

/**
 * The clarifications redesign, merged: every stage timed, figures that lead to their detail, and
 * the record in place, its decisions drawn as the spec page draws them. The cards come from the
 * fixture's todo app, standing in for the redesign's own two decisions.
 */
export const Done: Story = {
  args: {
    decisions: (
      <VStack gap={4}>
        <RecordDecision name="repeating-tasks" />
        <RecordDecision name="task-storage" />
      </VStack>
    ),
    feature: DONE,
  },
  decorators: [inRepositoryFolder],
};

/** A change, merged before tokens were recorded: fewer stages, and no questions. */
export const DoneChange: Story = { args: { feature: DONE_CHANGE } };
