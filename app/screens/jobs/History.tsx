// A job's history in the repository, newest first, each a card: a run as its session, or as its
// change once it started one, which Enter or a press opens; a time skipped with its reason, naming
// the change that blocked it; a time whose run could not start, with why. A run whose session is
// gone says so.
import { computed, View } from "nsh";
import { type JobArgs, jobNamed, jobsOf } from "./actions";
import { askRun, RunQuestion } from "./RunNow";
import { ticking } from "./clock";
import { failedWords, skippedWords, whenWords } from "./words";
import { navigate, record } from "../../store";
import type { JobRun } from "../../store/protocol";
import { registerKey } from "../../ui/keys/registry";
import { PaneScroll, usePane } from "../../ui/layout";
import { Card, type CardFact, type CardProps, createCursor, Empty, listKeys } from "../../ui/lists";

/** Where a run's card leads: its change, else its session, else nowhere, once both are gone. */
function openRun(repo: string, run: JobRun) {
  if (run.folder !== null) navigate({ folder: run.folder, page: "feature", repo });
  else if (run.session !== null) navigate({ id: run.session, page: "session-id", repo });
}

/** Who started it. */
const startedBy = (run: JobRun) =>
  run.trigger === "manual" ? "Started by “Run now”" : "Started by its schedule";

/** What a run's card shows, beside its time. */
function cardOf(run: JobRun, status: string | undefined): Omit<CardProps, "time"> {
  if (run.outcome === "skipped") {
    return { icon: "hourglass", title: skippedWords(run), who: "Its time was skipped" };
  }
  if (run.outcome === "failed") {
    return {
      icon: "triangle-alert",
      state: { label: "Not started", tone: "danger" },
      title: failedWords(run),
      who: startedBy(run),
    };
  }
  const facts: Array<CardFact> = [];
  if (run.session === null) {
    facts.push({ icon: "history", label: "Its session is gone.", tone: "quiet" });
  }
  if (run.refusal !== null) {
    facts.push({
      icon: "triangle-alert",
      label: `The change it offered could not start by itself: ${run.refusal}`,
      tone: "danger",
    });
  }
  return {
    facts,
    icon: run.folder === null ? "square-terminal" : "git-branch",
    state: status === undefined ? undefined : { label: status, tone: "quiet" },
    title: run.title ?? "Its session is gone.",
    who: run.folder === null ? startedBy(run) : `${startedBy(run)} · it started a change`,
  };
}

function RunCard(props: { now: number; repo: string; run: JobRun; selected: boolean }) {
  const session = () =>
    props.run.session === null
      ? undefined
      : (record("Session", { id: props.run.session, repo: props.repo })() ?? undefined);
  return (
    <Card
      {...cardOf(props.run, session()?.statusLabel)}
      onPress={() => openRun(props.repo, props.run)}
      selected={props.selected}
      testID={`job-run-${props.run.id}`}
      time={{ started: whenWords(props.run.at, props.now) }}
    />
  );
}

export function History(props: JobArgs) {
  const pane = usePane();
  const now = ticking();
  const jobs = jobsOf(props.repo);
  const runs = computed(() => jobNamed(jobs(), props.name)?.history ?? []);
  const at = pane.remember<string | null>("at", null);
  const cursor = createCursor(() => runs().map((run) => ({ id: run.id })), {
    initial: at() ?? undefined,
    onChange: (id) => at.set(id ?? null),
  });
  listKeys(cursor, {
    onOpen: (id) => {
      const run = runs().find((one) => one.id === id);
      if (run !== undefined) openRun(props.repo, run);
    },
    openLabel: "open the run",
  });
  registerKey([
    {
      hint: "r",
      hintLabel: "run now",
      keys: "r",
      label: "run the job now…",
      run: () => askRun(props, "history"),
    },
  ]);
  return (
    <PaneScroll style={{ flex: 1 }}>
      <RunQuestion from="history" />
      <View style={{ gap: 8, paddingBottom: 16 }}>
        <If
          when={runs().length > 0}
          else={
            <Empty
              icon="history"
              title="It has not run here yet"
              words="Its runs, the times it skipped, and the starts that failed show here, newest first. “Run now” starts one."
            />
          }
        >
          <Each key={(run: JobRun) => run.id} of={runs()}>
            {(run) => (
              <RunCard
                now={now()}
                repo={props.repo}
                run={run()}
                selected={cursor.holds(run().id)}
              />
            )}
          </Each>
        </If>
      </View>
    </PaneScroll>
  );
}
