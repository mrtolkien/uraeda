// The form of a job, in the settings' rows: Name, Prompt, Schedule, Repositories, Agent, and Report
// only. An existing job saves each field as it is left, a line also on Enter, through `onSave`,
// which answers the refusal in words, shown under its field with the typed text kept, while the
// file keeps its value; a choice is saved as it is made. A new job's form keeps its values until
// "Add the job", and starts Daily at 03:00 in the repository the page is of.
import { Button } from "@astryxdesign/core/Button";
import { CheckboxList, CheckboxListItem } from "@astryxdesign/core/CheckboxList";
import { HStack } from "@astryxdesign/core/HStack";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Selector } from "@astryxdesign/core/Selector";
import { Switch } from "@astryxdesign/core/Switch";
import { Text } from "@astryxdesign/core/Text";
import { colorVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import type { JobInput } from "uraeda-binding";
import type { JobRow } from "uraeda-server/fate";
import { TextField } from "../fields/TextField.tsx";
import { TextLine } from "../fields/TextLine.tsx";
import { Pane } from "../layout/Pane.tsx";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { SettingRow, SettingRows } from "../settings/SettingRow.tsx";
import { type PickerRuntime, type SessionPick, SessionPicker } from "../SessionPicker.tsx";
import { nextFact } from "./facts.ts";
import { Refusal } from "./JobCard.tsx";
import { DAYS, isFilled, type Kind, KINDS, useJobForm } from "./useJobForm.ts";
import { scheduleWords } from "./words.ts";

const styles = stylex.create({
  problem: { color: colorVars["--color-error"] },
});

type Form = ReturnType<typeof useJobForm>;

/** The next run's words after the schedule's, for an existing job. */
function ScheduleNotes({ job, now, zone }: { job: JobRow; now: Date; zone: string }) {
  const next = nextFact(job, now, zone);
  const first = job.schedule === null ? undefined : `${scheduleWords(job.schedule)}.`;
  const sentence =
    next.tone === "problem"
      ? next.text
      : job.next.at === null
        ? next.text
        : `Next run ${next.text.charAt(0).toLowerCase()}${next.text.slice(1)}`;
  return (
    <Text color="secondary">
      {first} <Text xstyle={next.tone === "problem" && styles.problem}>{sentence}.</Text>
    </Text>
  );
}

/**
 * One choice among a few: a segmented control, or on the phone, where its segments would run past
 * the screen, a selector, which opens as a sheet.
 */
function Choice({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ label: string; short?: string; value: string }>;
  value: string;
}) {
  if (isNarrow(useWidthClass())) {
    return (
      <Selector
        isLabelHidden
        label={label}
        onChange={onChange}
        options={options.map(({ label: text, value: each }) => ({ label: text, value: each }))}
        value={value}
      />
    );
  }
  return (
    <SegmentedControl label={label} onChange={onChange} value={value}>
      {options.map((each) => (
        <SegmentedControlItem
          key={each.value}
          label={each.short ?? each.label}
          value={each.value}
        />
      ))}
    </SegmentedControl>
  );
}

/** The kinds and the days as the choices list them: the days short beside each other. */
const KIND_OPTIONS = KINDS.map(({ kind, label }) => ({ label, value: kind }));
const DAY_OPTIONS = DAYS.map((each, index) => {
  const name = `${each.charAt(0).toUpperCase()}${each.slice(1)}`;
  return { label: name, short: name.slice(0, 3), value: String(index + 1) };
});

/** The schedule's control: its kind, its day for Weekly, and its time but for Hourly. */
function Schedule({ form }: { form: Pick<Form, "leave" | "text" | "type" | "values" | "when"> }) {
  const { values } = form;
  const { day, kind } = values.when;
  return (
    <VStack gap={2}>
      <Choice
        label="How often"
        onChange={(next) => form.when({ kind: next as Kind })}
        options={KIND_OPTIONS}
        value={kind}
      />
      {kind === "weekly" && (
        <Choice
          label="Day"
          onChange={(next) => form.when({ day: Number(next) })}
          options={DAY_OPTIONS}
          value={String(day)}
        />
      )}
      {kind !== "hourly" && kind !== "" && (
        <TextLine
          isLabelHidden
          label="Time"
          onBlur={() => void form.leave("time")}
          onChange={(next: string) => form.type("time", next)}
          onEnter={() => void form.leave("time")}
          value={form.text("time")}
          width="6rem"
        />
      )}
    </VStack>
  );
}

/** The agent's row: the picker a new session uses, and "Default" while the job has an agent. */
function AgentPick({
  form,
  runtimes,
}: {
  form: Pick<Form, "change" | "values">;
  runtimes: ReadonlyArray<PickerRuntime>;
}) {
  const { agent, effort, model } = form.values;
  const value: SessionPick | undefined =
    agent === undefined
      ? undefined
      : {
          runtime: agent,
          ...(model === undefined ? {} : { model }),
          ...(effort === undefined ? {} : { effort }),
        };
  return (
    <HStack align="center" gap={2} wrap="wrap">
      <SessionPicker
        onChange={(pick) =>
          void form.change("agent", {
            agent: pick.runtime,
            effort: pick.effort,
            model: pick.model,
          })
        }
        runtimes={runtimes}
        value={value}
      />
      {agent !== undefined && (
        <Button
          label="Default"
          onClick={() =>
            void form.change("agent", { agent: undefined, effort: undefined, model: undefined })
          }
          size="sm"
          variant="secondary"
        />
      )}
    </HStack>
  );
}

/** A row's control with its refusal under it. */
function Under({ children, refusal }: { children: ReactNode; refusal: string | undefined }) {
  return (
    <VStack gap={1}>
      {children}
      <Refusal refusal={refusal} />
    </VStack>
  );
}

/** The rows of the lines and of the schedule: the job's name, its prompt, and when it runs. */
function WhenRows({
  form,
  job,
  now,
  zone,
}: {
  form: Form;
  job: JobRow | undefined;
  now: Date;
  zone: string;
}) {
  const { refusals } = form;
  return (
    <>
      <SettingRow
        setting={{
          help: "Shown here and in each run's session.",
          icon: "uraeda:flag",
          label: "Name",
        }}
      >
        <Under refusal={refusals.name}>
          <TextLine
            isLabelHidden
            label="Name"
            onBlur={() => void form.leave("name")}
            onChange={(next: string) => form.type("name", next)}
            onEnter={() => void form.leave("name")}
            value={form.text("name")}
            width="16rem"
          />
        </Under>
      </SettingRow>
      <SettingRow
        isUnderWide
        setting={{
          help: "What each run is asked. It may name a skill or a file of the repository to follow.",
          icon: "uraeda:bot",
          label: "Prompt",
        }}
        under={
          <Under refusal={refusals.prompt}>
            <TextField
              isLabelHidden
              kind="notes"
              label="Prompt"
              onBlur={() => void form.leave("prompt")}
              onChange={(next: string) => form.type("prompt", next)}
              value={form.text("prompt")}
            />
          </Under>
        }
      />
      <SettingRow
        notes={job !== undefined && <ScheduleNotes job={job} now={now} zone={zone} />}
        setting={{
          help: "In the server's local time. A time that passes while Uraeda is not running is missed.",
          icon: "uraeda:hourglass",
          label: "Schedule",
        }}
      >
        <Under refusal={refusals.schedule}>
          <Schedule form={form} />
        </Under>
      </SettingRow>
    </>
  );
}

/** The rows of the choices: the repositories, the agent, and "Report only". */
function ChoiceRows({
  form,
  repositories,
  runtimes,
}: {
  form: Form;
  repositories: ReadonlyArray<string>;
  runtimes: ReadonlyArray<PickerRuntime>;
}) {
  const { refusals, values } = form;
  // The list, and any repository the job names that it lacks, which its card says.
  const listed = [...new Set([...repositories, ...values.repositories])];
  return (
    <>
      <SettingRow
        setting={{
          help: "Each repository gets its own run, a minute apart.",
          icon: "uraeda:git-branch",
          label: "Repositories",
        }}
      >
        <Under refusal={refusals.repositories}>
          <CheckboxList
            label="Runs in"
            onChange={(next: Array<string>) =>
              void form.change("repositories", { repositories: next })
            }
            value={[...values.repositories]}
          >
            {listed.map((each) => (
              <CheckboxListItem key={each} label={each} value={each} />
            ))}
          </CheckboxList>
        </Under>
      </SettingRow>
      <SettingRow
        notes={
          values.agent === undefined && (
            <Text color="secondary">Default: what a new session runs on.</Text>
          )
        }
        setting={{
          help: "Its runs start on this agent, model, and effort. A change it starts follows your run map.",
          icon: "uraeda:harness-claude",
          label: "Agent",
        }}
      >
        <Under refusal={refusals.agent}>
          <AgentPick form={form} runtimes={runtimes} />
        </Under>
      </SettingRow>
      <SettingRow
        setting={{
          help: "Its runs start no change: one they offer waits for you in the run's session. Off, Uraeda starts the change a run offers, up to its pull request. Nothing merges without you.",
          icon: "uraeda:eye",
          label: "Report only",
        }}
      >
        <Under refusal={refusals.reportOnly}>
          <Switch
            isLabelHidden
            label="Report only"
            onChange={(on: boolean) => void form.change("reportOnly", { reportOnly: on })}
            value={values.reportOnly}
          />
        </Under>
      </SettingRow>
    </>
  );
}

/**
 * The job's form. `job` is an existing job, saved field by field through `onSave`; without it, a
 * new job, whose `onSave` receives the whole job when "Add the job" is pressed. `repositories` are
 * those of Uraeda's list, `repository` the page's own, and `runtimes` the agents on here.
 */
export function JobForm({
  job,
  now,
  onSave,
  repositories,
  repository,
  runtimes,
  zone,
}: {
  job?: JobRow | undefined;
  now: Date;
  onSave: (input: JobInput) => Promise<string | undefined>;
  repositories: ReadonlyArray<string>;
  repository: string;
  runtimes: ReadonlyArray<PickerRuntime>;
  /** The server's time zone, which the times read in. */
  zone: string;
}) {
  const form = useJobForm({ job, onSave, repository });
  return (
    <Pane icon="uraeda:history" isSnugOnPhone title={job === undefined ? "New job" : "Job"}>
      <VStack gap={3}>
        <SettingRows>
          <WhenRows form={form} job={job} now={now} zone={zone} />
          <ChoiceRows form={form} repositories={repositories} runtimes={runtimes} />
        </SettingRows>
        {job === undefined && (
          <VStack gap={2}>
            <Refusal refusal={form.refusals.button} />
            <HStack justify="end">
              <Button
                isDisabled={!isFilled(form.values)}
                label="Add the job"
                onClick={() => void form.add()}
                variant="primary"
              />
            </HStack>
          </VStack>
        )}
      </VStack>
    </Pane>
  );
}
