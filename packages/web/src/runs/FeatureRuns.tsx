// A feature's or a change's page draws its run map where its timeline was (spec of Run options,
// from the review's C2): how each step runs, and where the feature stands in them, its times, its
// files, its gates. A step that started keeps what it ran on; the steps ahead stay editable. The
// map reads the feature's own options over the settings', and saves what differs from the
// settings' as the feature's, from its next run on.
import { useMemo, useState } from "react";
import { useFateClient } from "react-fate";
import { useSettings } from "../data.ts";
import { refusal } from "../errors.ts";
import type { StagesHistory } from "../feature/timeline.ts";
import { AnnouncedBanner } from "../layout/AnnouncedBanner.tsx";
import { Pane } from "../layout/Pane.tsx";
import { useRuntimesOn } from "../runtimes.ts";
import { type PickerRuntime, pickerRuntimes } from "../SessionPicker.tsx";
import { FeatureView } from "../views.ts";
import { featureStages, type StagesFeature } from "./featureStages.ts";
import type { Pos } from "./runCursor.ts";
import { RunMap } from "./RunMap.tsx";
import {
  fromStored,
  overSettings,
  type RunOptions,
  STEPS,
  type StoredOptions,
  toSaved,
} from "./runOptions.ts";

/** The cursor's first place: the step at work, else the first step shown. */
function startOf(stages: ReturnType<typeof featureStages>): Pos {
  const current = stages.shown.find((id) => stages.steps[id]?.state === "current");
  return { index: STEPS.indexOf(current ?? stages.shown[0]!) * 2, row: "track" };
}

/**
 * The map of `feature`, over its `history`: its options `value`, marked where they differ from the
 * settings' `defaults`, on the agents `runtimes`, each change given to `onChange`, and its
 * `refused` save under it.
 */
export function FeatureRunMap({
  defaults,
  feature,
  history,
  onChange,
  refused,
  runtimes,
  value,
}: {
  defaults: RunOptions;
  feature: StagesFeature;
  history: StagesHistory;
  onChange: (value: RunOptions) => void;
  refused?: string | undefined;
  runtimes: ReadonlyArray<PickerRuntime>;
  value: RunOptions;
}) {
  const stages = featureStages(feature, history);
  return (
    <Pane id="stages" title="Steps">
      <RunMap
        defaults={defaults}
        onChange={onChange}
        runtimes={runtimes}
        stages={stages}
        start={startOf(stages)}
        value={value}
      />
      {refused && <AnnouncedBanner collapsible={false} status="error" title={refused} />}
    </Pane>
  );
}

/**
 * The map of `feature`, over its `history`, on the agents on here: its own options, `runOptions`,
 * over the settings' run options; a change saved as the feature's at once, shown before the server
 * answers, with its refusal.
 */
export function FeatureRuns({
  feature,
  history,
}: {
  feature: StagesFeature & { folder: string; id: string; runOptions: StoredOptions };
  history: StagesHistory;
}) {
  const fate = useFateClient();
  const runtimes = pickerRuntimes(useRuntimesOn());
  const saved = useSettings()?.runs.options;
  // With no agent on, the map still draws the feature's steps, on today's first agent.
  const fallback = runtimes[0]?.kind ?? "claude";
  const defaults = useMemo(() => fromStored(saved ?? { steps: [] }, fallback), [fallback, saved]);
  const value = useMemo(
    () => overSettings(defaults, feature.runOptions),
    [defaults, feature.runOptions],
  );
  const [refused, setRefused] = useState<string>();
  const save = async (next: RunOptions) => {
    setRefused(undefined);
    const options = toSaved(next, defaults);
    const result = await fate.mutations.feature.setRunOptions({
      input: { folder: feature.folder, options },
      optimistic: { id: feature.id, runOptions: options },
      view: FeatureView,
    });
    if (result.error) {
      setRefused(refusal(result.error).message);
    }
  };
  return (
    <FeatureRunMap
      defaults={defaults}
      feature={feature}
      history={history}
      onChange={(next) => void save(next)}
      refused={refused}
      runtimes={runtimes}
      value={value}
    />
  );
}
