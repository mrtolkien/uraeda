// Mockup of the decisions page's open decision once its rules are drawn as the spec page draws
// them: the strength's icon, the rule's words, and how it is checked on a muted line. The words are
// the new "UI coherence" decision's.
import { Heading } from "@astryxdesign/core/Heading";
import { VStack } from "@astryxdesign/core/VStack";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Run } from "uraeda-binding";
import { PartText } from "../spec/RuleLine.tsx";

const kept = (text: string): Array<Run> => [{ kind: "kept", text }];

const RULES = [
  {
    check: "review.",
    strength: "must",
    text: "A kind of information MUST be drawn by one shared component on every page that shows it.",
  },
  {
    check: "review.",
    strength: "must-not",
    text: "A page MUST NOT present information its own way, unless the plan names an extremely good reason and the human approves it.",
  },
  {
    check: "review.",
    strength: "should",
    text: "A change to how information is drawn SHOULD be made in its shared component, so every page follows.",
  },
];

function DecisionRules() {
  return (
    <VStack gap={4}>
      <Heading level={2}>UI coherence</Heading>
      <PartText
        check={[]}
        intent
        runs={kept(
          "The same information looks the same wherever the UI shows it, drawn by one shared component.",
        )}
        strength={undefined}
        whole={false}
      />
      <Heading level={3}>Rules</Heading>
      {RULES.map((rule) => (
        <PartText
          check={kept(rule.check)}
          intent={false}
          key={rule.text}
          runs={kept(rule.text)}
          strength={rule.strength}
          whole={false}
        />
      ))}
    </VStack>
  );
}

const meta = {
  component: DecisionRules,
  title: "Decisions/Rules mockup",
} satisfies Meta<typeof DecisionRules>;

export default meta;

type Story = StoryObj<typeof meta>;

/** An open decision on the decisions page: its intent, then its rules with their strength icons. */
export const Open: Story = {};
