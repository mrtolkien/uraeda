// The rows of what a job's runs start on: its agent, its model, and its effort, each a select.
// The agent's row shows what the file holds: an agent that is off here, or not installed, shows as
// itself, with the server's words for why the job does not run; "Default" clears the three, and
// the runs start on what a new session would. A model or an effort the agent no longer lists
// shows too, as itself.
import type { Form, Values } from "./form";
import { record } from "../../store";
import type { Job, RuntimeRecord } from "../../store/protocol";
import { type Option, Select, Text } from "../../ui/controls";
import { FieldRow } from "../../ui/lists/FieldRow";

/** The value of "the default", which no agent, model, or effort is named. */
const DEFAULT = "";

/** What opens a row's select, for its row's Enter. */
export type Openers = { agent?: () => void; effort?: () => void; model?: () => void };

/** The agent a job without one runs on: the settings' default agent while it is on here, else the first on. */
function defaultAgent(runtimes: ReadonlyArray<RuntimeRecord>, named: string | null | undefined) {
  const on = runtimes.filter((one) => one.isOn);
  return on.find((one) => one.id === named) ?? on[0];
}

export function AgentRows(props: {
  form: Form;
  job: () => Job | undefined;
  openers: Openers;
  repo: string;
}) {
  const agents = record("Agent", { repo: props.repo });
  const settings = record("Settings", null);
  const runtimes = () => agents()?.runtimes ?? [];
  const values = () => props.form.value();
  const fallback = () => defaultAgent(runtimes(), settings()?.runs.defaultAgent);
  /** The agent the runs start on: the job's own, else the default one. */
  const agent = () => {
    const named = values()?.agent ?? null;
    return named === null ? fallback() : runtimes().find((one) => one.id === named);
  };
  const models = () => agent()?.models?.models ?? [];
  const model = () => {
    const named = values()?.model ?? agent()?.models?.defaults.model ?? null;
    return models().find((one) => one.id === named);
  };

  const agentOptions = (): Array<Option> => {
    const named = values()?.agent ?? null;
    const listed: Array<Option> = [
      { hint: fallback()?.name ?? "none is on here", label: "Default", value: DEFAULT },
      ...runtimes().map((one) => ({
        hint: one.isOn ? undefined : "off here",
        label: one.name,
        value: one.id,
      })),
    ];
    if (named !== null && !runtimes().some((one) => one.id === named)) {
      listed.push({ hint: "not installed", label: named, value: named });
    }
    return listed;
  };
  const modelOptions = (): Array<Option> => {
    const named = values()?.model ?? null;
    const first = agent()?.models?.defaults.model;
    const listed: Array<Option> = [
      {
        hint: models().find((one) => one.id === first)?.name ?? first ?? undefined,
        label: "The agent's default",
        value: DEFAULT,
      },
      ...models().map((one) => ({ label: one.name, value: one.id })),
    ];
    if (named !== null && !models().some((one) => one.id === named)) {
      listed.push({ hint: "not listed", label: named, value: named });
    }
    return listed;
  };
  const effortOptions = (): Array<Option> => {
    const named = values()?.effort ?? null;
    const efforts = model()?.efforts ?? [];
    const first = agent()?.models?.defaults.effort;
    const listed: Array<Option> = [
      {
        hint: efforts.find((one) => one.id === first)?.name ?? first ?? undefined,
        label: "The model's default",
        value: DEFAULT,
      },
      ...efforts.map((one) => ({ label: one.name, value: one.id })),
    ];
    if (named !== null && !efforts.some((one) => one.id === named)) {
      listed.push({ hint: "not listed", label: named, value: named });
    }
    return listed;
  };

  /** A pick of the agent: "Default" clears the three, another agent its model and effort. */
  const pickAgent = (picked: string) =>
    props.form.change("agent", (all): Values => ({
      ...all,
      agent: picked === DEFAULT ? null : picked,
      effort: null,
      model: null,
    }));
  const pickModel = (picked: string) =>
    props.form.change("model", (all): Values => ({
      ...all,
      effort: null,
      model: picked === DEFAULT ? null : picked,
    }));

  /** Why the job does not run on its agent here, in the server's words. */
  const offWords = () => {
    const next = props.job()?.next;
    return next?.why === "agent-off" ? next.text : null;
  };

  return (
    <>
      <FieldRow
        control={
          <Select
            label="Agent"
            onChange={(picked) => void pickAgent(picked)}
            opener={(open) => (props.openers.agent = open)}
            options={agentOptions()}
            pending={props.form.pending("agent")}
            testID="job-agent"
            value={values()?.agent ?? DEFAULT}
            width={220}
          />
        }
        help="Its runs start on this agent, model, and effort. A change a run starts follows your run map."
        icon="bot"
        id="agent"
        label="Agent"
        refusal={props.form.refusal("agent")}
        under={
          <If when={offWords()}>
            {(words) => (
              <Text size="under" tone="danger">
                {words()}
              </Text>
            )}
          </If>
        }
      />
      <FieldRow
        control={
          <Select
            label="Model"
            onChange={(picked) => void pickModel(picked)}
            opener={(open) => (props.openers.model = open)}
            options={modelOptions()}
            pending={props.form.pending("model")}
            value={values()?.model ?? DEFAULT}
            width={220}
          />
        }
        help=""
        icon="brain"
        id="model"
        label="Model"
        refusal={props.form.refusal("model")}
      />
      <FieldRow
        control={
          <Select
            label="Effort"
            onChange={(picked) =>
              props.form.set("effort", "effort", picked === DEFAULT ? null : picked)
            }
            opener={(open) => (props.openers.effort = open)}
            options={effortOptions()}
            pending={props.form.pending("effort")}
            value={values()?.effort ?? DEFAULT}
            width={220}
          />
        }
        help=""
        icon="gauge"
        id="effort"
        label="Effort"
        refusal={props.form.refusal("effort")}
      />
    </>
  );
}
