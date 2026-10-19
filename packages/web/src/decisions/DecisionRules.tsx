// A decision's rules in the pane, as the spec page draws them: each rule's strength icon, its
// words, and how it is checked on a muted line, with `PartText` of the spec page.
import { VStack } from "@astryxdesign/core/VStack";
import type { PartChange } from "uraeda-binding";
import { PartText } from "../spec/RuleLine.tsx";

/** The kept parts of a decision's `## Rules` section, each drawn once under the pane's heading. */
export function DecisionRules({ parts }: { parts: ReadonlyArray<PartChange> }) {
  return (
    <VStack gap={3}>
      {parts.map((part, index) => (
        <PartText
          check={part.check}
          intent={false}
          key={index}
          runs={part.runs}
          strength={part.strength}
          whole={false}
        />
      ))}
    </VStack>
  );
}
