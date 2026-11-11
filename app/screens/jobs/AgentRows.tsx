// The row of what a job's runs start on: its agent, its model, and its effort, the app's one
// picker (`../runs/AgentPick.tsx`). "The default agent" clears the three, and the runs start on
// what a new session would. What the file names shows as itself even when it is no longer offered:
// an agent off here, or not installed, with the server's words for why the job does not run.
import type { Form, Values } from "./form";
import { record } from "../../store";
import type { Job } from "../../store/protocol";
import { Text } from "../../ui/controls";
import { FieldRow } from "../../ui/lists/FieldRow";
import { AgentPick } from "../runs/AgentPick";

/** What opens the row's selects, for its row's `Enter` and its `e`. */
export type Openers = { effort?: () => void; model?: () => void };

export function AgentRows(props: {
  form: Form;
  job: () => Job | undefined;
  openers: Openers;
  repo: string;
}) {
  const agents = record("Agent", { repo: props.repo });
  const settings = record("Settings", null);
  const values = () => props.form.value();

  /** Why the job does not run on its agent here, in the server's words. */
  const offWords = () => {
    const next = props.job()?.next;
    return next?.why === "agent-off" ? next.text : null;
  };

  return (
    <FieldRow
      control={
        <AgentPick
          defaultAgent={settings()?.runs.defaultAgent ?? null}
          followsDefault
          onChange={(next) =>
            void props.form.change("agent", (all): Values => ({ ...all, ...next }))
          }
          openers={{
            effort: (open) => (props.openers.effort = open),
            model: (open) => (props.openers.model = open),
          }}
          pending={props.form.pending("agent")}
          runtimes={agents()?.runtimes ?? []}
          testID="job-agent"
          value={{
            agent: values()?.agent ?? null,
            effort: values()?.effort ?? null,
            model: values()?.model ?? null,
          }}
        />
      }
      help="Its runs start on this agent, model, and effort; `e` picks the effort. A change a run starts follows your run map."
      icon="bot"
      id="agent"
      label="Runs on"
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
  );
}
