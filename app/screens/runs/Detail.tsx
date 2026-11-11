// Under the run map, the place the cursor is on, to change: a step's or a role's agent and model,
// and its effort, each a select; a joint's new session, a switch; where reviews happen, two
// segments; the reviewer to add, a button. `Enter` on the map opens the first select, `e` the
// effort's, as a press does.
import { View } from "nsh";
import type { RunOptions, RunPick } from "../../store/protocol";
import { Button, Segmented, Select, Switch, Text } from "../../ui/controls";
import type { Option } from "../../ui/controls";
import {
  type Agents,
  depthOf,
  isSet,
  joint,
  pickAt,
  type Place,
  resolve,
  reviewer,
  reviewersOf,
  STEP_LOOKS,
  STEPS,
  withNewSession,
} from "./options";

/** What the detail asks of the map: a change, and the selects' openers for its keys. */
export type DetailProps = {
  agents: Agents;
  disabled: boolean;
  onChange: (next: RunOptions) => void;
  onPick: (place: Place, pick: RunPick) => void;
  onRemove: (index: number) => void;
  onReset: (place: Place) => void;
  openers: { model: (open: () => void) => void; effort: (open: () => void) => void };
  over: RunOptions | null;
  own: RunOptions;
  place: Place;
};

/** The words over the controls: what the place is. */
export function placeTitle(place: Place): string {
  switch (place.kind) {
    case "step":
      return `${STEP_LOOKS[place.step].name} runs on`;
    case "joint":
      return `Between ${STEP_LOOKS[STEPS[place.index - 1]!].name} and ${STEP_LOOKS[STEPS[place.index]!].name}`;
    case "implementers":
      return "The build's implementers run on";
    case "reviewer":
      return `Reviewer ${place.index + 1}`;
    case "add":
      return "Another reviewer";
    case "depth":
      return "Where reviews happen";
  }
}

/** The value of the agent-and-model select: an agent and a model, the model empty for its default. */
const modelValue = (agent: string, model: string) => `${agent}\n${model}`;

/** Every agent on, its default model first, then each model it lists. */
function modelOptions(agents: Agents): Array<Option> {
  return agents.on.flatMap((agent) => {
    const list = agent.models;
    const named = list?.models.find((one) => one.id === list.defaults.model)?.name;
    return [
      {
        hint: named === undefined ? "the agent's default" : `the agent's default, ${named}`,
        label: `${agent.name} · Default`,
        value: modelValue(agent.id, ""),
      },
      ...(list?.models ?? []).map((model) => ({
        hint: model.description ?? undefined,
        label: `${agent.name} · ${model.name}`,
        value: modelValue(agent.id, model.id),
      })),
    ];
  });
}

/** A pick's two selects: its agent and model, then its effort. */
function PickControls(props: DetailProps & { pick: NonNullable<ReturnType<typeof pickAt>> }) {
  const shown = () => resolve(props.pick, props.agents);
  const agentId = () => shown().agent?.id ?? "";
  const model = () => props.pick.model ?? "";
  const known = () => shown().agent?.models?.models.find((one) => one.id === shown().model);
  const efforts = (): Array<Option> => {
    const list = known()?.efforts ?? [];
    const fallback = shown().agent?.models?.defaults.effort;
    const named = list.find((one) => one.id === fallback)?.name ?? fallback;
    return [
      { hint: named ?? undefined, label: "Default", value: "" },
      ...list.map((one) => ({ label: one.name, value: one.id })),
    ];
  };
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      <Select
        disabled={props.disabled}
        hint={
          shown().defaultAgent
            ? `No agent picked: the default agent, ${shown().agent?.name ?? "none"}, ${
                props.agents.fallbackIsSet ? "as the settings name it" : "the first one on"
              }.`
            : undefined
        }
        label="Agent and model"
        onChange={(value) => {
          const [agent = "", picked = ""] = value.split("\n");
          const takes = shown().agent?.models?.models.find((one) => one.id === picked);
          const keeps = takes?.efforts.some((one) => one.id === props.pick.effort) === true;
          props.onPick(props.place, {
            agent,
            effort: keeps ? (props.pick.effort ?? "") : "",
            model: picked,
          });
        }}
        opener={props.openers.model}
        options={modelOptions(props.agents)}
        value={modelValue(agentId(), model())}
        width={300}
      />
      <Select
        disabled={props.disabled || (known() !== undefined && known()!.efforts.length === 0)}
        hint={
          known() !== undefined && known()!.efforts.length === 0
            ? "This model takes no effort."
            : undefined
        }
        label="Effort"
        onChange={(effort) =>
          props.onPick(props.place, { agent: agentId(), effort, model: model() })
        }
        opener={props.openers.effort}
        options={efforts()}
        value={props.pick.effort ?? ""}
        width={180}
      />
    </View>
  );
}

/** A joint: whether a new session starts there, and why it must when its steps differ. */
function JointControls(props: DetailProps & { index: number }) {
  const now = () => joint(props.own, props.over, props.agents, props.index);
  return (
    <Switch
      disabled={props.disabled || now().forced}
      hint={
        now().forced
          ? "Its two steps run on different agents or models: a new session always starts."
          : now().cuts
            ? "A new session starts here, with a clean context."
            : "The step goes on in the session before it."
      }
      label={now().cuts ? "New session" : "Same session"}
      onChange={(cuts) => props.onChange(withNewSession(props.own, props.index, cuts))}
      value={now().cuts}
    />
  );
}

export function Detail(props: DetailProps) {
  const reviewers = () => reviewersOf(props.own, props.over);
  const command = () =>
    props.place.kind === "reviewer" ? reviewers()[props.place.index]?.command : null;
  const pick = () => pickAt(props.own, props.over, props.place);
  return (
    <View style={{ gap: 8 }}>
      <Text bold>{placeTitle(props.place)}</Text>
      <If when={pick()}>{(held) => <PickControls {...props} pick={held()} />}</If>
      <If when={command()}>
        {(line) => <Text font="code">{`Runs ${line()} in the feature's worktree.`}</Text>}
      </If>
      <If when={props.place.kind === "joint" ? props.place.index : undefined}>
        {(index) => <JointControls {...props} index={index()} />}
      </If>
      <If when={props.place.kind === "depth"}>
        <Segmented
          disabled={props.disabled}
          label="Where reviews happen"
          onChange={(depth) => props.onChange({ ...props.own, reviewDepth: depth })}
          options={[
            { label: "Each wave and the branch", value: "waves" },
            { label: "The branch only", value: "branch" },
          ]}
          value={depthOf(props.own, props.over)}
        />
      </If>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <If when={props.place.kind === "add"}>
          <Button
            disabled={props.disabled}
            icon="plus"
            label="Add a reviewer"
            onPress={() =>
              props.onChange({
                ...props.own,
                reviewers: [
                  ...reviewers(),
                  reviewer(reviewers()[0]?.agent ?? props.agents.fallback?.id ?? null),
                ],
              })
            }
          />
        </If>
        <If when={!props.disabled && isSet(props.own, props.place)}>
          <Button
            icon="undo-2"
            label={props.over === null ? "Back to the default" : "Back to the settings'"}
            onPress={() => props.onReset(props.place)}
          />
        </If>
        <If when={props.place.kind === "reviewer" && reviewers().length > 1 && !props.disabled}>
          <Button
            icon="trash-2"
            label="Remove this reviewer"
            onPress={() => props.place.kind === "reviewer" && props.onRemove(props.place.index)}
            variant="danger"
          />
        </If>
      </View>
    </View>
  );
}
