// A job's form state: what the form holds, how it reads a job as the file holds it, and how it
// writes one back as the mutations take it, and the hook that saves a field as it is left (an
// existing job) or keeps the values until the job is added (a new one).
import { useRef, useState } from "react";
import type { JobInput } from "uraeda-binding";
import type { JobRow } from "uraeda-server/fate";

/** The schedule's kinds, as its control names them, each with its first word in the file. */
export const KINDS = [
  { kind: "hourly", label: "Hourly" },
  { kind: "daily", label: "Daily" },
  { kind: "weekdays", label: "Weekdays" },
  { kind: "weekly", label: "Weekly" },
] as const;

export type Kind = (typeof KINDS)[number]["kind"];

/** The days, Monday first as the core numbers them, written as the schedule's own form writes. */
export const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

/** A new job's, and a switched kind's, time of day. */
const DEFAULT_TIME = "03:00";

/**
 * The schedule as the control holds it: its kind, its day for Weekly, and its time as typed. A
 * schedule that is not understood has no kind, and keeps its text, which a save leaves as it is.
 */
type When = { day: number; kind: Kind | ""; raw: string; time: string };

/** What the form holds of a job. */
export type Values = {
  agent?: string;
  effort?: string;
  model?: string;
  name: string;
  prompt: string;
  reportOnly: boolean;
  repositories: ReadonlyArray<string>;
  when: When;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** The values of a job as the file holds it. */
function valuesOf(job: JobRow): Values {
  const { schedule } = job;
  return {
    ...(job.agent === null ? {} : { agent: job.agent }),
    ...(job.effort === null ? {} : { effort: job.effort }),
    ...(job.model === null ? {} : { model: job.model }),
    name: job.name,
    prompt: job.prompt,
    reportOnly: job.reportOnly,
    repositories: job.repositories,
    when:
      schedule === null
        ? { day: 1, kind: "", raw: job.scheduleText, time: DEFAULT_TIME }
        : {
            day: schedule.day ?? 1,
            kind: schedule.kind as Kind,
            raw: job.scheduleText,
            time:
              schedule.kind === "hourly"
                ? DEFAULT_TIME
                : `${pad(schedule.hour)}:${pad(schedule.minute)}`,
          },
  };
}

/** A new job: empty, Daily at 03:00, in `repository`. */
const newValues = (repository: string): Values => ({
  name: "",
  prompt: "",
  reportOnly: false,
  repositories: [repository],
  when: { day: 1, kind: "daily", raw: "", time: DEFAULT_TIME },
});

/** The schedule's text, one of the data model's four forms. */
function scheduleText({ day, kind, raw, time }: When): string {
  switch (kind) {
    case "":
      return raw;
    case "hourly":
      return "hourly";
    case "weekly":
      return `${DAYS[day - 1]} ${time}`;
    default:
      return `${kind} ${time}`;
  }
}

/** What the mutations take: the keys of an agent, a model, or an effort left out when unset. */
function inputOf(values: Values): JobInput {
  const { agent, effort, model, name, prompt, reportOnly, repositories, when } = values;
  return {
    ...(agent === undefined ? {} : { agent }),
    ...(effort === undefined ? {} : { effort }),
    ...(model === undefined ? {} : { model }),
    name,
    prompt,
    reportOnly,
    repositories: [...repositories],
    schedule: scheduleText(when),
  };
}

/** The rows a refusal can show under. */
export type Row = "agent" | "name" | "prompt" | "repositories" | "reportOnly" | "schedule";

/**
 * The row a refusal of the core belongs under, by its words, and the button's for any other:
 * a new job's form is refused as a whole.
 */
function rowOf(refusal: string): Row | "button" {
  if (refusal.startsWith("A job named")) {
    return "name";
  }
  if (refusal.startsWith("A job runs in one")) {
    return "repositories";
  }
  return refusal.startsWith("A time is") ? "schedule" : "button";
}

/** The text a line holds while it is typed in: not saved yet. */
type Drafts = { name?: string; prompt?: string; time?: string };

/**
 * The form's state. For an existing `job`, the values are the file's, live, and each change is
 * sent through `onSave` at once, a text when it is left; the text typed stays in a draft until it
 * is saved, and a refusal stays under its row until the row is changed again. For a new job, the
 * values are the form's own, and `add` sends them whole.
 */
export function useJobForm({
  job,
  onSave,
  repository,
}: {
  job: JobRow | undefined;
  onSave: (input: JobInput) => Promise<string | undefined>;
  repository: string;
}) {
  const [own, setOwn] = useState(() => newValues(repository));
  const [drafts, setDrafts] = useState<Drafts>({});
  const [refusals, setRefusals] = useState<Partial<Record<Row | "button", string>>>({});
  // A save under way: leaving a line right after its Enter saves it once.
  const saving = useRef(new Set<keyof Drafts | Row>());
  const values = job === undefined ? own : valuesOf(job);

  const refuse = (row: Row | "button", text: string | undefined) =>
    setRefusals((then) => ({ ...then, [row]: text }));

  /** Sends the job with `patch` applied, or for a new job, keeps it; the refusal shows under `row`. */
  const change = async (row: Row, patch: Partial<Values>) => {
    refuse(row, undefined);
    if (job === undefined) {
      setOwn((then) => ({ ...then, ...patch }));
      return false;
    }
    if (saving.current.has(row)) {
      return false;
    }
    saving.current.add(row);
    const refusal = await onSave(inputOf({ ...values, ...patch }));
    saving.current.delete(row);
    refuse(row, refusal);
    return refusal === undefined;
  };

  const text = (key: keyof Drafts) => {
    const draft = drafts[key];
    return draft ?? (key === "time" ? values.when.time : values[key]);
  };

  /** A line typed in. */
  const type = (key: keyof Drafts, value: string) => {
    const row = key === "time" ? "schedule" : key;
    refuse(row, undefined);
    if (job === undefined) {
      setOwn((then) =>
        key === "time"
          ? { ...then, when: { ...then.when, time: value } }
          : { ...then, [key]: value },
      );
    } else {
      setDrafts((then) => ({ ...then, [key]: value }));
    }
  };

  /** A line left, or its Enter: saved when it differs from the file's. */
  const leave = async (key: keyof Drafts) => {
    const draft = drafts[key];
    if (job === undefined || draft === undefined) {
      return;
    }
    const was = key === "time" ? values.when.time : values[key];
    const saved =
      draft === was ||
      (await change(
        key === "time" ? "schedule" : key,
        key === "time" ? { when: { ...values.when, time: draft } } : { [key]: draft },
      ));
    if (saved) {
      setDrafts(({ [key]: _, ...rest }) => rest);
    }
  };

  /** The schedule's kind or day picked: written with the time typed, if any. */
  const when = (next: Partial<When>) =>
    void change("schedule", {
      when: { ...values.when, time: drafts.time ?? values.when.time, ...next },
    });

  /** The new job, as it is. */
  const add = async () => {
    refuse("button", undefined);
    const refusal = await onSave(inputOf(own));
    if (refusal !== undefined) {
      refuse(rowOf(refusal), refusal);
    }
  };

  return { add, change, drafts, leave, refusals, text, type, values, when };
}

/** Whether the first line may be sent as a new job: a name and a prompt. */
export const isFilled = (values: Values) =>
  values.name.trim() !== "" && values.prompt.trim() !== "";
