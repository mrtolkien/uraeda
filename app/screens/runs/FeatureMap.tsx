// A feature's own run map, on its page: how each step runs, the feature's options over the
// settings', saved at once as the map moves (`feature.setRunOptions`), the same component the
// settings and the starts draw (rule 3). What the feature already ran is locked, and under each
// step's tile, the sessions that ran it, in the order they ran: which one, on what, when, and for
// how long. `Enter` on a step that ran opens its latest session; a press on a session's line opens
// that one.
import { computed, View } from "nsh";
import { call, navigate, record, serverTime } from "../../store";
import type { RunOptions, Turn } from "../../store/protocol";
import { Link, sent, Text } from "../../ui/controls";
import { runsOnWords } from "../session/words";
import { isLocked, runsByStep, type StepRun, stepStates } from "./history";
import { NONE, type StepId } from "./options";
import { RunMap } from "./RunMap";
import { took } from "../session/words";

export type FeatureMapProps = {
  repo: string;
  folder: string;
  /** Whether the map's keys are on. */
  active: () => boolean;
  column: boolean;
  /** The map's cursor, kept in the pane's visit. */
  cursor: { (): string | null; set(value: string | null): void };
};

export function FeatureMap(props: FeatureMapProps) {
  const feature = record("Feature", { id: props.folder, repo: props.repo });
  const history = record("History", { id: props.folder, repo: props.repo });
  const settings = record("Settings", null);
  const agents = record("Agent", { repo: props.repo });
  const own = sent<RunOptions>(
    () => feature()?.runOptions.own ?? NONE,
    (options) => call("feature.setRunOptions", { folder: props.folder, options, repo: props.repo }),
  );
  const states = () => stepStates(history(), feature()?.step.name ?? "");

  // Its sessions, the oldest first, each with its turns: held while the map is drawn.
  const sessions = computed(() =>
    (feature()?.sessions ?? []).toReversed().map((id) => {
      const live = record("Session", { id, repo: props.repo });
      const turns = computed(() =>
        (live()?.turns ?? []).map((turn) => record("Turn", { id: turn, repo: props.repo })),
      );
      return { id, live, turns };
    }),
  );
  const runs = () =>
    runsByStep(
      sessions().map((one) => ({
        id: one.id,
        turns: one.turns().flatMap((turn): Array<Turn> => {
          const read = turn();
          return read == null ? [] : [read];
        }),
      })),
    );
  const numberOf = (session: string) => sessions().findIndex((one) => one.id === session) + 1;
  const open = (session: string) => navigate({ id: session, page: "session-id", repo: props.repo });

  const line = (run: StepRun) => {
    const session = sessions()
      .find((one) => one.id === run.session)
      ?.live();
    const agent = agents()?.runtimes.find((one) => one.id === session?.agent)?.name;
    const length =
      run.endedAt === null && run.state === "running"
        ? "running"
        : took(Math.max(0, (run.endedAt ?? run.startedAt) - run.startedAt));
    return [
      `Session ${numberOf(run.session)}`,
      session ? runsOnWords(session, agent) : undefined,
      serverTime(run.startedAt),
      run.state === "failed" ? `failed after ${length}` : length,
    ]
      .filter((part) => part !== undefined && part !== "")
      .join(" · ");
  };
  const under = (step: StepId) => {
    const ran = runs()[step];
    if (ran === undefined || ran.length === 0) return undefined;
    return (
      <View style={{ gap: 2, paddingBottom: 8, paddingHorizontal: 4 }}>
        <Each of={ran}>
          {(run) => (
            <Link onPress={() => open(run().session)} size="under">
              <Text size="under" tone={run().state === "failed" ? "danger" : "quiet"}>
                {line(run())}
              </Text>
            </Link>
          )}
        </Each>
      </View>
    );
  };

  return (
    <If when={settings()?.runs} else={<Text tone="faint">Reading the settings' run options…</Text>}>
      {(saved) => (
        <RunMap
          active={props.active}
          column={props.column}
          cursor={props.cursor}
          defaultAgent={saved().defaultAgent}
          kind={feature()?.kind === "change" ? "change" : "feature"}
          locked={(place) => isLocked(place, states())}
          onChange={own.set}
          onEnter={(place) => {
            const ran = place.kind === "step" ? runs()[place.step] : undefined;
            const last = ran?.at(-1);
            if (last === undefined) return false;
            open(last.session);
            return true;
          }}
          over={saved().options}
          refusal={own.refusal()}
          runtimes={agents()?.runtimes ?? []}
          testID="feature-map"
          under={under}
          value={own.value()}
        />
      )}
    </If>
  );
}
