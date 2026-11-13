// A job's form as data: what the form holds of a job, read from the record and written back as the
// actions take it, and the form's model, the same for a job that exists, whose fields each save as
// they are left or chosen (`patched`), and for a new one, whose fields wait for "Add the job".
import { signal, untracked } from "nsh";
import { clockOf } from "./words";
import type { Job, JobInput } from "../../store/protocol";
import { type Patched, patched, refusalOf } from "../../ui/controls";

/** The schedule's kinds, as its first word in the file. */
export type Kind = "hourly" | "daily" | "weekdays" | "weekly";

/** The days as the schedule writes them, Monday first, as the core numbers them from 1. */
const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

/** A new job's time, and a kind's that had none. */
const DEFAULT_TIME = "03:00";

/**
 * What the form holds of a job. A schedule that is not understood has no kind, and keeps its text,
 * which a save leaves as it is until a kind is picked.
 */
export type Values = {
  agent: string | null;
  day: number;
  effort: string | null;
  kind: Kind | null;
  model: string | null;
  name: string;
  prompt: string;
  raw: string;
  reportOnly: boolean;
  repositories: ReadonlyArray<string>;
  time: string;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** The values of a job as the file holds it. */
export function valuesOf(job: Job): Values {
  const { schedule } = job;
  return {
    agent: job.agent,
    day: schedule?.day ?? 1,
    effort: job.effort,
    kind: (schedule?.kind as Kind | undefined) ?? null,
    model: job.model,
    name: job.name,
    prompt: job.prompt,
    raw: job.scheduleText,
    reportOnly: job.reportOnly,
    repositories: job.repositories,
    time:
      schedule === null || schedule.kind === "hourly"
        ? DEFAULT_TIME
        : `${pad(schedule.hour)}:${pad(schedule.minute)}`,
  };
}

/** A new job: empty, every day at 03:00, in the page's repository, on the default agent. */
export const newValues = (repository: string): Values => ({
  agent: null,
  day: 1,
  effort: null,
  kind: "daily",
  model: null,
  name: "",
  prompt: "",
  raw: "",
  reportOnly: false,
  repositories: [repository],
  time: DEFAULT_TIME,
});

/** The schedule's text, one of the four forms, its time as the core reads it. */
function scheduleText(values: Values): string {
  const time = clockOf(values.time);
  switch (values.kind) {
    case null:
      return values.raw;
    case "hourly":
      return "hourly";
    case "weekly":
      return `${DAYS[values.day - 1]} ${time}`;
    default:
      return `${values.kind} ${time}`;
  }
}

/** The job as the actions take it. */
export function inputOf(values: Values): JobInput {
  return {
    agent: values.agent,
    effort: values.effort,
    model: values.model,
    name: values.name.trim(),
    prompt: values.prompt,
    reportOnly: values.reportOnly,
    repositories: [...values.repositories],
    schedule: scheduleText(values),
  };
}

/** The form's fields, each a row a refusal shows under. */
export type Field =
  | "name"
  | "prompt"
  | "kind"
  | "day"
  | "time"
  | "repositories"
  | "agent"
  | "model"
  | "effort"
  | "reportOnly"
  | "add";

/**
 * The field a refusal of the whole job belongs under, by the core's words: a new job's form is
 * sent whole, so its refusal is placed by what it says, else under its button.
 */
export function fieldOf(words: string): Field {
  if (words.startsWith("A job named")) return "name";
  if (words.startsWith("A job runs in one")) return "repositories";
  if (words.startsWith("A time is") || words.includes("is not understood")) return "time";
  return "add";
}

/**
 * A refusal as its field shows it: the core's fragment for a schedule it cannot read, "the
 * schedule “daily 3:0” is not understood", becomes a sentence with the way out.
 */
export function refusalWords(words: string | null): string | null {
  if (words === null || !words.includes("is not understood")) return words;
  const sentence = `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
  return `${sentence.endsWith(".") ? sentence : `${sentence}.`} Type the time as HH:MM, like 03:00.`;
}

/** The model a form draws: the values shown, a field's change, and what is refused where. */
export type Form = Pick<Patched<Values>, "change" | "pending" | "refusal" | "value"> & {
  /** Sets one field's value. */
  set: <K extends keyof Values>(at: Field, key: K, value: Values[K]) => void;
};

/** The form of a job that exists: each change saved after the ones before it, on what they wrote. */
export function savedForm(
  job: () => Job | undefined,
  send: (next: Values, before: Values) => Promise<unknown>,
): Form {
  const saves = patched(() => {
    const now = job();
    return now === undefined ? undefined : valuesOf(now);
  }, send);
  return {
    ...saves,
    set: (at, key, value) => void saves.change(at, (all) => ({ ...all, [key]: value })),
  };
}

/**
 * The form of a new job: its values its own, its texts from what the device kept (`typed`), until
 * `add` sends them whole.
 */
export function newForm(
  repository: string,
  add: (job: JobInput) => Promise<unknown>,
  typed: { name?: string; prompt?: string; time?: string } = {},
) {
  const start = newValues(repository);
  const values = signal<Values>({
    ...start,
    name: typed.name ?? start.name,
    prompt: typed.prompt ?? start.prompt,
    time: typed.time ?? start.time,
  });
  const refusals = signal<Partial<Record<Field, string>>>({});
  const adding = signal(false);
  const change = (at: string, patch: (all: Values) => Values) => {
    refusals.update((all) => ({ ...all, [at]: undefined, add: undefined }));
    values.update(patch);
    return Promise.resolve(null);
  };
  const form: Form = {
    change,
    pending: (at) => at === "add" && adding(),
    refusal: (at) => refusals()[at as Field] ?? null,
    set: (at, key, value) => void change(at, (all) => ({ ...all, [key]: value })),
    value: values,
  };
  const submit = async () => {
    if (untracked(adding)) return;
    adding.set(true);
    try {
      await add(inputOf(untracked(values)));
    } catch (error) {
      const words = refusalOf(error);
      refusals.update((all) => ({ ...all, [fieldOf(words)]: words }));
    }
    adding.set(false);
  };
  const filled = () => values().name.trim() !== "" && values().prompt.trim() !== "";
  return { filled, form, submit };
}
