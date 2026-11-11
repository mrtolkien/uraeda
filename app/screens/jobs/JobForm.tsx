// A job's form, in the settings' rows (`FieldRow`): its name, its prompt, its schedule (how often,
// the day of a weekly one, the time), the repositories it runs in, its agent, model, and effort,
// and "Report only". One cursor crosses the rows, `j` `k`, and Enter does a row's act: a field
// takes the focus, a select opens, a box or a switch flips. An existing job saves each field as it
// is left, and a choice as it is made (`savedForm`); a new job's waits for "Add the job".
import { View } from "nsh";
import { AgentRows, type Openers } from "./AgentRows";
import { type Field, type Form, type Kind, refusalWords, type Values } from "./form";
import { Typed } from "./Typed";
import { clockOf, DAY_NAMES, nextFacts } from "./words";
import { record } from "../../store";
import type { Job } from "../../store/protocol";
import { Button, Checkbox, type Option, Select, Switch, Text } from "../../ui/controls";
import { FieldRow, FieldRows, type RowSpec } from "../../ui/lists";
import type { TextFieldRef } from "../../ui/text";

const KINDS: ReadonlyArray<Option<Kind>> = [
  { hint: "at the hour's start", label: "Hourly", value: "hourly" },
  { label: "Daily", value: "daily" },
  { hint: "Monday to Friday", label: "Weekdays", value: "weekdays" },
  { label: "Weekly", value: "weekly" },
];

const DAYS: ReadonlyArray<Option> = DAY_NAMES.map((name, at) => ({
  label: name,
  value: String(at + 1),
}));

/** What the form needs besides its model. */
export type JobFormProps = {
  form: Form;
  /** The job as the record shows it: none for a new one. */
  job: () => Job | undefined;
  /** Where the device keeps the fields' text: per job, or the new job's. */
  keptAs: string;
  /** The clock its next run reads against. */
  now: () => number;
  repo: string;
  /** A new job's button, which sends it whole once its name and prompt are filled. */
  add?: { filled: () => boolean; submit: () => void };
};

/** The schedule's note, under its row: when the job runs next, or why it does not. */
function Next(props: { job: Job; now: number }) {
  return (
    <View style={{ gap: 2 }}>
      <Each of={nextFacts(props.job, props.now)}>
        {(fact) => (
          <Text size="under" tone={fact().tone ?? "quiet"}>
            {fact().label}
          </Text>
        )}
      </Each>
    </View>
  );
}

/** Where it runs, in words. */
const runsIn = (names: ReadonlyArray<string>) =>
  names.length === 0 ? "Runs in no repository yet." : `Runs in ${names.join(", ")}.`;

/** The repositories it can run in: Uraeda's list, and any it names that left the list. */
function useRepositories(form: Form) {
  const listed = record("Repositories", null);
  return () => [
    ...new Set([
      ...(listed()?.rows ?? []).map((one) => one.name),
      ...(form.value()?.repositories ?? []),
    ]),
  ];
}

export function JobForm(props: JobFormProps) {
  const form = props.form;
  const values = () => form.value();
  const names = useRepositories(form);
  const fields: Partial<Record<"name" | "prompt" | "time", TextFieldRef>> = {};
  const opens: Openers & { kind?: () => void; day?: () => void } = {};
  const isNew = props.add !== undefined;

  const ticked = (name: string) => values()?.repositories.includes(name) === true;
  const tick = (name: string, on: boolean) =>
    void form.change("repositories", (all): Values => ({
      ...all,
      repositories: on
        ? [...all.repositories, name]
        : all.repositories.filter((one) => one !== name),
    }));
  const pick = (at: Field, next: Partial<Values>) =>
    void form.change(at, (all): Values => ({ ...all, ...next }));
  const kind = () => values()?.kind ?? null;

  const rows = (): ReadonlyArray<RowSpec> => [
    { act: () => fields.name?.focus(), id: "name" },
    { act: () => fields.prompt?.focus(), id: "prompt" },
    { act: () => opens.kind?.(), id: "kind" },
    ...(kind() === "weekly" ? [{ act: () => opens.day?.(), id: "day" }] : []),
    ...(kind() !== null && kind() !== "hourly"
      ? [{ act: () => fields.time?.focus(), id: "time" }]
      : []),
    { id: "repositories" },
    ...names().map((name) => ({ act: () => tick(name, !ticked(name)), id: `repo:${name}` })),
    { act: () => opens.agent?.(), id: "agent" },
    { act: () => opens.model?.(), id: "model" },
    { act: () => opens.effort?.(), id: "effort" },
    {
      act: () => form.set("reportOnly", "reportOnly", !(values()?.reportOnly ?? false)),
      id: "reportOnly",
    },
    ...(props.add === undefined ? [] : [{ act: () => props.add?.submit(), id: "add" }]),
  ];

  return (
    <FieldRows rows={rows}>
      <FieldRow
        control={
          <Typed
            at="name"
            form={form}
            isNew={isNew}
            keptAs={`${props.keptAs}:name`}
            label="Name"
            placeholder="Dependencies"
            ref={(field) => (fields.name = field)}
            saved={() => values()?.name ?? ""}
            testID="job-name"
            width={260}
            write={(all, text) => ({ ...all, name: text })}
          />
        }
        help="Shown on its card and in each run's session."
        icon="flag"
        id="name"
        label="Name"
        refusal={form.refusal("name")}
      />
      <FieldRow
        help="What each run is asked. It may name a skill or a file of the repository to follow."
        icon="message-square"
        id="prompt"
        label="Prompt"
        refusal={form.refusal("prompt")}
        under={
          <Typed
            at="prompt"
            form={form}
            isNew={isNew}
            keptAs={`${props.keptAs}:prompt`}
            label="Prompt"
            lines="many"
            placeholder="Upgrade the dependencies to their latest versions, and offer the change."
            ref={(field) => (fields.prompt = field)}
            saved={() => values()?.prompt ?? ""}
            testID="job-prompt"
            write={(all, text) => ({ ...all, prompt: text })}
          />
        }
      />
      <FieldRow
        control={
          <Select
            label="How often"
            onChange={(next) => pick("kind", { kind: next })}
            opener={(open) => (opens.kind = open)}
            options={KINDS}
            pending={form.pending("kind")}
            placeholder={`“${values()?.raw ?? ""}”`}
            testID="job-kind"
            value={kind()}
            width={160}
          />
        }
        help="In the server's local time. A time that passes while Uraeda is not running is missed."
        icon="calendar-clock"
        id="kind"
        label="Schedule"
        refusal={refusalWords(form.refusal("kind"))}
        under={<If when={props.job()}>{(job) => <Next job={job()} now={props.now()} />}</If>}
      />
      <If when={kind() === "weekly"}>
        <FieldRow
          control={
            <Select
              label="Day"
              onChange={(next) => pick("day", { day: Number(next) })}
              opener={(open) => (opens.day = open)}
              options={DAYS}
              pending={form.pending("day")}
              testID="job-day"
              value={String(values()?.day ?? 1)}
              width={160}
            />
          }
          help=""
          icon="calendar-clock"
          id="day"
          label="Day"
          refusal={refusalWords(form.refusal("day"))}
        />
      </If>
      <If when={kind() !== null && kind() !== "hourly"}>
        <FieldRow
          control={
            <Typed
              at="time"
              form={form}
              isNew={isNew}
              keptAs={`${props.keptAs}:time`}
              label="Time"
              placeholder="03:00"
              ref={(field) => (fields.time = field)}
              same={(a, b) => clockOf(a) === clockOf(b)}
              saved={() => values()?.time ?? ""}
              testID="job-time"
              width={96}
              write={(all, text) => ({ ...all, time: clockOf(text) })}
            />
          }
          help="Hours and minutes, on 24 hours: 3:00 is 03:00."
          icon="clock"
          id="time"
          label="Time"
          refusal={refusalWords(form.refusal("time"))}
        />
      </If>
      <FieldRow
        from={runsIn(values()?.repositories ?? [])}
        help="Each repository gets its own run, a minute apart."
        icon="folder-git-2"
        id="repositories"
        label="Repositories"
        refusal={form.refusal("repositories")}
      />
      <Each key={(name: string) => name} of={names()}>
        {(name) => (
          <FieldRow
            control={
              <Checkbox
                label={`Runs in ${name()}`}
                onChange={(on) => tick(name(), on)}
                testID={`job-repo-${name()}`}
                value={ticked(name())}
              />
            }
            help=""
            icon="git-branch"
            id={`repo:${name()}`}
            label={name()}
          />
        )}
      </Each>
      <AgentRows form={form} job={props.job} openers={opens} repo={props.repo} />
      <FieldRow
        control={
          <Switch
            label={values()?.reportOnly === true ? "on" : "off"}
            onChange={(on) => form.set("reportOnly", "reportOnly", on)}
            pending={form.pending("reportOnly")}
            testID="job-report-only"
            value={values()?.reportOnly ?? false}
          />
        }
        help="Its runs start no change: one they offer waits for you in the run's session. Off, Uraeda starts the change a run offers, up to its pull request. Nothing merges without you."
        icon="eye"
        id="reportOnly"
        label="Report only"
        refusal={form.refusal("reportOnly")}
      />
      <If when={props.add}>
        {(add) => (
          <FieldRow
            control={
              <Button
                disabled={!add().filled()}
                icon="plus"
                label="Add the job"
                onPress={add().submit}
                pending={form.pending("add")}
                testID="job-add"
                variant="main"
              />
            }
            help="It runs from its next time. Fill its name and its prompt first."
            icon="plus"
            id="add"
            label="Add the job"
            refusal={form.refusal("add")}
          />
        )}
      </If>
    </FieldRows>
  );
}
