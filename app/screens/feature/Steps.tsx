// The feature's steps: first its own run map (`../runs/FeatureMap.tsx`), how each step runs, the
// steps it already ran locked, each with the sessions that ran it; then its history as its commits
// read it, each stage with when it started and how long it took, and under each the files of the
// folder it made, `Enter` opening a file in its own pane, a stage's row its first file. The keys
// go through both as one: `j` past the map's last row reaches the list, `k` past the list's first
// row the map, and `k` past the map's first row the pane's tabs.
import { View } from "nsh";
import { navigate, record, type Route } from "../../store";
import type { Feature, HistoryView } from "../../store/protocol";
import { type IconName, Spinner } from "../../ui/controls";
import { KeyScope, registerKey } from "../../ui/keys";
import { PaneScroll, usePane } from "../../ui/layout";
import { readerPane } from "../file/panes";
import { mockupPane } from "../preview/MockupPage";
import { FeatureMap } from "../runs/FeatureMap";
import { createCursor, Empty, Line, List } from "../../ui/lists";
import { tokens } from "../../ui/tokens";
import { type FeatureArgs, ticking, WithFeature } from "./read";
import { clock, duration, fileWord, plural, STAGES, stageOf } from "./words";

/** A row of the list, as it draws: a stage, or a file under it, indented. */
type Step = {
  hue?: string;
  icon: IconName;
  id: string;
  indent: boolean;
  label: string;
  /** Its quiet fact: a stage's times, a file's status. */
  meta?: string;
  /** A file the gate waits on: its status in the needs-you colour. */
  needs: boolean;
  /** A stage not reached yet. */
  quiet: boolean;
  /** What `Enter` opens: a file, or a stage's first file. */
  to?: Route;
};

/** When a stage ended: the start of the first stage after it that started. */
function endOf(history: HistoryView, index: number) {
  return (
    history.stages.slice(index + 1).find((stage) => stage.started !== null)?.started ?? undefined
  );
}

/** "14:02 · 2 h 50 min" once passed, "since 14:02" while current; Questions adds its rounds. */
function stageLine(history: HistoryView, index: number, now: number): string | undefined {
  const stage = history.stages[index];
  const parts: Array<string> = [];
  if (stage?.started) {
    const at = clock(stage.started, now);
    const end = index < history.current ? endOf(history, index) : undefined;
    if (index === history.current) parts.push(`since ${at}`);
    else if (end) parts.push(at, duration((Date.parse(end) - Date.parse(stage.started)) / 1000));
    else parts.push(at);
  }
  if (stage?.name === "questions" && (history.rounds ?? 0) > 0) {
    parts.push(plural(history.rounds ?? 0, "round"));
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

const STAGE_ICONS = { ahead: "minus", done: "circle-check", now: "circle-dot" } as const;

/** The rows: each stage, then the files that show under it, the mockups last. */
function stepsOf(feature: Feature, history: HistoryView, now: number): Array<Step> {
  const names = history.stages.map((stage) => stage.name);
  const files = new Map<string, Array<Step>>(names.map((name) => [name, []]));
  const waitingFor = feature.step.waitsOn === "human" ? feature.step.file : null;
  for (const file of feature.files) {
    const waiting = file.name === waitingFor;
    const status = waiting
      ? "to review"
      : file.kind === "record"
        ? undefined
        : (file.status ?? undefined);
    files.get(stageOf(file, names))?.push({
      icon: "file-text",
      id: `file:${file.name}`,
      indent: true,
      label: fileWord(file),
      meta: status,
      needs: waiting,
      quiet: false,
      // Each workflow file opens in its own page's panes, task 41's, by this route.
      to: { folder: feature.folder, name: file.name, page: "file" },
    });
  }
  for (const name of feature.mockups) {
    files.get(stageOf({ kind: "mockup", name }, names))?.push({
      icon: "layers",
      id: `mockup:${name}`,
      indent: true,
      label: `mockups/${name}`,
      needs: false,
      quiet: false,
      to: { folder: feature.folder, name, page: "mockup" },
    });
  }
  return history.stages.flatMap((stage, index): Array<Step> => {
    const under = files.get(stage.name) ?? [];
    const state = index < history.current ? "done" : index === history.current ? "now" : "ahead";
    return [
      {
        hue: state === "now" ? tokens.light.focus : undefined,
        icon: STAGE_ICONS[state],
        id: `stage:${stage.name}`,
        indent: false,
        label: STAGES[stage.name] ?? stage.name,
        meta: stageLine(history, index, now),
        needs: false,
        quiet: state === "ahead",
        to: under[0]?.to,
      },
      ...under,
    ];
  });
}

function Rows(props: { args: FeatureArgs; feature: () => Feature }) {
  const now = ticking(60_000);
  const history = record("History", { id: props.args.folder, repo: props.args.repo });
  const kept = usePane().remember<string | null>("at", null);
  const steps = () => {
    const read = history();
    return read === undefined ? [] : stepsOf(props.feature(), read, now());
  };
  const byId = () => new Map(steps().map((step) => [step.id, step]));
  const cursor = createCursor(steps, {
    initial: kept() ?? undefined,
    onChange: (id) => kept.set(id ?? null),
  });
  const open = (id: string) => {
    const to = byId().get(id)?.to;
    if (to !== undefined) navigate(to);
  };
  /** A file's reader, or a mockup, beside the steps, in place of its page: `shift+Enter`. */
  const beside = (id: string) => {
    const to = byId().get(id)?.to;
    const repo = props.args.repo;
    if (to?.page === "file") return readerPane({ folder: to.folder, name: to.name, repo });
    if (to?.page === "mockup") return mockupPane({ folder: to.folder, name: to.name, repo });
    return undefined;
  };
  return (
    <If
      when={history() !== undefined || history.error() !== undefined}
      else={<Spinner label="Reading its history from git" />}
    >
      <List
        beside={beside}
        cursor={cursor}
        empty={
          <Empty
            icon="git-branch"
            title="No steps read"
            words={
              history.error()?.message ??
              "Its history has no stage: its branch has no commit of the workflow yet."
            }
          />
        }
        onOpen={open}
        row={(id) => {
          const step = () => byId().get(id());
          return (
            <If when={step()}>
              {(shown) => (
                <View
                  style={{
                    alignItems: "center",
                    flex: 1,
                    flexDirection: "row",
                    gap: 8,
                    paddingLeft: shown().indent ? 24 : 0,
                  }}
                >
                  <Line
                    hue={shown().hue}
                    icon={shown().icon}
                    label={shown().label}
                    meta={shown().meta}
                    metaTone={shown().needs ? "needs" : undefined}
                    quiet={shown().quiet}
                  />
                </View>
              )}
            </If>
          );
        }}
      />
    </If>
  );
}

/** Which part of the pane has the keys: the run map, or the history's rows. */
type Part = { (): string; set(value: string): void };

/** `j` past the map's last row goes down to the history. */
function MapKeys(props: { part: Part }) {
  registerKey({ keys: "j", label: "Down to the history", run: () => props.part.set("list") });
  return null;
}

/** `k` past the history's first row goes up to the map. */
function HistoryKeys(props: { part: Part }) {
  registerKey({ keys: "k", label: "Up to the run map", run: () => props.part.set("map") });
  return null;
}

/** The pane "Steps". */
export function Steps(props: { args: FeatureArgs }) {
  const pane = usePane();
  const part = pane.remember<"map" | "list">("part", "map");
  const cursor = pane.remember<string | null>("map", null);
  // Two parts, each its keys' scope, on in turn: the map's `j` `k` and the rows' never meet.
  return (
    <PaneScroll style={{ flex: 1 }}>
      <WithFeature args={props.args}>
        {(feature) => (
          <View style={{ gap: 16 }}>
            <KeyScope kind="pane" name="Run map" on={() => part() === "map"}>
              <MapKeys part={part} />
              <View style={{ padding: 12 }}>
                <FeatureMap
                  active={() => part() === "map"}
                  column={pane.width() !== "wide"}
                  cursor={cursor}
                  folder={props.args.folder}
                  repo={props.args.repo}
                />
              </View>
            </KeyScope>
            <KeyScope kind="pane" name="History" on={() => part() === "list"}>
              <HistoryKeys part={part} />
              <KeyScope kind="selection" name="History's rows">
                <Rows args={props.args} feature={feature} />
              </KeyScope>
            </KeyScope>
          </View>
        )}
      </WithFeature>
    </PaneScroll>
  );
}
