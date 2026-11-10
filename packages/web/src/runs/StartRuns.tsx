// The run strip of a start dialog: how the feature or the change it starts runs, on the settings'
// run options and the runtimes on here, changed for this start alone. The start sends only what
// differs from the settings, so every value left alone follows them, as they are at each run.
import { type ReactNode, useMemo, useState } from "react";
import type { RunOptions as StoredOptions } from "uraeda-binding";
import { toMap, toStored } from "uraeda-server/run-options";
import { useSettings } from "../data.ts";
import { useRuntimesOn } from "../runtimes.ts";
import { pickerRuntimes } from "../SessionPicker.tsx";
import type { RunOptions } from "./runOptions.ts";
import { RunStrip } from "./RunStrip.tsx";

/**
 * The strip of a start dialog, a change's with `isChange`, and `options`, what the start sends: the
 * options changed on the strip that differ from the settings', or undefined while nothing was
 * changed, or no runtime is on or the settings have not loaded, when the strip is not drawn: a
 * change is only ever made, and diffed, over the settings as they are.
 */
export function useStartRuns(isChange = false): {
  options: StoredOptions | undefined;
  strip: ReactNode;
} {
  const runtimes = pickerRuntimes(useRuntimesOn());
  const saved = useSettings()?.runs.options;
  const fallback = runtimes[0]?.kind;
  const defaults = useMemo<RunOptions | undefined>(
    () => (fallback === undefined || saved === undefined ? undefined : toMap(saved, fallback)),
    [fallback, saved],
  );
  // Unset until the strip changes something: the defaults follow the settings as they change.
  const [changed, setChanged] = useState<RunOptions>();
  if (defaults === undefined) {
    return { options: undefined, strip: null };
  }
  const value = changed ?? defaults;
  return {
    options: changed === undefined ? undefined : toStored(changed, defaults),
    strip: (
      <RunStrip
        defaults={defaults}
        isChange={isChange}
        onChange={setChanged}
        runtimes={runtimes}
        value={value}
      />
    ),
  };
}
