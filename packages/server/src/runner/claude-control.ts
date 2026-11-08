/**
 * Claude Code's control requests, as a process writes them and reads their answers, and what its
 * answers to `list_models` and `get_settings` say: the models offered, and what a process runs on.
 */
import { randomUUID } from "node:crypto";
import type { AgentModel, ModelList } from "./adapter.ts";
import { effortName } from "./efforts.ts";
import type { AgentEvent } from "./events.ts";

type Json = Record<string, unknown>;
const isJson = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const field = (value: unknown, key: string): unknown => (isJson(value) ? value[key] : undefined);
const textOf = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

/** The answer to one of the adapter's control requests: its payload, or the agent's error. */
export type ControlAnswer = { error?: string; id: string; response?: unknown };

/** The answer a `control_response` line carries, by its request's ID: undefined for other lines. */
export function controlAnswer(line: string): ControlAnswer | undefined {
  if (!line.includes('"control_response"')) {
    return undefined;
  }
  let message: unknown;
  try {
    message = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (!isJson(message) || message.type !== "control_response" || !isJson(message.response)) {
    return undefined;
  }
  const { error, request_id: id, response, subtype } = message.response;
  if (typeof id !== "string") {
    return undefined;
  }
  return subtype === "success" ? { id, response } : { error: textOf(error) ?? "Refused", id };
}

/** The rows of a `list_models` answer, but its `default` row, which stands for one of the others. */
function modelRows(listModels: unknown): Array<Json & { value: string }> {
  const models = field(listModels, "models");
  return (Array.isArray(models) ? models : []).filter(
    (row): row is Json & { value: string } =>
      isJson(row) && typeof row.value === "string" && row.value !== "default",
  );
}

/** The row of `model`, an ID Claude Code runs on: the row resolving to it, else the row it names. */
function rowOf(rows: ReturnType<typeof modelRows>, model: string) {
  return rows.find((row) => row.resolvedModel === model) ?? rows.find((row) => row.value === model);
}

/**
 * The models of Claude Code's `list_models` and `get_settings` answers: each row but the `default`
 * one and those that drop `auto` mode, which an unattended run cannot do without, its `value` as
 * the ID. The defaults are the configured model, else the row of the one it runs on, and the
 * effort it runs on.
 */
export function claudeModels(listModels: unknown, getSettings: unknown): ModelList {
  const rows = modelRows(listModels);
  const models = rows
    .filter((row) => row.supportsAutoMode === true)
    .map((row): AgentModel => {
      const levels = field(row, "supportedEffortLevels");
      const description = textOf(row.description);
      return {
        ...(description === undefined ? {} : { description }),
        efforts: (Array.isArray(levels) ? levels : [])
          .filter((id): id is string => typeof id === "string")
          .map((id) => ({ id, name: effortName(id) })),
        id: row.value,
        name: textOf(row.displayName) ?? row.value,
      };
    });
  const applied = field(getSettings, "applied");
  const running = textOf(field(applied, "model"));
  const model =
    textOf(field(field(getSettings, "effective"), "model")) ??
    (running === undefined ? undefined : rowOf(rows, running)?.value);
  const effort = textOf(field(applied, "effort"));
  return {
    defaults: {
      ...(effort === undefined ? {} : { effort }),
      ...(model === undefined ? {} : { model }),
    },
    models,
  };
}

/**
 * What a process runs on, from its `get_settings` answer, by names: the model's from the
 * `list_models` answer, else its ID, and the effort's. Undefined when the answer names no model.
 */
export function claudeRunsOn(
  listModels: unknown,
  getSettings: unknown,
): Extract<AgentEvent, { type: "runsOn" }> | undefined {
  const applied = field(getSettings, "applied");
  const model = textOf(field(applied, "model"));
  if (model === undefined) {
    return undefined;
  }
  const effort = textOf(field(applied, "effort"));
  const row = rowOf(modelRows(listModels), model);
  return {
    model: textOf(row?.displayName) ?? model,
    type: "runsOn",
    ...(effort === undefined ? {} : { effort: effortName(effort) }),
  };
}

/** A process's control requests, and the answers it waits for, by their IDs. */
export class Controls {
  #waiting = new Map<string, (answer: ControlAnswer) => void>();
  #ended: string | undefined;
  #write: (value: unknown) => void;

  constructor(write: (value: unknown) => void) {
    this.#write = write;
  }

  /** Writes `request`, its answer unread. */
  send(request: Json) {
    this.#write({ request, request_id: randomUUID(), type: "control_request" });
  }

  /** Writes `request`, and gives its answer's payload: rejected on the agent's error, or its end. */
  ask(request: Json): Promise<unknown> {
    if (this.#ended !== undefined) {
      return Promise.reject(new Error(this.#ended));
    }
    const id = randomUUID();
    const answer = new Promise<unknown>((resolve, reject) => {
      this.#waiting.set(id, ({ error, response }) =>
        error === undefined ? resolve(response) : reject(new Error(error)),
      );
    });
    this.#write({ request, request_id: id, type: "control_request" });
    return answer;
  }

  /** Gives `line` to the request it answers: false when it is no answer. */
  answer(line: string): boolean {
    const answer = controlAnswer(line);
    if (answer === undefined) {
      return false;
    }
    this.#waiting.get(answer.id)?.(answer);
    this.#waiting.delete(answer.id);
    return true;
  }

  /** Rejects the requests waiting, and those asked from now on, with `why`. */
  end(why: string) {
    this.#ended ??= why;
    for (const [id, settle] of this.#waiting) {
      settle({ error: why, id });
    }
    this.#waiting.clear();
  }
}
