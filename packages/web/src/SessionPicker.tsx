// What a new session runs on, picked as it starts: one button naming the agent, the model, and the
// effort, which opens a menu of the agents on here, then the agent's models, then the model's
// efforts. "Default" leaves the choice to the agent, and says what the agent would pick. Another
// agent starts from its defaults again, and a model that lacks the effort picked falls back to
// Default. A model without efforts has no Effort group.
import {
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  type DropdownMenuTriggerProps,
} from "@astryxdesign/core/DropdownMenu";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import type { ComponentProps } from "react";

/** An icon's name, as Astryx's `Icon` takes it. */
type IconName = ComponentProps<typeof Icon>["icon"];

/** A reasoning effort a model takes: its ID, as the agent names it, and its name for people. */
export type PickerEffort = { id: string; name: string };

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

/** What a new session runs on: a model or an effort left out is the agent's own default. */
export type SessionPick = { effort?: string; model?: string; runtime: string };

/** The value of "Default" in a radio group, which no agent's ID takes. */
const DEFAULT = "";

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

/**
 * The button's text: the agent, the model, and the effort the session would run on, defaults
 * resolved: "Codex · GPT-6.1-Sol · Medium". What the agent does not say is left out.
 */
export function pickLabel(runtime: PickerRuntime, pick: SessionPick): string {
  const model = modelRun(runtime, pick);
  const effort =
    model && model.efforts.length > 0
      ? effortName(model, pick.effort ?? runtime.defaults.effort)
      : undefined;
  return [runtime.name, model?.name ?? (pick.model === undefined ? "Default" : pick.model), effort]
    .filter((part): part is string => part !== undefined)
    .join(" · ");
}

/** The pick after choosing `model`: its effort kept while the new model takes it. */
export function withModel(runtime: PickerRuntime, pick: SessionPick, model: string): SessionPick {
  const next = { runtime: pick.runtime, ...(model === DEFAULT ? {} : { model }) };
  const takes = modelRun(runtime, next)?.efforts.some((effort) => effort.id === pick.effort);
  return pick.effort !== undefined && takes ? { ...next, effort: pick.effort } : next;
}

/**
 * The picker over `runtimes`, those on here, in their order: `value` while its agent is one of
 * them, else the first one, on its defaults.
 */
export function SessionPicker({
  onChange,
  runtimes,
  value,
}: {
  onChange: (pick: SessionPick) => void;
  runtimes: ReadonlyArray<PickerRuntime>;
  value: SessionPick | undefined;
}) {
  const first = runtimes[0];
  if (!first) {
    return null;
  }
  const runtime = runtimes.find((each) => each.kind === value?.runtime) ?? first;
  const pick: SessionPick = value?.runtime === runtime.kind ? value : { runtime: runtime.kind };
  const model = modelRun(runtime, pick);
  const defaultModel = modelOf(runtime, runtime.defaults.model);
  const defaultEffort = effortName(model, runtime.defaults.effort);
  const label = pickLabel(runtime, pick);
  return (
    <DropdownMenu
      // Room for an agent's models and a model's efforts without scrolling, the viewport allowing.
      menuMaxHeight={560}
      presentation="popover"
      renderTrigger={(props: DropdownMenuTriggerProps) => (
        <Button
          icon={<Icon icon={runtime.icon} />}
          label={label}
          size="sm"
          variant="ghost"
          {...props}
        />
      )}
    >
      {runtimes.length > 1 && (
        <DropdownMenuGroup title="Agent">
          <DropdownMenuRadioGroup
            hasCloseOnSelect={false}
            label="Agent"
            onChange={(kind: string) => onChange({ runtime: kind })}
            value={runtime.kind}
          >
            {runtimes.map((each) => (
              <DropdownMenuRadioItem
                icon={each.icon}
                key={each.kind}
                label={each.name}
                value={each.kind}
              />
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      )}
      <DropdownMenuGroup title="Model">
        <DropdownMenuRadioGroup
          hasCloseOnSelect={false}
          label="Model"
          onChange={(id: string) => onChange(withModel(runtime, pick, id))}
          value={pick.model ?? DEFAULT}
        >
          <DropdownMenuRadioItem
            label="Default"
            value={DEFAULT}
            {...(defaultModel ? { description: defaultModel.name } : {})}
          />
          {runtime.models.map((each) => (
            <DropdownMenuRadioItem
              key={each.id}
              label={each.name}
              value={each.id}
              {...(each.description ? { description: each.description } : {})}
            />
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuGroup>
      {model && model.efforts.length > 0 && (
        <DropdownMenuGroup title="Effort">
          <DropdownMenuRadioGroup
            hasCloseOnSelect={false}
            label="Effort"
            onChange={(id: string) => {
              const { effort: _, ...rest } = pick;
              onChange(id === DEFAULT ? rest : { ...rest, effort: id });
            }}
            value={pick.effort ?? DEFAULT}
          >
            <DropdownMenuRadioItem
              label="Default"
              value={DEFAULT}
              {...(defaultEffort ? { description: defaultEffort } : {})}
            />
            {model.efforts.map((each) => (
              <DropdownMenuRadioItem key={each.id} label={each.name} value={each.id} />
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      )}
    </DropdownMenu>
  );
}
