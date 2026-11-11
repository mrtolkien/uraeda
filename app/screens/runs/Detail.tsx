// Under the run map, the place the cursor is on, to change: a step's or a role's agent and model,
// and its effort, the app's one picker (`AgentPick`); a joint's new session, a switch; where reviews happen, two
// segments; the reviewer to add, a button. `Enter` on the map opens the first select, `e` the
// effort's, as a press does.
import { View } from "nsh";
import type { RunOptions, RunPick, RuntimeRecord } from "../../store/protocol";
import { Button, Segmented, Switch, Text } from "../../ui/controls";
import { AgentPick } from "./AgentPick";
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
  /** A step that already ran: its controls show what it is, and say why they do not move. */
  locked?: boolean;
  /** The Agent record's agents, and `runs.default_agent`, as the picker reads them. */
  runtimes: ReadonlyArray<RuntimeRecord>;
  defaultAgent: string | null;
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

/** A pick's agent, model, and effort: the app's one picker, the agent always named here. */
function PickControls(props: DetailProps & { pick: NonNullable<ReturnType<typeof pickAt>> }) {
  return (
    <AgentPick
      defaultAgent={props.defaultAgent}
      disabled={props.disabled}
      onChange={(next) =>
        props.onPick(props.place, {
          agent: next.agent ?? resolve(props.pick, props.agents).agent?.id ?? "",
          // The agent's own default is said as "", which the server stores as itself (R301).
          effort: next.effort ?? "",
          model: next.model ?? "",
        })
      }
      openers={props.openers}
      runtimes={props.runtimes}
      value={props.pick}
    />
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
      <If when={props.locked === true}>
        <Text size="under" tone="quiet">
          This step already ran: what it ran on stays as it was. A change applies to the steps
          ahead.
        </Text>
      </If>
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
