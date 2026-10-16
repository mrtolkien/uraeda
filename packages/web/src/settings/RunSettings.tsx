// The Runs category: whether the run after a spec's approval starts in a fresh session, the
// default the approval's own switch starts from, then the run settings later features bring.
import { Banner } from "@astryxdesign/core/Banner";
import { Heading } from "@astryxdesign/core/Heading";
import { Switch } from "@astryxdesign/core/Switch";
import { VStack } from "@astryxdesign/core/VStack";
import { useState } from "react";
import type { Category } from "./categories.ts";
import { PlannedList } from "./OtherSettings.tsx";
import { FileProblem, type ServerActions, type ServerValues } from "./ServerSettings.tsx";

/** The Runs category, read-only with its problem when the file cannot be read. */
export function RunSettings({
  actions,
  category,
  values,
}: {
  actions: ServerActions;
  category: Category;
  values: ServerValues;
}) {
  const [refused, setRefused] = useState<string>();
  if (values.problem) {
    return <FileProblem label={category.label} problem={values.problem} />;
  }
  const { buildInFreshSession } = values.runs;
  return (
    <VStack gap={6}>
      <Heading level={2}>{category.label}</Heading>
      <VStack gap={2}>
        <Switch
          description="When a spec is approved, the plan and the build start in a new agent session instead of continuing the one that wrote the spec. Each approval can change it for its run. A change applies at once."
          label="Build in a fresh session"
          onChange={async (fresh: boolean) => {
            setRefused(undefined);
            setRefused(await actions.setBuildInFreshSession(fresh));
          }}
          value={buildInFreshSession.inForce}
        />
        {refused && <Banner collapsible={false} status="error" title={refused} />}
      </VStack>
      <PlannedList category={category} />
    </VStack>
  );
}
