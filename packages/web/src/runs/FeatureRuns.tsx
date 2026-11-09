// A feature's or a change's page draws its run map where its timeline was (spec of Run options,
// from the review's C2): how each step runs, and where the feature stands in them, its times, its
// files, its gates. A step that started keeps what it ran on; the steps ahead stay editable. The
// map draws the feature's options as its record carries them, merged over the settings' by the
// core, and saves what differs from the settings' as the feature's, from its next run on.
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
import { fromStored, type RunOptions, STEPS, type StoredOptions, toSaved } from "./runOptions.ts";

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

/** A feature as its map reads it: its record's run options, its own and their merge. */
type RunsFeature = StagesFeature & {
  folder: string;
  id: string;
  runOptions: { merged: StoredOptions; own: StoredOptions };
};

/**
 * The saves of `feature`'s options: each edit's map is shown until its save answers. Gives the map
 * shown while a save goes, `pending`, the save's refusal, and `save`.
 */
function useSaves(feature: RunsFeature) {
  const fate = useFateClient();
  const [pending, setPending] = useState<RunOptions>();
  const [refused, setRefused] = useState<string>();
  const save = async (next: RunOptions, options: StoredOptions) => {
    setPending(next);
    setRefused(undefined);
    const result = await fate.mutations.feature.setRunOptions({
      input: { folder: feature.folder, options },
      view: FeatureView,
    });
    setPending(undefined);
    if (result.error) {
      setRefused(refusal(result.error).message);
    }
  };
  return { pending, refused, save };
}

/**
 * The map of `feature`, over its `history`, on the agents on here: its options as its record
 * merges them, against the settings' run options; a change saved as the feature's at once, shown
 * before the server answers, with its refusal.
 */
export function FeatureRuns({
  feature,
  history,
}: {
  feature: RunsFeature;
  history: StagesHistory;
}) {
  const runtimes = pickerRuntimes(useRuntimesOn());
  const saved = useSettings()?.runs.options;
  // With no agent on, the map still draws the feature's steps, on today's first agent.
  const fallback = runtimes[0]?.kind ?? "claude";
  const defaults = useMemo(() => fromStored(saved ?? { steps: [] }, fallback), [fallback, saved]);
  const merged = useMemo(
    () => fromStored(feature.runOptions.merged, fallback),
    [fallback, feature.runOptions.merged],
  );
  const { pending, refused, save } = useSaves(feature);
  return (
    <FeatureRunMap
      defaults={defaults}
      feature={feature}
      history={history}
      onChange={(next) => void save(next, toSaved(next, defaults))}
      refused={refused}
      runtimes={runtimes}
      value={pending ?? merged}
    />
  );
}
