// What a session runs on: one button naming the agent, the model, and the effort, which opens the
// app's key picker in two steps. First the model, among every agent on here, each agent's "Default"
// first, then its models, searchable by name; then the picked model's effort, "Default" first. A
// model without efforts skips the second step. In a session already started, the button names the
// effort alone, and opens the second step: the agent and the model stay, the effort applies from the
// next turn. "Default" leaves the choice to the agent, and says what the agent would pick.
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { useState } from "react";
import { KeyPicker } from "./keys/KeyPicker.tsx";
import { type PickerItem, textPreview } from "./keys/pickerSources.ts";
import type { IconName } from "./keys/store.ts";

/** A reasoning effort a model takes: its ID, as the agent names it, its name, and its line. */
export type PickerEffort = { description?: string; id: string; name: string };

/** A model an agent lists, with the efforts it takes, in the agent's order. */
export type PickerModel = {
  description?: string;
  efforts: ReadonlyArray<PickerEffort>;
  id: string;
  name: string;
};

/** An agent on here, with its models, and what it runs on when nothing is picked. */
export type PickerRuntime = {
  /** The model and the effort the agent would run on, by their IDs, when it says. */
  defaults: { effort?: string; model?: string };
  icon: IconName;
  kind: string;
  models: ReadonlyArray<PickerModel>;
  name: string;
};

/** What a session runs on: a model or an effort left out is the agent's own default. */
export type SessionPick = { effort?: string; model?: string; runtime: string };

function modelOf(runtime: PickerRuntime, id: string | undefined): PickerModel | undefined {
  return id === undefined ? undefined : runtime.models.find((model) => model.id === id);
}

/** The model the session would run on: the one picked, else the agent's default. */
function modelRun(runtime: PickerRuntime, pick: SessionPick): PickerModel | undefined {
  return modelOf(runtime, pick.model ?? runtime.defaults.model);
}

/** The name of an effort, among the model's, else its ID as the agent gave it. */
function effortName(model: PickerModel | undefined, id: string | undefined): string | undefined {
  if (id === undefined) {
    return undefined;
  }
  return model?.efforts.find((effort) => effort.id === id)?.name ?? id;
}

/** The effort the session would run on, by its name: none for a model without efforts. */
function effortRun(runtime: PickerRuntime, pick: SessionPick): string | undefined {
  const model = modelRun(runtime, pick);
  return model && model.efforts.length > 0
    ? effortName(model, pick.effort ?? runtime.defaults.effort)
    : undefined;
}

/**
 * The button's text: the agent, the model, and the effort the session would run on, defaults
 * resolved: "Codex · GPT-6.1-Sol · Medium". What the agent does not say is left out.
 */
export function pickLabel(runtime: PickerRuntime, pick: SessionPick): string {
  const model = modelRun(runtime, pick);
  return [runtime.name, model?.name ?? pick.model ?? "Default", effortRun(runtime, pick)]
    .filter((part): part is string => part !== undefined)
    .join(" · ");
}

/** The pick after choosing `model` of `runtime`: the effort kept while the model takes it. */
export function withModel(
  runtime: PickerRuntime,
  pick: SessionPick,
  model: string | undefined,
): SessionPick {
  const next: SessionPick = { runtime: runtime.kind, ...(model === undefined ? {} : { model }) };
  const takes =
    pick.runtime === runtime.kind &&
    modelRun(runtime, next)?.efforts.some((effort) => effort.id === pick.effort);
  return pick.effort !== undefined && takes ? { ...next, effort: pick.effort } : next;
}

/** A model's preview: its line, then the efforts it takes, its default named. */
function modelPreview(runtime: PickerRuntime, model: PickerModel | undefined) {
  const efforts = model?.efforts.map((effort) => effort.name).join(", ");
  return textPreview(
    ...[
      model?.description,
      efforts ? `Efforts: ${efforts}` : "Takes no effort.",
      model && model.efforts.length > 0 && runtime.defaults.effort !== undefined
        ? `Default effort: ${effortName(model, runtime.defaults.effort)}`
        : undefined,
    ].filter((line): line is string => typeof line === "string"),
  );
}

/** Between an agent's kind and a model's ID in a row's ID: neither holds it. */
const SEP = "\u0000";

/** A model row's ID: the agent's kind, then the model's ID, empty for "Default". */
const modelId = (kind: string, model?: string) => `${kind}${SEP}${model ?? ""}`;

/** "Default", then what it resolves to when the agent says: "Default · GPT-6.1-Sol". */
const defaultTitle = (resolved: string | undefined) =>
  resolved === undefined ? "Default" : `Default · ${resolved}`;

/**
 * The first step's rows: each agent's "Default", its title naming what it resolves to, then its
 * models, the pick marked "picked". Rows carry the agent's mark, so several agents read apart.
 */
export function modelItems(
  runtimes: ReadonlyArray<PickerRuntime>,
  pick: SessionPick,
): ReadonlyArray<PickerItem> {
  return runtimes.flatMap((runtime) => {
    const picked = (model?: string) =>
      pick.runtime === runtime.kind && pick.model === model ? "picked" : undefined;
    const fallback = modelOf(runtime, runtime.defaults.model);
    const row = (model: PickerModel | undefined, side: string | undefined): PickerItem => ({
      icon: runtime.icon,
      id: modelId(runtime.kind, model?.id),
      kind: "notes",
      path: "",
      preview: modelPreview(runtime, model ?? fallback),
      title: `${runtime.name} · ${model?.name ?? defaultTitle(fallback?.name)}`,
      ...(side === undefined ? {} : { aside: side }),
    });
    return [
      row(undefined, picked()),
      ...runtime.models.map((model) => row(model, picked(model.id))),
    ];
  });
}

/** The second step's rows: "Default", naming what it resolves to, then the model's efforts. */
export function effortItems(runtime: PickerRuntime, pick: SessionPick): ReadonlyArray<PickerItem> {
  const model = modelRun(runtime, pick);
  const picked = (id?: string) => (pick.effort === id ? "picked" : undefined);
  const row = (effort: PickerEffort | undefined, side: string | undefined): PickerItem => ({
    icon: runtime.icon,
    id: effort?.id ?? "",
    kind: "notes",
    path: "",
    preview: textPreview(
      effort
        ? (effort.description ?? effort.name)
        : `The effort ${runtime.name}'s own settings give ${model?.name ?? "this model"}.`,
    ),
    title: effort?.name ?? defaultTitle(effortName(model, runtime.defaults.effort)),
    ...(side === undefined ? {} : { aside: side }),
  });
  return [
    row(undefined, picked()),
    ...(model?.efforts ?? []).map((effort) => row(effort, picked(effort.id))),
  ];
}

/**
 * The button and its picker over `runtimes`, those on here, in their order: `value` while its
 * agent is one of them, else the first one, on its defaults. With `isStarted`, the session runs
 * already: the button names the effort, and opens the effort step alone. `step` opens a step from
 * outside, as `Space a` does.
 */
export function SessionPicker({
  isStarted = false,
  onChange,
  runtimes,
  step: opened,
  value,
}: {
  isStarted?: boolean;
  onChange: (pick: SessionPick) => void;
  runtimes: ReadonlyArray<PickerRuntime>;
  step?: "model" | "effort";
  value: SessionPick | undefined;
}) {
  const [step, setStep] = useState(opened);
  const first = runtimes[0];
  if (!first) {
    return null;
  }
  const runtime = runtimes.find((each) => each.kind === value?.runtime) ?? first;
  const pick: SessionPick = value?.runtime === runtime.kind ? value : { runtime: runtime.kind };
  const model = modelRun(runtime, pick);
  if (isStarted && (model?.efforts.length ?? 0) === 0) {
    return null;
  }
  const label = isStarted
    ? `Effort · ${effortRun(runtime, pick) ?? "Default"}`
    : pickLabel(runtime, pick);
  return (
    <>
      <Button
        icon={<Icon icon={runtime.icon} />}
        label={label}
        onClick={() => setStep(isStarted ? "effort" : "model")}
        size="sm"
        variant="ghost"
      />
      <KeyPicker
        isOpen={step === "model"}
        items={modelItems(runtimes, pick)}
        label="Find a model"
        onClose={() => setStep(undefined)}
        onPick={(item) => {
          const [kind, id] = item.id.split(SEP);
          const owner = runtimes.find((each) => each.kind === kind) ?? runtime;
          const next = withModel(owner, pick, id === "" ? undefined : id);
          onChange(next);
          setStep((modelRun(owner, next)?.efforts.length ?? 0) > 0 ? "effort" : undefined);
        }}
        placeholder="Model…"
        start={modelId(runtime.kind, pick.model)}
        title="Pick the model"
      />
      <KeyPicker
        isOpen={step === "effort"}
        items={effortItems(runtime, pick)}
        label="Find an effort"
        onClose={() => setStep(undefined)}
        onPick={(item) => {
          const { effort: _, ...rest } = pick;
          onChange(item.id === "" ? rest : { ...rest, effort: item.id });
          setStep(undefined);
        }}
        placeholder="Effort…"
        start={pick.effort ?? ""}
        title={`Pick the effort of ${model?.name ?? runtime.name}`}
      />
    </>
  );
}
