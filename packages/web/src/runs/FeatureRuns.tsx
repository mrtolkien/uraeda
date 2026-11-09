// A feature's or a change's page draws its run map where its timeline was (spec of Run options,
// from the review's C2): how each step runs, and where the feature stands in them, its times, its
// files, its gates. A step that started keeps what it ran on; the steps ahead stay editable.
import { useMemo, useState } from "react";
import type { StagesHistory } from "../feature/timeline.ts";
import { Pane } from "../layout/Pane.tsx";
import { useRuntimesOn } from "../runtimes.ts";
import { type PickerRuntime, pickerRuntimes } from "../SessionPicker.tsx";
import { featureStages, type StagesFeature } from "./featureStages.ts";
import type { Pos } from "./runCursor.ts";
import { RunMap } from "./RunMap.tsx";
import { type RunOptions, STEPS, todayOptions } from "./runOptions.ts";

/** The cursor's first place: the step at work, else the first step shown. */
function startOf(stages: ReturnType<typeof featureStages>): Pos {
  const current = stages.shown.find((id) => stages.steps[id]?.state === "current");
  return { index: STEPS.indexOf(current ?? stages.shown[0]!) * 2, row: "track" };
}

/**
 * The map of `feature`, over its `history`. `options` are the feature's own, and `defaults` the
 * settings', as a story gives them.
 */
export function FeatureRuns({
  defaults,
  feature,
  history,
  options,
  runtimes: given,
}: {
  defaults?: RunOptions;
  feature: StagesFeature;
  history: StagesHistory;
  options?: RunOptions;
  runtimes?: ReadonlyArray<PickerRuntime>;
}) {
  const on = useRuntimesOn();
  const runtimes = useMemo(() => given ?? pickerRuntimes(on), [given, on]);
  // TEMPORARY: the settings' defaults and the feature's own options, which the server does not
  // keep yet (spec of Run options): today's behaviour on the first agent on, held by the page.
  const fallback = defaults ?? todayOptions(runtimes[0]?.kind ?? "claude");
  const [value, setValue] = useState(options ?? fallback);
  const stages = featureStages(feature, history);
  return (
    <Pane id="stages" title="Steps">
      <RunMap
        defaults={fallback}
        onChange={setValue}
        runtimes={runtimes}
        stages={stages}
        start={startOf(stages)}
        value={value}
      />
    </Pane>
  );
}
