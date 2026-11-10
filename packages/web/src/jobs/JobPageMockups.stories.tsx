// The mockups of a scheduled job's page (`specs/2026-11-10-scheduled-jobs/spec.md`): its form, each
// field saved as it is left, and its history in the repository, and a new job's form. Built from
// the real components over fixed text, with no server: the stories show the look, and the page's
// data is the real page's once built. The list of jobs is in `JobsMockups.stories.tsx`.
import { Button } from "@astryxdesign/core/Button";
import { CheckboxList, CheckboxListItem } from "@astryxdesign/core/CheckboxList";
import { HStack } from "@astryxdesign/core/HStack";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Switch } from "@astryxdesign/core/Switch";
import { Text } from "@astryxdesign/core/Text";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import type { Meta, StoryObj } from "@storybook/react-vite";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { inRepositoryFolder } from "../../.storybook/inRepositoryFolder.tsx";
import { atMostWidth, PHONE } from "../../.storybook/widthClass.ts";
import { TextField } from "../fields/TextField.tsx";
import { TextLine } from "../fields/TextLine.tsx";
import { Page } from "../layout/Page.tsx";
import { PageTitle } from "../layout/PageTitle.tsx";
import { Pane } from "../layout/Pane.tsx";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { SettingRow, SettingRows } from "../settings/SettingRow.tsx";
import { Shell } from "../Shell.tsx";
import { type CardItem, ItemCard } from "../sidebar/ItemCard.tsx";

const styles = stylex.create({
  list: { listStyleType: "none", margin: 0, padding: 0 },
  // A line of the history that started nothing: where a card's text starts.
  skipped: {
    paddingBlock: spacingVars["--spacing-1"],
    paddingInline: spacingVars["--spacing-2"],
  },
});

const nothing = () => {};

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
function JobForm({ job }: { job?: string }) {
  const [name, setName] = useState(job ?? "");
  const [prompt, setPrompt] = useState(job === undefined ? "" : PROMPT);
  const [repositories, setRepositories] = useState<Array<string>>(["uraeda"]);
  const [reportOnly, setReportOnly] = useState(false);
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
              help: "In the server's local time. A time that passes while Uraeda is not running is missed.",
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
              help: "Its runs start no change: one they offer waits for you in the run's session. Off, Uraeda starts the change a run offers, up to its pull request. Nothing merges without you.",
              icon: "uraeda:eye",
              label: "Report only",
            }}
          >
            <Switch isLabelHidden label="Report only" onChange={setReportOnly} value={reportOnly} />
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
function JobPage({ job }: { job?: string }) {
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
            {job ?? "New job"}
          </PageTitle>
          <JobForm job={job} />
          {job !== undefined && <History />}
        </VStack>
      </Page>
    </Shell>
  );
}

const meta = {
  decorators: [inRepositoryFolder],
  parameters: { layout: "fullscreen" },
  title: "Mockups/Jobs/A job",
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

/** A job's page: its form, each field saved as it is left, then its history. */
export const JobOpen: Story = { render: () => <JobPage job="Dependencies" /> };

/** The same on the phone. */
export const JobOpenPhone: Story = { ...JobOpen, beforeEach: atMostWidth(PHONE) };

/** A new job: the same form, empty, ending with "Add the job". */
export const JobNew: Story = { render: () => <JobPage /> };
