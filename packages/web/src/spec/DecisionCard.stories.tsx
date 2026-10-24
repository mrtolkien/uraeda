// A decision's pane on the spec page, its change as a ledger, as the app draws it, over the spec
// page's feature that `addSpecFeature` builds from `fixtures/spec-page/` (see
// `.storybook/fixture.ts`): the change its branch makes, which the core compares with the default
// branch, from Uraeda's server in Storybook.
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
 * Task storage's change, in a mauve pane: the changed rules first, a reworded rule signed `~` with
 * its added words underlined and its removed words struck, the rule merged away signed `−`, then
 * the unchanged rules folded under their count, and the other sections under "Why, alternatives,
 * consequences · N changed".
 */
export const Change: Story = {};

/** Repeating tasks, new on the branch, in a green pane: its rules read plain, each signed `+`. */
export const New: Story = { args: { name: "repeating-tasks" } };
