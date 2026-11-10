// The scheduled jobs' stories (`specs/2026-11-10-scheduled-jobs/spec.md`): the Jobs place of a
// repository, its jobs as cards, at rest, empty, and with every job off; the lines a scheduled run
// leaves in its session; and the Runs settings' new switch. The real components over fixed jobs,
// with no server. The navigation around the pages is the fixture's.
// A job's own page is in `JobPageMockups.stories.tsx`.
import { ChatSystemMessage } from "@astryxdesign/core/Chat";
import { Switch } from "@astryxdesign/core/Switch";
import { VStack } from "@astryxdesign/core/VStack";
import type { Meta, StoryObj } from "@storybook/react-vite";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import type { JobRow } from "uraeda-server/fate";
import { inRepositoryFolder } from "../../.storybook/inRepositoryFolder.tsx";
import { atMostWidth, PHONE } from "../../.storybook/widthClass.ts";
import { AnnouncedBanner } from "../layout/AnnouncedBanner.tsx";
import { SettingRow, SettingRows } from "../settings/SettingRow.tsx";
import { categoryOf, settingOf } from "../settings/categories.ts";
import { Shell } from "../Shell.tsx";
import type { RunSession } from "./facts.ts";
import { type JobsHandlers, JobsPlace } from "./JobsPage.tsx";

const styles = stylex.create({
  notice: {
    // As the transcript's system lines: left-aligned, not centred.
    justifyContent: "flex-start",
    textAlign: "start",
  },
  session: { maxWidth: "var(--size-reading-pane)" },
});

const nothing = () => {};

/** Thursday 12 November 2026, 10:30, the stories' now. */
const NOW = new Date(2026, 10, 12, 10, 30);
/** The zone `NOW` is local to, which the times read in. */
const ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

const at = (month: number, day: number, hour: number, minute = 0) =>
  new Date(2026, month, day, hour, minute).toISOString();

/** What a job holds besides its name and what a story sets. */
const BASE: Pick<JobRow, "agent" | "effort" | "model" | "prompt" | "repositories"> = {
  agent: null,
  effort: null,
  model: null,
  prompt: "Upgrade the dependencies, and run the checks.",
  repositories: ["uraeda"],
};

/** A started run, as the history lists it. */
const started = (id: string, when: string, session: string, title: string, folder?: string) => ({
  at: when,
  due: when,
  folder: folder ?? null,
  id,
  outcome: "started" as const,
  reason: null,
  session,
  title,
  trigger: "schedule" as const,
});

const JOBS: ReadonlyArray<JobRow> = [
  {
    ...BASE,
    history: [
      started(
        "1",
        at(10, 12, 3),
        "s-deps",
        "Upgrade three dependencies",
        "2026-11-12-upgrade-three-dependencies",
      ),
    ],
    name: "Dependencies",
    next: { at: null, text: null, why: "change-open" },
    on: true,
    problem: null,
    reportOnly: false,
    schedule: { hour: 3, kind: "daily", minute: 0 },
    scheduleText: "daily 03:00",
  },
  {
    ...BASE,
    history: [started("2", at(10, 9, 4), "s-perf", "Performance pass")],
    name: "Performance pass",
    next: { at: at(10, 16, 4), text: null, why: null },
    on: true,
    problem: null,
    reportOnly: true,
    schedule: { day: 1, hour: 4, kind: "weekly", minute: 0 },
    scheduleText: "monday 04:00",
  },
  {
    ...BASE,
    history: [started("3", at(10, 2, 5), "s-persona", "Persona walkthrough")],
    name: "Persona walkthrough",
    next: { at: null, text: null, why: "paused" },
    on: false,
    problem: null,
    reportOnly: true,
    schedule: { hour: 5, kind: "weekdays", minute: 0 },
    scheduleText: "weekdays 05:00",
  },
  {
    ...BASE,
    history: [],
    name: "Code quality",
    next: { at: null, text: null, why: "problem" },
    on: true,
    problem: "Not running: the schedule “dayly 06:00” is not understood",
    reportOnly: false,
    schedule: null,
    scheduleText: "dayly 06:00",
  },
];

/** What each run's session reads as in the sidebar's cards. */
const SESSIONS: ReadonlyMap<string, RunSession> = new Map([
  [
    "s-deps",
    {
      done: false,
      label: "Needs you",
      status: "needs-you",
      step: { kind: "pull-request", label: "PR ready" },
    },
  ],
  ["s-perf", { done: false, label: "New reply", status: "unread" }],
  ["s-persona", { done: true, label: "Idle", status: "idle" }],
]);

const HANDLERS: JobsHandlers = {
  onAdd: nothing,
  onOpen: nothing,
  onRemove: async () => undefined,
  onRun: async () => undefined,
  onSetOn: async () => undefined,
};

/** The Jobs place over `jobs`, in the app's frame. */
function JobsFrame({ isOff = false, jobs }: { isOff?: boolean; jobs: ReadonlyArray<JobRow> }) {
  return (
    <Shell>
      <JobsPlace
        enabled={!isOff}
        handlers={HANDLERS}
        jobs={jobs}
        now={NOW}
        problem={null}
        sessions={SESSIONS}
        zone={ZONE}
      />
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
      <Line>{"Started by “Run now” of the job “Dependencies”."}</Line>
      <Line>{"The job “Dependencies” started the change “Upgrade three dependencies”."}</Line>
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

/** The Runs section's new switch, on by default, under the catch-up's: the real row's words. */
function RunsSettings() {
  const [on, setOn] = useState(true);
  return (
    <VStack xstyle={styles.session}>
      <SettingRows>
        <SettingRow setting={settingOf(categoryOf("runs")!, RUN_JOBS)}>
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
export const JobsList: Story = { render: () => <JobsFrame jobs={JOBS} /> };

/** The same on the phone: the selected job's actions float at the bottom. */
export const JobsListPhone: Story = { ...JobsList, beforeEach: atMostWidth(PHONE) };

/** No job yet: the page says what goes in it. */
export const JobsEmpty: Story = { render: () => <JobsFrame jobs={[]} /> };

/** "Run scheduled jobs" is off in the settings: the banner says so, over the same list. */
export const JobsOff: Story = { render: () => <JobsFrame isOff jobs={JOBS} /> };

/** A run's session: the line saying why it started, and the line and banner of a change it starts. */
export const SessionLines: Story = {
  parameters: { layout: "padded" },
  render: () => <SessionOfARun />,
};

/** The Runs settings' new switch, on by default. */
export const RunsSection: Story = {
  parameters: { layout: "padded" },
  render: () => <RunsSettings />,
};
