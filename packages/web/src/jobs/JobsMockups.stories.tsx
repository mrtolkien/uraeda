// The scheduled jobs' mockups (`specs/2026-11-10-scheduled-jobs/spec.md`): the Jobs place of a
// repository, its list at rest, empty, and with every job off; a job's page, its form and its
// history, and a new job's; the lines a scheduled run leaves in its session; and the Runs
// settings' new switch. Built from the real components over fixed text, with no server: the
// stories show the look, and the page's data is the real page's once built. The navigation around
// the pages is the fixture's, which the mockup does not change.
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { ChatSystemMessage } from "@astryxdesign/core/Chat";
import { CheckboxList, CheckboxListItem } from "@astryxdesign/core/CheckboxList";
import { HStack } from "@astryxdesign/core/HStack";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Switch } from "@astryxdesign/core/Switch";
import { Text } from "@astryxdesign/core/Text";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import type { Meta, StoryObj } from "@storybook/react-vite";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { inRepositoryFolder } from "../../.storybook/inRepositoryFolder.tsx";
import { atMostWidth, PHONE } from "../../.storybook/widthClass.ts";
import { TextField } from "../fields/TextField.tsx";
import { TextLine } from "../fields/TextLine.tsx";
import { AnnouncedBanner } from "../layout/AnnouncedBanner.tsx";
import { Empty } from "../layout/Empty.tsx";
import { Page } from "../layout/Page.tsx";
import { PageTitle } from "../layout/PageTitle.tsx";
import { Pane } from "../layout/Pane.tsx";
import { pickedStyles } from "../layout/picked.ts";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { type BarAction, RowBar } from "../lists/RowBar.tsx";
import { SettingRow, SettingRows } from "../settings/SettingRow.tsx";
import { Shell } from "../Shell.tsx";
import { type CardItem, ItemCard } from "../sidebar/ItemCard.tsx";

const styles = stylex.create({
  list: { listStyleType: "none", margin: 0, padding: 0 },
  notice: {
    // As the transcript's system lines: left-aligned, not centred.
    justifyContent: "flex-start",
    textAlign: "start",
  },
  problem: { color: colorVars["--color-error"] },
  row: {
    paddingBlock: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-3"],
  },
  session: { maxWidth: "var(--size-reading-pane)" },
  // A line of the history that started nothing: where a card's text starts.
  skipped: {
    paddingBlock: spacingVars["--spacing-1"],
    paddingInline: spacingVars["--spacing-2"],
  },
});

const nothing = () => {};

/** A job as the list draws it. */
type Job = {
  /** What its last run did, or nothing before its first. */
  last?: string;
  name: string;
  /** When it runs next, or why it does not. */
  next: string;
  on: boolean;
  problem?: string;
  /** Its schedule, in words. */
  schedule: string;
  startsChanges: boolean;
};

const DEPENDENCIES: Job = {
  last: "Last run today at 3:00: started “Upgrade three dependencies”, PR ready.",
  name: "Dependencies",
  next: "Next run skipped while that change is open.",
  on: true,
  schedule: "Every day at 3:00",
  startsChanges: true,
};

const JOBS: ReadonlyArray<Job> = [
  DEPENDENCIES,
  {
    last: "Last run Monday at 4:00: new reply.",
    name: "Performance pass",
    next: "Next run Monday 16 November at 4:00.",
    on: true,
    schedule: "Every Monday at 4:00",
    startsChanges: false,
  },
  {
    last: "Last run 2 November at 5:00.",
    name: "Persona walkthrough",
    next: "Paused.",
    on: false,
    schedule: "Weekdays at 5:00",
    startsChanges: false,
  },
  {
    name: "Code quality",
    next: "Not running: the schedule “dayly 06:00” is not understood.",
    on: true,
    problem: "schedule",
    schedule: "dayly 06:00",
    startsChanges: true,
  },
];

/** The selected job's actions, under its row, or floating on the phone. */
const ROW_ACTIONS: ReadonlyArray<BarAction> = [
  { keys: "⏎", label: "open", run: nothing },
  { icon: "uraeda:play", keys: "r", label: "run now", run: nothing },
  { keys: "p", label: "pause", run: nothing },
  { icon: "uraeda:trash", keys: "d", label: "delete", run: nothing },
];

/**
 * A job's row: its name and what it may do alone on the head line, with its switch at the end,
 * then its schedule, its next run, and its last one, each at the row's whole width.
 */
function JobRow({ isSelected, job }: { isSelected: boolean; job: Job }) {
  const [on, setOn] = useState(job.on);
  return (
    <VStack as="li" gap={1} xstyle={[styles.row, isSelected && pickedStyles.picked]}>
      <HStack align="center" gap={3} justify="between">
        <HStack align="center" gap={2} wrap="wrap">
          <Text weight="semibold">{job.name}</Text>
          {job.startsChanges && <Badge label="Starts changes" variant="neutral" />}
        </HStack>
        <Switch
          isLabelHidden
          label={`${job.name} runs on its schedule`}
          onChange={setOn}
          value={on}
        />
      </HStack>
      <Text color="secondary">{job.schedule}</Text>
      <Text color="secondary" xstyle={job.problem !== undefined && styles.problem}>
        {job.next}
      </Text>
      {job.last !== undefined && <Text color="secondary">{job.last}</Text>}
      {isSelected && <RowBar actions={ROW_ACTIONS} />}
    </VStack>
  );
}

/** The Jobs place: the repository's jobs, the first one selected, and Add in the pane's border. */
function JobsPlace({ isOff = false, jobs }: { isOff?: boolean; jobs: ReadonlyArray<Job> }) {
  return (
    <Shell>
      <Page kind="rows">
        <VStack gap={3}>
          {isOff && (
            <AnnouncedBanner
              collapsible={false}
              description="No job starts by itself until “Run scheduled jobs” is on again, in Settings, Runs. “Run now” still starts one."
              status="info"
              title="Scheduled jobs are off."
            />
          )}
          <Pane
            actions={<Button label="Add a job" size="sm" variant="secondary" />}
            count={jobs.length}
            icon="uraeda:history"
            title="Jobs"
          >
            {jobs.length === 0 ? (
              <Empty isInset>
                No job yet. A job runs a prompt here at set times, like a daily dependencies
                upgrade.
              </Empty>
            ) : (
              <VStack as="ul" xstyle={styles.list}>
                {jobs.map((job, index) => (
                  <JobRow isSelected={index === 0} job={job} key={job.name} />
                ))}
              </VStack>
            )}
          </Pane>
        </VStack>
      </Page>
    </Shell>
  );
}

/** The schedule's kinds, as its control names them. */
const KINDS = ["Hourly", "Daily", "Weekdays", "Weekly"] as const;

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** The schedule's control: its kind, its time but for Hourly, and its day for Weekly. */
function Schedule({ initial }: { initial: (typeof KINDS)[number] }) {
  const [kind, setKind] = useState<string>(initial);
  const [time, setTime] = useState("03:00");
  const [day, setDay] = useState("Monday");
  return (
    <VStack gap={2}>
      <SegmentedControl label="How often" onChange={setKind} value={kind}>
        {KINDS.map((each) => (
          <SegmentedControlItem key={each} label={each} value={each} />
        ))}
      </SegmentedControl>
      {kind === "Weekly" && (
        <SegmentedControl label="Day" onChange={setDay} value={day}>
          {DAYS.map((each) => (
            <SegmentedControlItem key={each} label={each.slice(0, 3)} value={each} />
          ))}
        </SegmentedControl>
      )}
      {kind !== "Hourly" && (
        <TextLine isLabelHidden label="Time" onChange={setTime} value={time} width="6rem" />
      )}
    </VStack>
  );
}

const PROMPT = `Upgrade the dependencies of the Rust and the pnpm workspaces to their latest versions.

Read each changelog for breaking changes. Run \`vp run ready\`, and fix what the upgrade breaks.
Leave out an upgrade that needs a design choice, and say which.`;

/** The form of a job, saved field by field; a new job's ends with its one button. */
function JobForm({ job }: { job?: Job }) {
  const [name, setName] = useState(job?.name ?? "");
  const [prompt, setPrompt] = useState(job === undefined ? "" : PROMPT);
  const [repositories, setRepositories] = useState<Array<string>>(["uraeda"]);
  const [startsChanges, setStartsChanges] = useState(job?.startsChanges ?? false);
  return (
    <Pane icon="uraeda:history" isSnugOnPhone title={job === undefined ? "New job" : "Job"}>
      <VStack gap={3}>
        <SettingRows>
          <SettingRow
            setting={{
              help: "Shown here and in each run's session.",
              icon: "uraeda:flag",
              label: "Name",
            }}
          >
            <TextLine isLabelHidden label="Name" onChange={setName} value={name} width="16rem" />
          </SettingRow>
          <SettingRow
            isUnderWide
            setting={{
              help: "What each run is asked. It may name a skill or a file of the repository to follow.",
              icon: "uraeda:bot",
              label: "Prompt",
            }}
            under={
              <TextField
                isLabelHidden
                kind="notes"
                label="Prompt"
                onChange={setPrompt}
                value={prompt}
              />
            }
          />
          <SettingRow
            notes={
              job !== undefined && (
                <Text color="secondary">Every day at 3:00. Next run tomorrow at 3:00.</Text>
              )
            }
            setting={{
              help: "In the server's local time. A run missed while the server was off starts once when it is back.",
              icon: "uraeda:hourglass",
              label: "Schedule",
            }}
          >
            <Schedule initial="Daily" />
          </SettingRow>
          <SettingRow
            setting={{
              help: "Each repository gets its own run, a minute apart.",
              icon: "uraeda:git-branch",
              label: "Repositories",
            }}
          >
            <CheckboxList label="Runs in" onChange={setRepositories} value={repositories}>
              {["uraeda", "notes", "dotfiles"].map((each) => (
                <CheckboxListItem key={each} label={each} value={each} />
              ))}
            </CheckboxList>
          </SettingRow>
          <SettingRow
            setting={{
              help: "Its runs start on this agent, model, and effort. A change it starts follows your run map.",
              icon: "uraeda:harness-claude",
              label: "Agent",
            }}
          >
            <Button label="Claude Code · Opus · High" size="sm" variant="secondary" />
          </SettingRow>
          <SettingRow
            setting={{
              help: "When a run offers a change, Uraeda starts it without waiting for you, up to its pull request. Nothing merges without you. Off, the offer waits in the run's session.",
              icon: "uraeda:workflow",
              label: "Start changes by itself",
            }}
          >
            <Switch
              isLabelHidden
              label="Start changes by itself"
              onChange={setStartsChanges}
              value={startsChanges}
            />
          </SettingRow>
        </SettingRows>
        {job === undefined && (
          <HStack justify="end">
            <Button
              isDisabled={name === "" || prompt === ""}
              label="Add the job"
              variant="primary"
            />
          </HStack>
        )}
      </VStack>
    </Pane>
  );
}

/** A run of the history: when it was due, then its session's or its change's card, or why it skipped. */
type Run = { card?: CardItem; note?: string; when: string };

const HISTORY: ReadonlyArray<Run> = [
  {
    note: "Skipped: the change “Upgrade three dependencies” is still open.",
    when: "Wed 11 Nov, 3:00",
  },
  {
    card: {
      folder: "2026-11-10-upgrade-three",
      harness: "claude",
      kind: "change",
      label: "Upgrade three dependencies",
      pullRequest: { number: 124, url: "https://github.com/mrtolkien/uraeda/pull/124" },
      status: { label: "Needs you", status: "needs-you" },
      step: { kind: "pull-request", label: "PR ready" },
      title: "Upgrade three dependencies",
    },
    note: "Started late, at 9:12.",
    when: "Tue 10 Nov, 3:00",
  },
  {
    card: {
      agent: "claude",
      folder: "story-run-2",
      kind: "session",
      label: "Dependencies",
      status: { label: "Idle", status: "idle" },
      title: "Dependencies",
    },
    note: "Started by “Run now”.",
    when: "Mon 9 Nov, 17:42",
  },
];

/** A job's history, newest first: each run's time over its card or its reason. */
function History() {
  return (
    <Pane count={HISTORY.length} icon="uraeda:history" isSnugOnPhone title="History">
      <VStack as="ul" gap={2} xstyle={styles.list}>
        {HISTORY.map(({ card, note, when }) => (
          <VStack as="li" gap={1} key={when}>
            <Text color="secondary" type="supporting">
              {when}
            </Text>
            {card && <ItemCard href="#" item={card} onOpen={nothing} onStatus={nothing} />}
            {note !== undefined && (
              <Text color="secondary" xstyle={styles.skipped}>
                {note}
              </Text>
            )}
          </VStack>
        ))}
      </VStack>
    </Pane>
  );
}

/** A job's page: its name and Run now, its form, then its history in this repository. */
function JobPage({ job }: { job?: Job }) {
  const narrow = isNarrow(useWidthClass());
  return (
    <Shell>
      <Page beside="--size-setting-control" kind="rows">
        <VStack gap={3}>
          <PageTitle
            above="Jobs"
            aside={
              job !== undefined && !narrow && <Button label="Run now" size="sm" variant="primary" />
            }
          >
            {job?.name ?? "New job"}
          </PageTitle>
          <JobForm job={job} />
          {job !== undefined && <History />}
        </VStack>
      </Page>
    </Shell>
  );
}

/** A system line of the session, as the transcript draws one. */
function Line({ children }: { children: string }) {
  return <ChatSystemMessage xstyle={styles.notice}>{children}</ChatSystemMessage>;
}

/** The lines a scheduled run leaves in its session, then the banner of a change that could not start. */
function SessionOfARun() {
  return (
    <VStack gap={3} xstyle={styles.session}>
      <Line>{"Started by the schedule “Dependencies”."}</Line>
      <Line>{"Started by the schedule “Dependencies”, late: it was due at 3:00."}</Line>
      <Line>{"Started by “Run now” of the job “Dependencies”."}</Line>
      <Line>
        {"“Dependencies” starts changes by itself: Uraeda started “Upgrade three dependencies”."}
      </Line>
      <AnnouncedBanner
        collapsible={false}
        description="specs/changes/2026-11-10-upgrade-three exists: choose another slug. Start it from the offer's card above."
        dismissLabel="Dismiss"
        isDismissable
        onDismiss={nothing}
        status="warning"
        title="The change could not start by itself."
      />
    </VStack>
  );
}

const RUN_JOBS = "Run scheduled jobs";

/** The Runs section's new switch, on by default, under the catch-up's. */
function RunsSettings() {
  const [on, setOn] = useState(true);
  return (
    <VStack xstyle={styles.session}>
      <SettingRows>
        <SettingRow
          setting={{
            help: "Your jobs start by themselves at their times, in the repositories they name. Off, none starts until it is on again, and “Run now” still works. A change applies at once.",
            icon: "uraeda:history",
            label: RUN_JOBS,
          }}
        >
          <Switch isLabelHidden label={RUN_JOBS} onChange={setOn} value={on} />
        </SettingRow>
      </SettingRows>
    </VStack>
  );
}

const meta = {
  decorators: [inRepositoryFolder],
  parameters: { layout: "fullscreen" },
  title: "Mockups/Jobs",
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

/** The Jobs place, `Space j`: four jobs, one paused, one whose schedule cannot be read. */
export const JobsList: Story = { render: () => <JobsPlace jobs={JOBS} /> };

/** The same on the phone: the selected job's actions float at the bottom. */
export const JobsListPhone: Story = { ...JobsList, beforeEach: atMostWidth(PHONE) };

/** No job yet: the pane says what goes in it. */
export const JobsEmpty: Story = { render: () => <JobsPlace jobs={[]} /> };

/** "Run scheduled jobs" is off in the settings: the banner says so, over the same list. */
export const JobsOff: Story = { render: () => <JobsPlace isOff jobs={JOBS} /> };

/** A job's page: its form, each field saved as it is left, then its history. */
export const JobOpen: Story = { render: () => <JobPage job={DEPENDENCIES} /> };

/** The same on the phone. */
export const JobOpenPhone: Story = { ...JobOpen, beforeEach: atMostWidth(PHONE) };

/** A new job: the same form, empty, ending with "Add the job". */
export const JobNew: Story = { render: () => <JobPage /> };

/** A run's session: the line saying why it started, and the lines and banner of a change it starts. */
export const SessionLines: Story = {
  parameters: { layout: "padded" },
  render: () => <SessionOfARun />,
};

/** The Runs settings' new switch, on by default. */
export const RunsSection: Story = {
  parameters: { layout: "padded" },
  render: () => <RunsSettings />,
};
