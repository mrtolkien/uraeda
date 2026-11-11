// What the feature produced and cost, and where it lives: while it runs, its lines changed, tokens,
// agent time, and elapsed time; once merged, its total time, lines, tokens, agent time, questions,
// and decisions; then its branch, worktree, and pull request. Times count on while a run is on.
import { type JSX, View } from "nsh";
import { record } from "../../store";
import type { Feature, HistoryView } from "../../store/protocol";
import { Heading, Link, Text } from "../../ui/controls";
import { PaneScroll } from "../../ui/layout";
import { type FeatureArgs, ticking, WithFeature } from "./read";
import { clock, day, duration, plural } from "./words";

/** One figure: its name, its value, and what it counts. */
type Figure = { caption?: string; label: string; value: string };

/** "5.2 M", "113 k", "2.7 k", and under 1,000 as is. */
function count(value: number): string {
  if (value < 1000) return String(value);
  if (value < 1_000_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)} k`;
  return `${(value / 1_000_000).toFixed(1)} M`;
}

function figuresOf(feature: Feature, history: HistoryView, now: number): Array<Figure> {
  const done = history.current >= history.stages.length;
  if (done && !history.found) return [];
  const rows: Array<Figure> = [];
  const start = (name: string) => history.stages.find((stage) => stage.name === name)?.started;
  const [from, to] = [start("proposal"), start("pull-request")];
  if (done && history.totalSeconds !== null && from && to) {
    rows.push({
      caption: `${clock(from, now)} to ${clock(to, now)}`,
      label: "Total time",
      value: duration(history.totalSeconds),
    });
  }
  if (history.lines !== null) {
    rows.push({
      caption: plural(history.lines.files, "file"),
      label: "Lines",
      value: `+${history.lines.added} −${history.lines.removed}`,
    });
  }
  const tokens = feature.tokens;
  rows.push(
    tokens === null
      ? { label: "Tokens", value: "Not recorded" }
      : {
          caption: tokens.partial ? `since ${day(tokens.since)}` : "cache reads left out",
          label: "Tokens",
          value: `${count(tokens.input)} in · ${count(tokens.output)} out`,
        },
  );
  const agent = feature.agent;
  const running = agent?.runningSince == null ? 0 : (now - agent.runningSince) / 1000;
  rows.push({
    caption: agent?.runningSince == null ? undefined : "a run is on",
    label: "Agent time",
    value: agent === null ? "Not recorded" : duration(agent.seconds + Math.max(0, running)),
  });
  const first = history.stages[0]?.started;
  if (!done && first)
    rows.push({ label: "Elapsed", value: duration((now - Date.parse(first)) / 1000) });
  const rounds = history.rounds ?? 0;
  const change = feature.kind === "change";
  if (done && (!change || rounds > 0)) {
    rows.push({
      caption: rounds > 0 ? plural(rounds, "round") : "no round",
      label: "Questions",
      value: String(history.questions ?? 0),
    });
  }
  if (done && (!change || history.decisions.length > 0)) {
    rows.push({
      caption: "new or changed",
      label: "Decisions",
      value: String(history.decisions.length),
    });
  }
  return rows;
}

/** A row: its name at the start, its value and what it counts at the end. */
function Fact(props: { caption?: string; children: JSX.Element; label: string }) {
  return (
    <View
      style={{
        alignItems: "flex-start",
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
        justifyContent: "space-between",
      }}
    >
      <Text tone="quiet">{props.label}</Text>
      <View style={{ alignItems: "flex-end", flexShrink: 1 }}>
        {props.children}
        <If when={props.caption}>
          {(caption) => (
            <Text size="under" tone="faint">
              {caption()}
            </Text>
          )}
        </If>
      </View>
    </View>
  );
}

function Body(props: { args: FeatureArgs; feature: () => Feature }) {
  const now = ticking(30_000);
  const history = record("History", { id: props.args.folder, repo: props.args.repo });
  const feature = props.feature;
  const done = () => feature().step.name === "done";
  const figures = () => {
    const read = history();
    return read === undefined ? [] : figuresOf(feature(), read, now());
  };
  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 8 }}>
        <Heading level={3}>{done() ? "What it produced" : "Produced so far"}</Heading>
        <If
          when={figures().length > 0}
          else={
            <Text tone="faint">
              {history() === undefined
                ? "Reading its history from git…"
                : "No figures: its commits could not be traced on the default branch."}
            </Text>
          }
        >
          <Each key={(figure: Figure) => figure.label} of={figures()}>
            {(figure) => (
              <Fact caption={figure().caption} label={figure().label}>
                <Text>{figure().value}</Text>
              </Fact>
            )}
          </Each>
        </If>
      </View>
      <View style={{ gap: 8 }}>
        <Heading level={3}>Where it lives</Heading>
        <Fact label="Branch">
          <Text font="code">{feature().branch ?? "none yet"}</Text>
        </Fact>
        <If when={feature().worktree}>
          {(worktree) => (
            <Fact label="Worktree">
              <Text font="code">{worktree()}</Text>
            </Fact>
          )}
        </If>
        <Fact label="Folder">
          <Text font="code">{feature().path}</Text>
        </Fact>
        <If when={feature().pullRequest}>
          {(pull) => (
            <Fact caption={pull().state === "open" ? undefined : pull().state} label="Pull request">
              <Link href={pull().url}>{`#${pull().number} ↗`}</Link>
            </Fact>
          )}
        </If>
      </View>
    </View>
  );
}

/** The pane "Figures". */
export function Figures(props: { args: FeatureArgs }) {
  return (
    <PaneScroll style={{ flex: 1 }}>
      <WithFeature args={props.args}>
        {(feature) => <Body args={props.args} feature={feature} />}
      </WithFeature>
    </PaneScroll>
  );
}
