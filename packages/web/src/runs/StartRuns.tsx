// The run map of a start dialog: how the feature or the change it starts runs, on the settings'
// run options and the runtimes on here, changed for this start alone. The start sends only what
// differs from the settings, so every value left alone follows them, as they are at each run.
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { type ReactNode, useState } from "react";
import type { RunOptions as StoredOptions } from "uraeda-binding";
import { toMap } from "uraeda-server/run-options";
import { useSettings } from "../data.ts";
import { useWidthClass } from "../layout/useWidthClass.ts";
import { useRuntimesOn } from "../runtimes.ts";
import { pickerRuntimes } from "../SessionPicker.tsx";
import { RunMap } from "./RunMap.tsx";
import { type RunOptions, toSaved } from "./runOptions.ts";

/** Whether a start dialog's map is a column: a change's, and a feature's wherever the screen is not wide. */
export function useStartColumn(isChange: boolean) {
  return useWidthClass() !== "wide" || isChange;
}

/**
 * The map of a start dialog, under its name; a change's with `isChange`, which draws its fix and its
 * reviewers alone. A row of six steps on wide screens; a column on semi-wide ones, where the dialog
 * has no room for six tiles read whole, as on the phone.
 */
export function StartMap(props: Parameters<typeof RunMap>[0]) {
  const isColumn = useStartColumn(props.isChange === true);
  return (
    <VStack gap={2}>
      <Text color="secondary">{props.isChange ? "How the change runs" : "How each step runs"}</Text>
      <RunMap {...props} isColumn={isColumn} />
    </VStack>
  );
}

/**
 * The map of a start dialog, a change's with `isChange`, and `options`, what the start sends: the
 * options changed on the map that differ from the settings', or undefined while nothing was
 * changed, or no runtime is on or the settings have not loaded, when the map is not drawn: a
 * change is only ever made, and diffed, over the settings as they are.
 */
export function useStartRuns(isChange = false): {
  map: ReactNode;
  options: StoredOptions | undefined;
} {
  const runtimes = pickerRuntimes(useRuntimesOn());
  const saved = useSettings()?.runs.options;
  const fallback = runtimes[0]?.kind;
  const defaults: RunOptions | undefined =
    fallback === undefined || saved === undefined ? undefined : toMap(saved, fallback);
  // Unset until the map changes something: the defaults follow the settings as they change.
  const [changed, setChanged] = useState<RunOptions>();
  if (defaults === undefined) {
    return { map: null, options: undefined };
  }
  const value = changed ?? defaults;
  return {
    map: (
      <StartMap
        defaults={defaults}
        isChange={isChange}
        onChange={setChanged}
        runtimes={runtimes}
        value={value}
      />
    ),
    options: changed === undefined ? undefined : toSaved(runtimes, changed, defaults),
  };
}
