// Mockup of one question of a decisions check, as the questions view draws it: two decisions that
// say one thing, and the option that merges them shown as the spec page shows a changed decision,
// from the default branch's text to the candidate's.
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { DecisionChange, Run } from "uraeda-binding";
import { DecisionCard } from "../spec/DecisionCard.tsx";

const kept = (text: string): Array<Run> => [{ kind: "kept", text }];

const CHANGE: DecisionChange = {
  compared: true,
  fields: [],
  kind: "changed",
  listed: true,
  name: "ui-components",
  sections: [
    {
      parts: [
        {
          check: [],
          kind: "kept",
          runs: kept("The web UI looks and behaves as one product, built from one design system."),
        },
      ],
      title: "",
    },
    {
      parts: [
        {
          check: kept("review."),
          kind: "added",
          runs: [
            {
              kind: "added",
              text: "A kind of information MUST be drawn by one shared component on every page.",
            },
          ],
          strength: "must",
        },
        {
          check: kept("lint."),
          kind: "removed",
          runs: [
            {
              kind: "removed",
              text: "Components MUST NOT take a style prop, and only Astryx's stylesheets MAY be imported.",
            },
          ],
          strength: "must-not",
        },
      ],
      title: "Rules",
    },
  ],
  title: "UI components",
};

function CheckQuestion() {
  return (
    <VStack gap={4}>
      <Heading level={3}>Q2: UI components and UI coherence both say how views are drawn</Heading>
      <Text>
        Both decisions require shared components. Keeping one home for the rule means merging them.
      </Text>
      <Heading level={4}>B. Merge the coherence rule into UI components</Heading>
      <DecisionCard
        change={CHANGE}
        comments={[]}
        crumbs={["Option B"]}
        href={undefined}
        id="option-b"
        kind="changed"
        name="ui-components"
        parts={undefined}
        title="UI components"
      />
    </VStack>
  );
}

const meta = {
  component: CheckQuestion,
  title: "Decisions/Check question mockup",
} satisfies Meta<typeof CheckQuestion>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A question of the check: its option shows the candidate decision as a diff against the active one. */
export const Option: Story = {};
