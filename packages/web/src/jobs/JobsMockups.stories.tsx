// The scheduled jobs' mockups (`specs/2026-11-10-scheduled-jobs/spec.md`): the Jobs place of a
// repository, its jobs as cards, at rest, empty, and with every job off; the lines a scheduled run
// leaves in its session; and the Runs settings' new switch. Built from the real components over
// fixed text, with no server: the stories show the look, and the page's data is the real page's
// once built. The navigation around the pages is the fixture's, which the mockup does not change.
// A job's own page is in `JobPageMockups.stories.tsx`.
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { ChatSystemMessage } from "@astryxdesign/core/Chat";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Switch } from "@astryxdesign/core/Switch";
import { Text } from "@astryxdesign/core/Text";
import {
  borderVars,
  colorVars,
  fontWeightVars,
  spacingVars,
  typeScaleVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import type { Meta, StoryObj } from "@storybook/react-vite";
import * as stylex from "@stylexjs/stylex";
import { type ComponentProps, useState } from "react";
import { inRepositoryFolder } from "../../.storybook/inRepositoryFolder.tsx";
import { atMostWidth, PHONE } from "../../.storybook/widthClass.ts";
import { AnnouncedBanner } from "../layout/AnnouncedBanner.tsx";
import { Empty } from "../layout/Empty.tsx";
import { Page } from "../layout/Page.tsx";
import { PageTitle } from "../layout/PageTitle.tsx";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { type BarAction, RowBar } from "../lists/RowBar.tsx";
import { SettingRow, SettingRows } from "../settings/SettingRow.tsx";
import { Shell } from "../Shell.tsx";

type IconName = ComponentProps<typeof Icon>["icon"];

const styles = stylex.create({
  // A job's card: a square frame, apart from the page.
  card: {
    backgroundColor: colorVars["--color-background-body"],
    borderColor: colorVars["--color-border-emphasized"],
    borderStyle: "solid",
    borderWidth: borderVars["--border-width"],
  },
  // The selected card: the accent's frame and its bar at the start, as a picked row's.
  cardPicked: {
    borderColor: colorVars["--color-accent"],
    boxShadow: `inset 2px 0 0 0 ${colorVars["--color-accent"]}`,
  },
  // A fact of the card, its label over its value; two of them share the card's width.
  fact: { flexBasis: 0, flexGrow: 1, minWidth: 0 },
  // The facts, under a rule that sets them apart from the job's name and schedule.
  facts: {
    borderBlockStartColor: colorVars["--color-border-emphasized"],
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: borderVars["--border-width"],
    paddingBlock: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-3"],
  },
  // The card's head, its name and schedule, on the raised surface, apart from its facts.
  head: {
    backgroundColor: colorVars["--color-background-surface"],
    paddingBlock: spacingVars["--spacing-3"],
    paddingInline: spacingVars["--spacing-3"],
  },
  // The job's mark, in the accent, level with its name.
  jobIcon: {
    color: colorVars["--color-accent"],
    lineHeight: typeScaleVars["--text-large-leading"],
  },
  label: {
    color: colorVars["--color-text-secondary"],
    fontSize: typeScaleVars["--text-supporting-size"],
    textTransform: "uppercase",
  },
  list: { listStyleType: "none", margin: 0, padding: 0 },
  name: {
    fontSize: typeScaleVars["--text-large-size"],
    fontWeight: fontWeightVars["--font-weight-semibold"],
    lineHeight: typeScaleVars["--text-large-leading"],
  },
  notice: {
    // As the transcript's system lines: left-aligned, not centred.
    justifyContent: "flex-start",
    textAlign: "start",
  },
  // A paused job's name and schedule, greyed: it runs at no time.
  paused: { color: colorVars["--color-text-secondary"] },
  session: { maxWidth: "var(--size-reading-pane)" },
  text: { flexGrow: 1, minWidth: 0 },
});

/** The colour of a fact's icon, by what it says. */
const tones = stylex.create({
  needsYou: { color: "var(--role-needs-you)" },
  problem: { color: colorVars["--color-error"] },
  quiet: { color: colorVars["--color-text-secondary"] },
  unread: { color: colorVars["--color-accent"] },
});

const nothing = () => {};

/** A fact of a job's card: its icon in its tone's colour, and its words. */
type Fact = { icon: IconName; text: string; tone: keyof typeof tones };

/** A job as its card draws it. */
type Job = {
  /** What its last run did. */
  last: Fact;
  name: string;
  /** When it runs next, or why it does not. */
  next: Fact;
  on: boolean;
  /** Whether a change its runs offer waits for the human. */
  reportOnly: boolean;
  /** Its schedule, in words, or as written when it cannot be read. */
  schedule: string;
};

const JOBS: ReadonlyArray<Job> = [
  {
    last: {
      icon: "uraeda:step-pull-request",
      text: "Today at 3:00 · started “Upgrade three dependencies”, PR ready",
      tone: "needsYou",
    },
    name: "Dependencies",
    next: { icon: "uraeda:hourglass", text: "Waits for that change to close", tone: "quiet" },
    on: true,
    reportOnly: false,
    schedule: "Every day at 3:00",
  },
  {
    last: { icon: "uraeda:comment", text: "Monday at 4:00 · new reply", tone: "unread" },
    name: "Performance pass",
    next: { icon: "uraeda:hourglass", text: "Monday 16 November at 4:00", tone: "quiet" },
    on: true,
    reportOnly: true,
    schedule: "Every Monday at 4:00",
  },
  {
    last: { icon: "uraeda:badge-check", text: "2 November at 5:00 · read", tone: "quiet" },
    name: "Persona walkthrough",
    next: { icon: "uraeda:square", text: "Paused", tone: "quiet" },
    on: false,
    reportOnly: true,
    schedule: "Weekdays at 5:00",
  },
  {
    last: { icon: "uraeda:square-dashed", text: "Never ran", tone: "quiet" },
    name: "Code quality",
    next: {
      icon: "uraeda:triangle-alert",
      text: "Not running: the schedule “dayly 06:00” is not understood",
      tone: "problem",
    },
    on: true,
    reportOnly: false,
    schedule: "dayly 06:00",
  },
];

/** The selected job's actions, under its card, or floating on the phone. */
const ROW_ACTIONS: ReadonlyArray<BarAction> = [
  { keys: "⏎", label: "open", run: nothing },
  { icon: "uraeda:play", keys: "r", label: "run now", run: nothing },
  { keys: "p", label: "pause", run: nothing },
  { icon: "uraeda:trash", keys: "d", label: "delete", run: nothing },
];

/** A fact of the card: its label, small and in capitals, over its icon and its words. */
function FactOf({ fact, label }: { fact: Fact; label: string }) {
  return (
    <VStack gap={1} xstyle={styles.fact}>
      <Text xstyle={styles.label}>{label}</Text>
      <HStack align="start" gap={2}>
        <Text xstyle={tones[fact.tone]}>
          <Icon icon={fact.icon} size="sm" />
        </Text>
        <Text xstyle={[styles.text, fact.tone === "problem" && tones.problem]}>{fact.text}</Text>
      </HStack>
    </VStack>
  );
}

/**
 * A job's card: its mark, its name, and its switch on the head line, its schedule under its name,
 * then, under a rule, its next run and its last one, side by side, or one over the other on the
 * phone, each at the card's whole width.
 */
function JobCard({ isSelected, job }: { isSelected: boolean; job: Job }) {
  const [on, setOn] = useState(job.on);
  const narrow = isNarrow(useWidthClass());
  const facts = (
    <>
      <FactOf fact={job.next} label="Next run" />
      <FactOf fact={job.last} label="Last run" />
    </>
  );
  return (
    <VStack as="li" gap={1}>
      <VStack xstyle={[styles.card, isSelected && styles.cardPicked]}>
        <HStack align="start" gap={3} xstyle={styles.head}>
          <Text xstyle={[styles.jobIcon, !on && styles.paused]}>
            <Icon icon="uraeda:history" size="md" />
          </Text>
          <VStack gap={1} xstyle={styles.text}>
            <HStack align="center" gap={2} wrap="wrap">
              <Heading level={3} xstyle={[styles.name, !on && styles.paused]}>
                {job.name}
              </Heading>
              {job.reportOnly && <Badge label="Report only" variant="neutral" />}
            </HStack>
            <Text xstyle={!on && styles.paused}>{job.schedule}</Text>
          </VStack>
          <Switch
            isLabelHidden
            label={`${job.name} runs on its schedule`}
            onChange={setOn}
            value={on}
          />
        </HStack>
        {narrow ? (
          <VStack gap={3} xstyle={styles.facts}>
            {facts}
          </VStack>
        ) : (
          <HStack align="start" gap={4} xstyle={styles.facts}>
            {facts}
          </HStack>
        )}
      </VStack>
      {isSelected && <RowBar actions={ROW_ACTIONS} />}
    </VStack>
  );
}

/** The Jobs place: the repository's jobs as cards, the first one selected, and Add by its title. */
function JobsPlace({ isOff = false, jobs }: { isOff?: boolean; jobs: ReadonlyArray<Job> }) {
  return (
    <Shell>
      <Page kind="rows">
        <VStack gap={3}>
          <PageTitle
            aside={<Button label="Add a job" size="sm" variant="secondary" />}
            count={jobs.length}
          >
            Jobs
          </PageTitle>
          {isOff && (
            <AnnouncedBanner
              collapsible={false}
              description="No job starts by itself until “Run scheduled jobs” is on again, in Settings, Runs. “Run now” still starts one."
              status="info"
              title="Scheduled jobs are off."
            />
          )}
          {jobs.length === 0 ? (
            <Empty>
              No job yet. A job runs a prompt here at set times, like a daily dependencies upgrade.
            </Empty>
          ) : (
            <VStack as="ul" gap={3} xstyle={styles.list}>
              {jobs.map((job, index) => (
                <JobCard isSelected={index === 0} job={job} key={job.name} />
              ))}
            </VStack>
          )}
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

/** No job yet: the page says what goes in it. */
export const JobsEmpty: Story = { render: () => <JobsPlace jobs={[]} /> };

/** "Run scheduled jobs" is off in the settings: the banner says so, over the same list. */
export const JobsOff: Story = { render: () => <JobsPlace isOff jobs={JOBS} /> };

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
