// A job's page (`/jobs/<name>`) and a new job's (`/jobs/new`): the job's name and "Run now", on the
// phone the bottom bar's one action, then its form, then its history in this repository. A name
// that no job has reads as the app's page for a missing item. The views take their data and their
// writes, so the stories and the tests draw them over fixed jobs.
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { VStack } from "@astryxdesign/core/VStack";
import { type ReactNode, useState } from "react";
import type { JobInput } from "uraeda-binding";
import type { JobRow, JobRunView } from "uraeda-server/fate";
import { useRepositories } from "../data.ts";
import { AnnouncedBanner } from "../layout/AnnouncedBanner.tsx";
import { Missing } from "../layout/Missing.tsx";
import { NavTile, NavTiles } from "../layout/NavBar.tsx";
import { Page } from "../layout/Page.tsx";
import { PageTitle } from "../layout/PageTitle.tsx";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { TopBarSlot } from "../layout/TopBarSlot.tsx";
import {
  jobPath,
  navigate,
  sessionIdPath,
  useLocalPath,
  useRepoPath,
  useRepository,
} from "../routes.tsx";
import { useRuntimesOn } from "../runtimes.ts";
import { useNavigation } from "../sessionData.ts";
import { type PickerRuntime, pickerRuntimes } from "../SessionPicker.tsx";
import { FeatureCard, SessionCard } from "../sidebar/Cards.tsx";
import { rowOf } from "../sidebar/cards.ts";
import { useNow } from "../useNow.ts";
import { JobForm } from "./JobForm.tsx";
import { JobHistory } from "./JobHistory.tsx";
import { Refusal } from "./JobCard.tsx";
import { runCardOf } from "./runCards.ts";
import { useJobActions, useJobs } from "./useJobs.ts";

/** What a page of the form needs besides its job: the time, the lists, and the agents on here. */
type Around = {
  now: Date;
  repositories: ReadonlyArray<string>;
  repository: string;
  runtimes: ReadonlyArray<PickerRuntime>;
  /** The server's time zone, which the times read in. */
  zone: string;
};

/** A write of a job, `was` the name it has in the file: its refusal in words, or nothing. */
type Write = (input: JobInput, was: string) => Promise<string | undefined>;

/**
 * What a job's page says once the human unticked its own repository while another stays ticked: the
 * job no longer runs here, so the record no longer lists it in this repository (R37). The way back
 * ticks the repository again.
 */
function Left({
  job,
  onBack,
  repository,
}: {
  job: JobInput;
  onBack: () => Promise<string | undefined>;
  repository: string;
}) {
  const here = useRepoPath();
  const [refusal, setRefusal] = useState<string>();
  return (
    <Page kind="rows">
      <VStack gap={3}>
        <AnnouncedBanner
          collapsible={false}
          description={
            <HStack align="center" gap={3} wrap="wrap">
              <Button
                label="Run it here again"
                onClick={() => void onBack().then(setRefusal)}
                size="sm"
                variant="secondary"
              />
              <Link hasUnderline href={here("/jobs")}>
                Open Jobs
              </Link>
            </HStack>
          }
          status="warning"
          title={`“${job.name.trim()}” no longer runs in ${repository}.`}
        />
        <Refusal onDismiss={() => setRefusal(undefined)} refusal={refusal} />
      </VStack>
    </Page>
  );
}

/** The page's title, with "Run now" beside it on wider screens. */
function Title({ children, onRun }: { children: ReactNode; onRun?: () => void }) {
  return (
    <PageTitle
      above="Jobs"
      aside={
        onRun !== undefined && (
          <Button label="Run now" onClick={onRun} size="sm" variant="primary" />
        )
      }
    >
      {children}
    </PageTitle>
  );
}

/**
 * A job's page: `job`, or the missing page when no job is named `name`. `handlers.onSave` saves
 * the job as the form changes it, `onRun` runs it and answers the refusal, and `renderCard` draws
 * a started run's card in the history.
 */
export function JobPageView({
  handlers,
  job,
  name,
  renderCard,
  ...around
}: Around & {
  handlers: { onRun: () => Promise<string | undefined>; onSave: Write };
  job: JobRow | undefined;
  name: string;
  renderCard: (run: JobRunView) => ReactNode;
}) {
  const narrow = isNarrow(useWidthClass());
  const [refusal, setRefusal] = useState<string>();
  // The job as saved when its own repository was unticked.
  const [left, setLeft] = useState<JobInput>();
  if (left !== undefined) {
    return (
      <Left
        job={left}
        onBack={async () => {
          const back = await handlers.onSave(
            { ...left, repositories: [...left.repositories, around.repository] },
            left.name.trim(),
          );
          if (back === undefined) {
            setLeft(undefined);
          }
          return back;
        }}
        repository={around.repository}
      />
    );
  }
  if (job === undefined) {
    return (
      <Page kind="rows">
        <Missing label="Open Jobs" title={`No job “${name}” here.`} to="/jobs" />
      </Page>
    );
  }
  const run = async () => {
    setRefusal(undefined);
    setRefusal(await handlers.onRun());
  };
  // A save that leaves the job out of this repository, which it was in, ends the page (R37).
  const wasHere = job.repositories.includes(around.repository);
  const save: Write = async (input, was) => {
    const saved = await handlers.onSave(input, was);
    if (saved === undefined && wasHere && !input.repositories.includes(around.repository)) {
      setLeft(input);
    }
    return saved;
  };
  return (
    <Page beside="--size-setting-control" kind="rows">
      <VStack gap={3}>
        <Title onRun={narrow ? undefined : () => void run()}>{job.name}</Title>
        <Refusal onDismiss={() => setRefusal(undefined)} refusal={refusal} />
        <JobForm job={job} onSave={save} {...around} />
        <JobHistory
          now={around.now}
          renderCard={renderCard}
          runs={job.history}
          zone={around.zone}
        />
      </VStack>
      {narrow && (
        <TopBarSlot>
          <NavTiles label="The job's actions">
            <NavTile
              icon="uraeda:play"
              isTinted
              label="Run now"
              onPress={() => void run()}
              word="Run"
            />
          </NavTiles>
        </TopBarSlot>
      )}
    </Page>
  );
}

/** A new job's page: the empty form, ending with "Add the job", which sends the job whole. */
export function NewJobPageView({ onSave, ...around }: Around & { onSave: Write }) {
  return (
    <Page beside="--size-setting-control" kind="rows">
      <VStack gap={3}>
        <Title>New job</Title>
        <JobForm onSave={onSave} {...around} />
      </VStack>
    </Page>
  );
}

/** What the page reads besides the job: the time, the repositories by name, and the agents on. */
function useAround(zone: string): Around {
  const repositories = useRepositories()?.rows ?? [];
  return {
    now: new Date(useNow(30_000)),
    repositories: repositories.map((row) => row.name).sort((a, b) => a.localeCompare(b)),
    repository: useRepository(),
    runtimes: pickerRuntimes(useRuntimesOn()),
    zone,
  };
}

/**
 * A started run's card in the history: its change's, else its session's, as the sidebar draws it,
 * or nothing once both are gone, which the history says in its own line.
 */
function useRunCards(): (run: JobRunView) => ReactNode {
  const { sessionList, workspace } = useNavigation();
  const pathname = useLocalPath();
  const rows = sessionList?.rows ?? [];
  return (run) => {
    const target = runCardOf(run, rows, workspace?.features ?? []);
    if (target === undefined) {
      return null;
    }
    return target.feature === undefined ? (
      <SessionCard pathname={pathname} row={target.row} />
    ) : (
      <FeatureCard
        feature={target.feature}
        pathname={pathname}
        row={rowOf(target.feature, rows) ?? target.row}
      />
    );
  };
}

/** The job's page of the name in the address, live. */
export function JobPage({ name }: { name: string }) {
  const record = useJobs();
  const actions = useJobActions();
  const here = useRepoPath();
  const around = useAround(record.timeZone);
  const renderCard = useRunCards();
  return (
    <JobPageView
      {...around}
      handlers={{
        onRun: async () => {
          const result = await actions.runNow(name);
          if ("session" in result) {
            navigate(here(sessionIdPath(result.session)), { created: true });
            return undefined;
          }
          return result.refused;
        },
        onSave: async (input, was) => {
          const refusal = await actions.update(was, input);
          // A rename moved the page's address.
          if (refusal === undefined && input.name.trim() !== was) {
            navigate(here(jobPath(input.name.trim())));
          }
          return refusal;
        },
      }}
      job={record.jobs.find((one) => one.name === name)}
      name={name}
      renderCard={renderCard}
    />
  );
}

/** A new job's page: once added, the list, the new job selected. */
export function NewJobPage() {
  const actions = useJobActions();
  const here = useRepoPath();
  const around = useAround(useJobs().timeZone);
  return (
    <NewJobPageView
      {...around}
      onSave={async (input) => {
        const refusal = await actions.add(input);
        if (refusal === undefined) {
          navigate(here("/jobs"), { select: input.name.trim() });
        }
        return refusal;
      }}
    />
  );
}
