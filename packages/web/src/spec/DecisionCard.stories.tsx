// A decision's card on the spec page, as the app draws it, over the spec page's feature that
// `addSpecFeature` builds from `fixtures/spec-page/` (see `.storybook/fixture.ts`): the change its
// branch makes, which the core compares with the default branch, from Uraeda's server in Storybook.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { SPEC_PAGES } from "../../.storybook/checkouts.ts";
import { inRepositoryFolder } from "../../.storybook/inRepositoryFolder.tsx";
import { useBranchDecision } from "../data.ts";
import { DecisionCard } from "./DecisionCard.tsx";
import { decisionId, GROUPS } from "./parts.ts";

/** The card of decision `name` as the spec page of the feature in `folder` draws it. */
function SpecDecisionCard({ folder, name }: { folder: string; name: string }) {
  const decision = useBranchDecision(folder, name);
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
  args: { folder: SPEC_PAGES.waiting, name: "task-storage" },
  component: SpecDecisionCard,
  decorators: [inRepositoryFolder],
  title: "Decision card",
} satisfies Meta<typeof SpecDecisionCard>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Task storage's change: a reworded rule with its words marked, the unchanged parts folded behind
 * their count, and the rule merged away folded as "1 removed". Each rule's icon takes its
 * strength's colour, and the card has no side bar.
 */
export const Change: Story = {};

/** Repeating tasks, new on the branch: its intent and its rules, unmarked, under "New". */
export const New: Story = { args: { name: "repeating-tasks" } };
