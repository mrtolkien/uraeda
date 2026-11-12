// A feature's next run, before it is sent: the workflow's message, whole, and how each step runs,
// the run map on the feature's own options, read over the settings', at its full size (rule 3).
// The map's changes are the feature's, saved at once; the run starts only from the dialog's Start,
// its first focus, which Enter presses: the dialog is the deliberate step, and holds no field.
// Without a feature, an errand of the default branch, as the decisions check: the message alone,
// sent as a new chat in the main checkout, on the agent a new session runs on.
import { Scroll, signal, View, windowSize } from "nsh";
import { call, navigate, record } from "../../store";
import type { RunOptions, Trigger } from "../../store/protocol";
import { Button, Text } from "../../ui/controls";
import { sent } from "../../ui/controls";
import { Dialog, Well } from "../../ui/surfaces";
import { width, windowWidth } from "../../ui/width";
import { NONE } from "./options";
import { RunMap } from "./RunMap";

/**
 * A run to continue with: its button's words, the workflow's message, and what starts it: none for
 * an errand, which is no step's run.
 */
export type Continue = {
  label: string;
  text: string;
  step: string | null;
  trigger: Trigger | null;
};

export type ContinueDialogProps = {
  repo: string;
  /** The feature's folder, or `null` for a chat of the main checkout. */
  folder: string | null;
  run: Continue;
  open: boolean;
  onClose: () => void;
};

/** Sends the run: to the feature, or as a new chat; answers the session it went to. */
async function sendRun(props: ContinueDialogProps): Promise<string> {
  const { folder, repo, run } = props;
  const workflow =
    run.trigger === null ? {} : { workflow: { step: run.step, trigger: run.trigger } };
  if (folder !== null) {
    return (await call("session.send", { folder, repo, text: run.text, ...workflow })).session;
  }
  const made = await call("session.newChat", { repo });
  return (await call("session.send", { repo, session: made.session, text: run.text })).session;
}

function Ask(props: ContinueDialogProps) {
  const feature = record("Feature", { id: props.folder ?? "", repo: props.repo });
  const settings = record("Settings", null);
  const agents = record("Agent", { repo: props.repo });
  const own = sent<RunOptions>(
    () => feature()?.runOptions.own ?? NONE,
    (options) =>
      call("feature.setRunOptions", { folder: props.folder ?? "", options, repo: props.repo }),
  );
  const refusal = signal<string | null>(null);
  const pending = signal(false);
  const start = async () => {
    if (pending()) return;
    pending.set(true);
    refusal.set(null);
    try {
      const session = await sendRun(props);
      props.onClose();
      navigate({ id: session, page: "session-id", repo: props.repo });
    } catch (error) {
      refusal.set((error as Error).message);
    }
    pending.set(false);
  };
  return (
    <View style={{ flexShrink: 1, gap: 14, maxHeight: windowSize().height * 0.8 - 72 }}>
      <Scroll style={{ flexShrink: 1 }}>
        <View style={{ gap: 14, paddingBottom: 4 }}>
          <Text tone="quiet">The message it sends</Text>
          <Well>
            <Text font="code">{props.run.text}</Text>
          </Well>
          <If when={props.folder === null}>
            <Text tone="quiet">
              It starts a new chat in the main checkout, on the agent a new session runs on.
            </Text>
          </If>
          <If when={props.folder !== null}>
            <Text tone="quiet">
              How each step runs, for this feature: a change is saved at once, and applies from this
              run on. What you leave follows the settings.
            </Text>
          </If>
          <If
            when={props.folder === null ? undefined : settings()?.runs}
            else={
              <If when={props.folder !== null}>
                <Text tone="faint">Reading the settings' run options…</Text>
              </If>
            }
          >
            {(runs) => (
              <RunMap
                active={() => props.open}
                column={width() !== "wide"}
                defaultAgent={runs().defaultAgent}
                disabled={pending()}
                onChange={own.set}
                over={runs().options}
                refusal={own.refusal()}
                runtimes={agents()?.runtimes ?? []}
                testID="continue-map"
                value={own.value()}
              />
            )}
          </If>
        </View>
      </Scroll>
      <If when={refusal()}>{(words) => <Text tone="danger">{words()}</Text>}</If>
      <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
        <Button label="Cancel" onPress={props.onClose} />
        <Button
          first
          icon="play"
          // Enter presses it, its focus; Ctrl+Enter too once the map's keys took Enter.
          keys="mod+Enter"
          label={props.run.label}
          onPress={() => void start()}
          pending={pending()}
          testID="continue-start"
          variant="main"
        />
      </View>
    </View>
  );
}

export function ContinueDialog(props: ContinueDialogProps) {
  return (
    <Dialog
      icon="play"
      onClose={props.onClose}
      open={props.open}
      title={props.run.label}
      width={props.folder !== null && width() === "wide" ? Math.min(1180, windowWidth() - 48) : 640}
    >
      <If when={props.open}>
        <Ask {...props} />
      </If>
    </Dialog>
  );
}
