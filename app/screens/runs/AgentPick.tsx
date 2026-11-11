// What a run starts on, an agent, a model, and an effort, picked the same way everywhere: by the
// run map's places, a job's form, and the New page's session. Two selects: the agent and its model
// in one ("Claude Code · Opus 5.5", "Claude Code · Default"), as a model belongs to its agent, then
// the effort the model takes. Left unpicked, each follows its default, which the select names: the
// default agent of Settings › Runs, or the first one on; the agent's model; the model's effort.
// An agent, a model, or an effort the value names that is no longer offered, off here or not
// installed, shows as itself, with why, so a saved value is never shown as another.
import { View } from "nsh";
import type { RuntimeRecord } from "../../store/protocol";
import { type Option, Select, Text } from "../../ui/controls";
import { agentsOf, type Pick, resolve } from "./options";

/** A pick as it is given back: `null` where the default is followed. */
export type Picked = { agent: string | null; model: string | null; effort: string | null };

export type AgentPickProps = {
  /** The Agent record's agents. */
  runtimes: ReadonlyArray<RuntimeRecord>;
  /** `runs.default_agent`: what "Default" runs on, when it is on. */
  defaultAgent: string | null;
  /** The pick now; an unset agent, model, or effort follows its default. */
  value: Pick;
  onChange: (next: Picked) => void;
  /** Whether "the default agent" is a choice of its own; else a pick always names its agent. */
  followsDefault?: boolean;
  /** Gets what opens each select, for a row's `Enter` or a key. */
  openers?: { model?: (open: () => void) => void; effort?: (open: () => void) => void };
  disabled?: boolean;
  pending?: boolean;
  /** What the agent's select says under it, in place of how its default was chosen. */
  hint?: string;
  testID?: string;
};

/** The agent-and-model select's value: an agent and a model, each empty for its default. */
const both = (agent: string, model: string) => `${agent}\n${model}`;

const blank = (value: string | null | undefined) => (value == null || value === "" ? null : value);

export function AgentPick(props: AgentPickProps) {
  const agents = () => agentsOf(props.runtimes, props.defaultAgent);
  const shown = () => resolve(props.value, agents());
  const named = () => blank(props.value.agent);
  const model = () => blank(props.value.model);
  const effort = () => blank(props.value.effort);
  /** The agent the value names, listed or not. */
  const agent = () => props.runtimes.find((one) => one.id === named()) ?? shown().agent;
  const known = () => agent()?.models?.models.find((one) => one.id === shown().model);

  const agentOptions = (): Array<Option> => {
    const fallback = agents().fallback;
    const out: Array<Option> =
      props.followsDefault === true
        ? [
            {
              hint:
                fallback === undefined
                  ? "no agent is on here"
                  : `${fallback.name}, its default model`,
              label: "The default agent",
              value: both("", ""),
            },
          ]
        : [];
    for (const one of agents().on) {
      const list = one.models;
      const first = list?.models.find((each) => each.id === list.defaults.model)?.name;
      out.push({
        hint: first === undefined ? "the agent's own" : `the agent's own, ${first}`,
        label: `${one.name} · Default`,
        value: both(one.id, ""),
      });
      for (const each of list?.models ?? []) {
        out.push({
          hint: each.description ?? undefined,
          label: `${one.name} · ${each.name}`,
          value: both(one.id, each.id),
        });
      }
    }
    const value = current();
    if (!out.some((one) => one.value === value)) {
      const off = props.runtimes.find((one) => one.id === named());
      out.push({
        hint:
          off === undefined ? "not installed here" : model() === null ? "off here" : "not listed",
        label: `${off?.name ?? named() ?? "Agent"} · ${model() ?? "Default"}`,
        value,
      });
    }
    return out;
  };
  /** The select's value: the default agent's own entry, or the agent named and its model. */
  const current = () =>
    named() === null && props.followsDefault === true
      ? both("", "")
      : both(named() ?? shown().agent?.id ?? "", model() ?? "");

  const effortOptions = (): Array<Option> => {
    const list = known()?.efforts ?? [];
    const first = agent()?.models?.defaults.effort;
    const out: Array<Option> = [
      {
        hint: list.find((one) => one.id === first)?.name ?? first ?? undefined,
        label: "Default",
        value: "",
      },
      ...list.map((one) => ({ label: one.name, value: one.id })),
    ];
    const set = effort();
    if (set !== null && !list.some((one) => one.id === set)) {
      out.push({ hint: "not listed", label: set, value: set });
    }
    return out;
  };
  const takesNone = () => known() !== undefined && known()!.efforts.length === 0;

  const agentHint = () => {
    if (props.hint !== undefined) return props.hint;
    if (named() !== null) return undefined;
    const fallback = agents().fallback;
    if (fallback === undefined) return "No agent is on here: Settings › Extensions turns one on.";
    return agents().fallbackIsSet
      ? `The default agent, ${fallback.name}, as Settings › Runs names it.`
      : `The default agent, ${fallback.name}, the first one on: Settings › Runs names one.`;
  };

  return (
    <View style={{ gap: 4 }} testID={props.testID}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <Select
          disabled={props.disabled}
          label="Agent and model"
          onChange={(value) => {
            const [picked = "", chosen = ""] = value.split("\n");
            const takes = props.runtimes
              .find((one) => one.id === picked)
              ?.models?.models.find((one) => one.id === chosen);
            const keeps = takes?.efforts.some((one) => one.id === effort()) === true;
            props.onChange({
              agent: blank(picked),
              effort: keeps ? effort() : null,
              model: blank(chosen),
            });
          }}
          opener={props.openers?.model}
          options={agentOptions()}
          pending={props.pending}
          testID={props.testID === undefined ? undefined : `${props.testID}-model`}
          value={current()}
          width={300}
        />
        <Select
          disabled={props.disabled === true || takesNone()}
          label="Effort"
          onChange={(picked) =>
            props.onChange({
              agent:
                named() ?? (props.followsDefault === true ? null : (shown().agent?.id ?? null)),
              effort: blank(picked),
              model: model(),
            })
          }
          opener={props.openers?.effort}
          options={effortOptions()}
          pending={props.pending}
          testID={props.testID === undefined ? undefined : `${props.testID}-effort`}
          value={effort() ?? ""}
          width={180}
        />
      </View>
      {/* Under both, so the two selects keep one line while the window has room. */}
      <If when={agentHint() ?? (takesNone() ? "This model takes no effort." : undefined)}>
        {(words) => (
          <Text size="under" tone="quiet">
            {words()}
          </Text>
        )}
      </If>
    </View>
  );
}
