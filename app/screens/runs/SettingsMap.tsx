// The settings' run map: every feature's run options, as config.toml keeps them, drawn by the one
// run map. A change is saved at once, `settings.setRunOptions` with every value set; the map moves
// as it is touched, and a refusal puts it back and says why under it (`sent`). Its keys are on
// while the settings' cursor is on its row, so `j` `k` go through it, and on past its edges.
import { call, record } from "../../store";
import type { RunOptions, RunSettings } from "../../store/protocol";
import { sent } from "../../ui/controls";
import { usePane } from "../../ui/layout";
import { RunMap } from "./RunMap";

/** The map of the settings' runs category, on the row the settings' cursor calls `id`. */
export function SettingsMap(props: {
  runs: () => RunSettings | undefined;
  repo?: string;
  id?: string;
}) {
  const pane = usePane();
  const row = pane.remember<string | null>("row", null);
  const cursor = pane.remember<string | null>("map", null);
  const agents = record("Agent", { repo: props.repo ?? null });
  const options = sent<RunOptions>(
    () =>
      props.runs()?.options ?? {
        implementers: null,
        reviewDepth: null,
        reviewers: null,
        steps: [],
      },
    (next) => call("settings.setRunOptions", { options: next }),
  );
  return (
    <RunMap
      active={() => row() === (props.id ?? "map")}
      column={pane.width() !== "wide"}
      cursor={cursor}
      defaultAgent={props.runs()?.defaultAgent ?? null}
      onChange={options.set}
      refusal={options.refusal()}
      runtimes={agents()?.runtimes ?? []}
      testID="settings-map"
      value={options.value()}
    />
  );
}
