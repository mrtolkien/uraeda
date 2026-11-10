// A job's form state: what the form holds, how it reads a job as the file holds it, and how it
// writes one back as the mutations take it, and the hook that saves a field as it is left (an
// existing job) or keeps the values until the job is added (a new one).
import { useEffect, useRef, useState } from "react";
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

/** A time as the core reads it, two digits for the hour: "9:30" is "09:30". */
const clock = (time: string) => time.trim().replace(/^(\d):/, "0$1:");

/** The schedule's text, one of the data model's four forms. */
function scheduleText({ day, kind, raw, time: typed }: When): string {
  const time = clock(typed);
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
  // The core's words for a schedule it cannot read, a fragment: "the schedule “daily 25:00” is ...".
  return refusal.startsWith("A time is") || refusal.startsWith("the schedule")
    ? "schedule"
    : "button";
}

/** The text a line holds while it is typed in: not saved yet. */
type Drafts = { name?: string; prompt?: string; time?: string };

/** A change of the job: what it sets, given the job as it stands when the change is applied. */
type Patch = (values: Values) => Partial<Values>;

/** What the form shows beyond the file's job, and what its saves read. */
type Settled = {
  /** The job as the latest accepted save wrote it, until the record shows it. */
  accepted: Values | undefined;
  /** The changes sent or waiting, which the controls already show. */
  pending: ReadonlyArray<{ id: number; patch: Patch }>;
};

const apply = (values: Values, patch: Patch): Values => ({ ...values, ...patch(values) });

/**
 * The saves of an existing `job`: each change is a patch, shown at once on the file's values and
 * saved after the ones before it, applied on the job as the latest accepted save wrote it and sent
 * through `onSave` with the name the job has then. `shown` are the values with the changes still
 * being saved, so a control moves at once and a refusal puts it back; `enqueue` gives the refusal.
 */
function useSaves(
  job: JobRow | undefined,
  onSave: (input: JobInput, was: string) => Promise<string | undefined>,
) {
  const [settled, setSettled] = useState<Settled>({ accepted: undefined, pending: [] });
  // What a queued save reads: the settled state and the job, as of now.
  const latest = useRef({ job, settled });
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const count = useRef(0);
  const commit = (next: Settled) => {
    latest.current.settled = next;
    setSettled(next);
  };
  useEffect(() => {
    latest.current.job = job;
    // Idle, the record shows what the saves wrote.
    if (latest.current.settled.pending.length === 0 && latest.current.settled.accepted) {
      commit({ accepted: undefined, pending: [] });
    }
  }, [job]);

  const save = async (id: number, patch: Patch) => {
    const { job: current, settled: now } = latest.current;
    if (current === undefined) {
      return "The job is gone.";
    }
    const base = now.accepted ?? valuesOf(current);
    const next = apply(base, patch);
    const refusal = await onSave(inputOf(next), base.name);
    const then = latest.current.settled;
    commit({
      accepted: refusal === undefined ? { ...next, name: next.name.trim() } : then.accepted,
      pending: then.pending.filter((one) => one.id !== id),
    });
    return refusal;
  };

  const enqueue = (patch: Patch) => {
    const id = ++count.current;
    const { settled: now } = latest.current;
    commit({ ...now, pending: [...now.pending, { id, patch }] });
    const saved = queue.current.then(() => save(id, patch));
    queue.current = saved.catch(() => undefined);
    return saved;
  };

  const shown =
    job === undefined
      ? undefined
      : settled.pending.reduce(
          (then, { patch }) => apply(then, patch),
          settled.accepted ?? valuesOf(job),
        );
  return { enqueue, shown };
}

/**
 * The lines of an existing job while they are typed: a text stays in its draft until a save of
 * exactly that text is accepted, so text typed after an Enter is not wiped by that Enter's answer.
 * A new job's lines go straight to its own values (`setOwn`).
 */
function useDrafts({
  change,
  job,
  refuse,
  setOwn,
  values,
}: {
  change: (row: Row, patch: Patch | Partial<Values>) => Promise<boolean>;
  job: JobRow | undefined;
  refuse: (row: Row, text: string | undefined) => void;
  setOwn: (update: (then: Values) => Values) => void;
  values: Values;
}) {
  const [drafts, setDrafts] = useState<Drafts>({});
  // The text of each line sent and not answered yet: leaving the line after its Enter sends it once.
  const sending = useRef<Drafts>({});

  const text = (key: keyof Drafts) => {
    const draft = drafts[key];
    return draft ?? (key === "time" ? values.when.time : values[key]);
  };

  /** A line typed in. */
  const type = (key: keyof Drafts, value: string) => {
    refuse(key === "time" ? "schedule" : key, undefined);
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

  /**
   * A line left, or its Enter: sent when it differs from the job's, and cleared from the drafts once
   * the save of that very text is accepted: text typed meanwhile stays.
   */
  const leave = async (key: keyof Drafts) => {
    const draft = drafts[key];
    if (job === undefined || draft === undefined || sending.current[key] === draft) {
      return;
    }
    const was = key === "time" ? values.when.time : values[key];
    let saved = draft === was;
    if (!saved) {
      sending.current[key] = draft;
      saved = await change(
        key === "time" ? "schedule" : key,
        key === "time" ? (then) => ({ when: { ...then.when, time: draft } }) : { [key]: draft },
      );
      if (sending.current[key] === draft) {
        delete sending.current[key];
      }
    }
    if (saved) {
      setDrafts((then) => {
        const { [key]: now, ...rest } = then;
        return now === draft ? rest : then;
      });
    }
  };

  return { drafts, leave, text, type };
}

/**
 * The form's state. For an existing `job`, the values are the file's with the changes still being
 * saved on them (`useSaves`). A text is sent when it is left, and stays in a draft until a save of
 * exactly that text is accepted; a refusal stays under its row until the row is changed again. For
 * a new job, the values are the form's own, and `add` sends them whole.
 */
export function useJobForm({
  job,
  onSave,
  repository,
}: {
  job: JobRow | undefined;
  onSave: (input: JobInput, was: string) => Promise<string | undefined>;
  repository: string;
}) {
  const [own, setOwn] = useState(() => newValues(repository));
  const [refusals, setRefusals] = useState<Partial<Record<Row | "button", string>>>({});
  const { enqueue, shown } = useSaves(job, onSave);
  const values = shown ?? own;

  const refuse = (row: Row | "button", text: string | undefined) =>
    setRefusals((then) => ({ ...then, [row]: text }));

  /**
   * Applies `patch` to the job, shown at once and saved after the saves before it, or for a new job
   * keeps it. The refusal shows under `row`. Gives whether the job was saved.
   */
  const change = async (row: Row, patch: Patch | Partial<Values>) => {
    refuse(row, undefined);
    const make: Patch = typeof patch === "function" ? patch : () => patch;
    if (job === undefined) {
      setOwn((then) => apply(then, make));
      return false;
    }
    const refusal = await enqueue(make);
    refuse(row, refusal);
    return refusal === undefined;
  };
  const { drafts, leave, text, type } = useDrafts({ change, job, refuse, setOwn, values });

  /** The schedule's kind or day picked: written with the time typed, if any. */
  const when = (next: Partial<When>) => {
    const typed = drafts.time;
    void change("schedule", (then) => ({
      when: { ...then.when, time: typed ?? then.when.time, ...next },
    }));
  };

  /** The new job, as it is. */
  const add = async () => {
    refuse("button", undefined);
    const refusal = await onSave(inputOf(own), "");
    if (refusal !== undefined) {
      refuse(rowOf(refusal), refusal);
    }
  };

  return { add, change, drafts, leave, refusals, text, type, values, when };
}

/** Whether the first line may be sent as a new job: a name and a prompt. */
export const isFilled = (values: Values) =>
  values.name.trim() !== "" && values.prompt.trim() !== "";
