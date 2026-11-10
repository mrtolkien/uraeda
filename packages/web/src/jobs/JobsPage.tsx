// The Jobs place (`Space j`, `/jobs`, in the phone's `…`): the repository's jobs as cards, each with
// its next run and its last one, the first selected with its bar. The keys act on the selected card,
// each also on its bar and by tap: Enter opens the job's page, `r` runs it now and opens its session,
// `p` pauses or resumes it, `d` deletes it after the shared confirmation, `a` adds a job, and `j`
// and `k` move the selection. A refusal shows under its card until dismissed.
import { Button } from "@astryxdesign/core/Button";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import type { JobRow } from "uraeda-server/fate";
import { type ConfirmOptions, useConfirm } from "../fields/Confirm.tsx";
import { useKeys } from "../keys/registry.tsx";
import { AnnouncedBanner } from "../layout/AnnouncedBanner.tsx";
import { Empty } from "../layout/Empty.tsx";
import { Page } from "../layout/Page.tsx";
import { PageTitle } from "../layout/PageTitle.tsx";
import type { BarAction } from "../lists/RowBar.tsx";
import { useListKeys } from "../lists/useListKeys.ts";
import { currentEntry, navigate, sessionIdPath, useRepoPath } from "../routes.tsx";
import { useNavigation } from "../sessionData.ts";
import { stepOf } from "../sidebar/cards.ts";
import { statusLabel } from "../wait.ts";
import { useNow } from "../useNow.ts";
import { type Fact, lastFact, latestStart, nextFact, type RunSession } from "./facts.ts";
import { JobCard } from "./JobCard.tsx";
import { useJobActions, useJobs } from "./useJobs.ts";

const styles = stylex.create({
  list: { listStyleType: "none", margin: 0, padding: 0 },
});

/** The job's page, which its name and Enter open: a path within the repository. */
export const jobPath = (name: string) => `/jobs/${encodeURIComponent(name)}`;

/** The path of a new job's page, which `a` opens. */
export const NEW_JOB_PATH = "/jobs/new";

/** What the shared confirmation asks before a job is deleted. */
const deleteQuestion = (name: string): ConfirmOptions => ({
  body: "Its prompt leaves config.toml, and its sessions stay.",
  cancel: "Keep",
  confirm: "Delete",
  // `d d` deletes, as `y` does.
  confirmKey: "d",
  destructive: true,
  title: `Delete the job “${name}”?`,
});

/** What the list does for the human: each write answers its refusal in words, or nothing. */
export type JobsHandlers = {
  onAdd: () => void;
  onOpen: (name: string) => void;
  onRemove: (name: string) => Promise<string | undefined>;
  onRun: (name: string) => Promise<string | undefined>;
  onSetOn: (name: string, on: boolean) => Promise<string | undefined>;
};

/** The words of each job's last run, from its latest start and that run's session as read. */
function factsOf(
  job: JobRow,
  sessions: ReadonlyMap<string, RunSession>,
  now: Date,
): { last: Fact; next: Fact } {
  const run = latestStart(job);
  return {
    last: lastFact(run, run?.session == null ? undefined : sessions.get(run.session), now),
    next: nextFact(job, now),
  };
}

/**
 * The list's state and keys: the selected job and whether its bar shows, the refusals under the
 * cards, the bar's actions of a job, and the keys, which act on the selected card.
 */
function useJobsPlace(jobs: ReadonlyArray<JobRow>, handlers: JobsHandlers) {
  const confirm = useConfirm();
  // The job a page named on arrival, as a new job's page does once it added it.
  const [name, setName] = useState<string | undefined>(() => currentEntry().select);
  const [isBarred, setBarred] = useState(true);
  const [refusals, setRefusals] = useState<ReadonlyMap<string, string>>(new Map());
  const selected = jobs.find((job) => job.name === name) ?? jobs[0];
  const pick = (picked: string) => {
    setName(picked);
    setBarred(true);
  };
  const refuse = (job: string, text: string | undefined) =>
    setRefusals((then) => {
      const next = new Map(then);
      if (text === undefined) {
        next.delete(job);
      } else {
        next.set(job, text);
      }
      return next;
    });
  /** Sends a write of the job, clears the last refusal, and shows the new one under its card. */
  const send = async (job: string, write: () => Promise<string | undefined>) => {
    refuse(job, undefined);
    refuse(job, await write());
  };
  const remove = async (job: string) => {
    if (await confirm(deleteQuestion(job))) {
      await send(job, () => handlers.onRemove(job));
    }
  };
  const actionsOf = (job: JobRow): ReadonlyArray<BarAction> => [
    { keys: "⏎", label: "open", run: () => handlers.onOpen(job.name) },
    {
      icon: "uraeda:play",
      keys: "r",
      label: "run now",
      run: () => void send(job.name, () => handlers.onRun(job.name)),
    },
    {
      keys: "p",
      label: job.on ? "pause" : "resume",
      run: () => void send(job.name, () => handlers.onSetOn(job.name, !job.on)),
    },
    { icon: "uraeda:trash", keys: "d", label: "delete", run: () => void remove(job.name) },
  ];
  const act = (row: number, key: string) =>
    actionsOf(jobs[row])
      .find((action) => action.keys === key)
      ?.run();
  const { ref } = useListKeys({
    escapeLabel: null,
    keys: jobs.map((job) => job.name),
    onClose: () => false,
    onEdit: () => {
      if (selected === undefined) {
        return false;
      }
      handlers.onOpen(selected.name);
      return true;
    },
    onSelect: (row) => pick(jobs[row].name),
    rowKeys: [
      { keys: "r", label: "run now", run: (row) => act(row, "r") },
      { keys: "p", label: "pause or resume", run: (row) => act(row, "p") },
      { keys: "d", label: "delete", run: (row) => act(row, "d") },
    ],
    selected: selected === undefined ? -1 : jobs.indexOf(selected),
  });
  useKeys([{ hint: "a", keys: "a", label: "add a job", run: handlers.onAdd }]);
  return {
    actionsOf,
    dismiss: (job: string) => refuse(job, undefined),
    isBarred,
    pick,
    ref,
    refusals,
    selected,
    sendSwitch: (job: string, on: boolean) => void send(job, () => handlers.onSetOn(job, on)),
    unbar: () => setBarred(false),
  };
}

/**
 * The jobs as cards, under the page's title, with the banner of switched-off jobs or of an
 * unreadable file. Takes its data and its writes, so the stories draw it over fixed rows.
 */
export function JobsPlace({
  enabled,
  handlers,
  jobs,
  now,
  problem,
  sessions,
}: {
  enabled: boolean;
  handlers: JobsHandlers;
  jobs: ReadonlyArray<JobRow>;
  now: Date;
  problem: string | null;
  sessions: ReadonlyMap<string, RunSession>;
}) {
  const here = useRepoPath();
  const { ref, ...list } = useJobsPlace(jobs, handlers);
  const { selected } = list;
  return (
    <Page kind="rows">
      <VStack gap={3}>
        <PageTitle
          aside={
            <Button label="Add a job" onClick={handlers.onAdd} size="sm" variant="secondary" />
          }
          count={jobs.length}
        >
          Jobs
        </PageTitle>
        {problem !== null && (
          <AnnouncedBanner
            collapsible={false}
            description="Jobs are written in it: fix it and they come back."
            status="error"
            title={problem}
          />
        )}
        {problem === null && !enabled && (
          <AnnouncedBanner
            collapsible={false}
            description="No job starts by itself until “Run scheduled jobs” is on again, in Settings, Runs. “Run now” still starts one."
            status="info"
            title="Scheduled jobs are off."
          />
        )}
        {problem === null &&
          (jobs.length === 0 ? (
            <Empty>
              No job yet. A job runs a prompt here at set times, like a daily dependencies upgrade.
            </Empty>
          ) : (
            <div ref={ref}>
              <VStack as="ul" gap={3} xstyle={styles.list}>
                {jobs.map((job) => (
                  <JobCard
                    actions={list.actionsOf(job)}
                    href={here(jobPath(job.name))}
                    isBarred={list.isBarred && job === selected}
                    isSelected={job === selected}
                    job={job}
                    key={job.name}
                    onAway={list.unbar}
                    onDismiss={() => list.dismiss(job.name)}
                    onPick={() => list.pick(job.name)}
                    onSwitch={(on) => list.sendSwitch(job.name, on)}
                    refusal={list.refusals.get(job.name)}
                    {...factsOf(job, sessions, now)}
                  />
                ))}
              </VStack>
            </div>
          ))}
      </VStack>
    </Page>
  );
}

/** What each job's latest start's session reads as in the sidebar's cards, by session id. */
function useRunSessions(jobs: ReadonlyArray<JobRow>): ReadonlyMap<string, RunSession> {
  const { sessionList, workspace } = useNavigation();
  const sessions = new Map<string, RunSession>();
  for (const job of jobs) {
    const id = latestStart(job)?.session;
    const row = id == null ? undefined : sessionList?.rows.find((one) => one.id === id);
    if (id == null || row === undefined) {
      continue;
    }
    const feature =
      row.folder === null
        ? undefined
        : workspace?.features.find((one) => one.folder === row.folder);
    sessions.set(
      id,
      feature === undefined
        ? {
            done: row.done,
            label: statusLabel({ label: row.statusLabel, wait: row.wait }),
            status: row.status,
          }
        : {
            done: feature.step.name === "done",
            label: statusLabel(feature.status),
            status: feature.status.status,
            step: stepOf(feature),
          },
    );
  }
  return sessions;
}

/** The Jobs place: the repository's jobs, live, with their writes. */
export function JobsPage() {
  const record = useJobs();
  const actions = useJobActions();
  const here = useRepoPath();
  const now = new Date(useNow(30_000));
  const sessions = useRunSessions(record.jobs);
  return (
    <JobsPlace
      enabled={record.enabled}
      handlers={{
        onAdd: () => navigate(here(NEW_JOB_PATH)),
        onOpen: (name) => navigate(here(jobPath(name))),
        onRemove: actions.remove,
        onRun: async (name) => {
          const result = await actions.runNow(name);
          if ("session" in result) {
            navigate(here(sessionIdPath(result.session)), { created: true });
            return undefined;
          }
          return result.refused;
        },
        onSetOn: actions.setOn,
      }}
      jobs={record.jobs}
      now={now}
      problem={record.problem}
      sessions={sessions}
    />
  );
}
