// What a feature's start shows once it is planned (rule 9: no dead end): where the work went, its
// steps landing as the write queue runs them, the proposal's commit with its hooks, then its branch
// and worktree, and, once the feature can be read, the way to its page. A refused step says why,
// with what the hooks printed, and the way back. A feature's first run waits on its page for the
// human's Continue, its message shown there; a change's is the server's, sent once it landed.
import { View } from "nsh";
import { navigate, record } from "../../store";
import type { QueuedWrite, StartStep } from "../../store/protocol";
import { Banner, Button, Heading, Icon, Spinner, Text } from "../../ui/controls";
import type { IconName } from "../../ui/controls";
import { usePane } from "../../ui/layout";
import { Well } from "../../ui/surfaces";
import { tokens } from "../../ui/tokens";
import type { Tone } from "../../ui/tokens";

/** What a start planned, kept by the pane that started it. */
export type Started = { folder: string; kind: "feature" | "change"; title: string };

/**
 * The start a pane made, kept in its visit, as a pane keeps only plain values: Back to the pane
 * shows the start where it was left.
 */
export function rememberStarted(pane: ReturnType<typeof usePane>) {
  const kept = pane.remember<string>("started", "");
  const read = (): Started | null => (kept() === "" ? null : (JSON.parse(kept()) as Started));
  return Object.assign(read, {
    set: (value: Started | null) => kept.set(value === null ? "" : JSON.stringify(value)),
  });
}

const MARKS: Record<StartStep["state"], { icon: IconName; tone: Tone }> = {
  done: { icon: "circle-check", tone: "done" },
  refused: { icon: "circle-x", tone: "danger" },
  running: { icon: "circle-dot", tone: "live" },
  waiting: { icon: "circle-dot", tone: "quiet" },
};

/** "Done in 2 s", "Running", "Waiting", "Refused". */
function stateWords(step: StartStep): string {
  switch (step.state) {
    case "done":
      return step.seconds === null ? "Done" : `Done in ${Math.max(1, Math.round(step.seconds))} s`;
    case "running":
      return "Running";
    case "refused":
      return "Refused";
    default:
      return "Waiting";
  }
}

function StepLine(props: { step: StartStep }) {
  const mark = () => MARKS[props.step.state];
  return (
    <View style={{ gap: 4 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <If
          when={props.step.state === "running"}
          else={<Icon colour={tokens.control.tone(mark().tone)} name={mark().icon} />}
        >
          <Spinner />
        </If>
        <Text style={{ flex: 1, minWidth: 0 }}>{props.step.label}</Text>
        <Text size="under" tone={mark().tone}>
          {stateWords(props.step)}
        </Text>
      </View>
      <If when={props.step.state === "refused" ? props.step.output : null}>
        {(output) => (
          <Well>
            <Text font="code">{output()}</Text>
          </Well>
        )}
      </If>
    </View>
  );
}

/** The start's write, while the queue holds it. */
function Steps(props: { write: QueuedWrite }) {
  return (
    <View style={{ gap: 8 }}>
      <Each of={props.write.steps ?? []}>{(step) => <StepLine step={step()} />}</Each>
      <If when={props.write.state === "refused"}>
        <Banner tone="danger" title="The start was refused">
          {props.write.failure === "hook"
            ? "A hook refused the commit: fix what it printed, then start again. Your text and your options are kept."
            : "Nothing was started: read why above, then start again."}
        </Banner>
      </If>
    </View>
  );
}

/**
 * The start of `started` in `repo`: its steps while they land, then its feature's page. `onAgain`
 * goes back to where the start was made, for another start or after a refusal.
 */
export function Landing(props: {
  repo: string;
  started: Started;
  onAgain: () => void;
  againLabel: string;
}) {
  const queue = record("WriteQueue", { repo: props.repo });
  const write = () => queue()?.writes.find((one) => one.folder === props.started.folder);
  const feature = record("Feature", { id: props.started.folder, repo: props.repo });
  const landed = () => write() === undefined && feature() != null;
  const open = () => navigate({ folder: props.started.folder, page: "feature", repo: props.repo });
  return (
    <View style={{ gap: 14, maxWidth: 760 }} testID="start-landing">
      <View style={{ gap: 4 }}>
        <Text size="under" tone="quiet">
          {landed() ? `The ${props.started.kind} started` : `Starting the ${props.started.kind}`}
        </Text>
        <Heading level={2}>{props.started.title}</Heading>
        <Text font="code" size="under" tone="faint">
          {`specs/${props.started.folder}/`}
        </Text>
      </View>
      <If
        when={write()}
        else={
          <If when={landed()} else={<Spinner label="Waiting for the start's commit to land" />}>
            <Text tone="quiet">
              Its branch and worktree are made. Its first run waits on its page, with the message it
              sends: Continue there sends it.
            </Text>
          </If>
        }
      >
        {(held) => <Steps write={held()} />}
      </If>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button
          disabled={!landed()}
          icon="arrow-right"
          keys="Enter"
          label={`Open the ${props.started.kind}`}
          onPress={open}
          testID="start-open"
          variant="main"
        />
        <Button icon="undo-2" label={props.againLabel} onPress={props.onAgain} />
      </View>
    </View>
  );
}
