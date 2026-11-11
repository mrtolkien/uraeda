// A feature's next run, before it is sent: the workflow's message, whole, and how each step runs,
// the run map on the feature's own options, read over the settings', at its full size (rule 3).
// The map's changes are the feature's, saved at once; the run starts only from the dialog's Start,
// its first focus, which Enter presses: the dialog is the deliberate step, and holds no field.
import { Scroll, signal, View, windowSize } from "nsh";
import { call, navigate, record } from "../../store";
import type { RunOptions, Trigger } from "../../store/protocol";
import { Button, Text } from "../../ui/controls";
import { sent } from "../../ui/controls";
import { Dialog, Well } from "../../ui/surfaces";
import { width, windowWidth } from "../../ui/width";
import { NONE } from "./options";
import { RunMap } from "./RunMap";

/** A run to continue with: its button's words, the workflow's message, and what starts it. */
export type Continue = { label: string; text: string; step: string | null; trigger: Trigger };

export type ContinueDialogProps = {
  repo: string;
  folder: string;
  run: Continue;
  open: boolean;
  onClose: () => void;
};

function Ask(props: ContinueDialogProps) {
  const feature = record("Feature", { id: props.folder, repo: props.repo });
  const settings = record("Settings", null);
  const agents = record("Agent", { repo: props.repo });
  const own = sent<RunOptions>(
    () => feature()?.runOptions.own ?? NONE,
    (options) => call("feature.setRunOptions", { folder: props.folder, options, repo: props.repo }),
  );
  const refusal = signal<string | null>(null);
  const pending = signal(false);
  const start = async () => {
    if (pending()) return;
    pending.set(true);
    refusal.set(null);
    try {
      const sentTo = await call("session.send", {
        folder: props.folder,
        repo: props.repo,
        text: props.run.text,
        workflow: { step: props.run.step, trigger: props.run.trigger },
      });
      props.onClose();
      navigate({ id: sentTo.session, page: "session-id", repo: props.repo });
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
          <Text tone="quiet">
            How each step runs, for this feature: a change is saved at once, and applies from this
            run on. What you leave follows the settings.
          </Text>
          <If
            when={settings()?.runs}
            else={<Text tone="faint">Reading the settings' run options…</Text>}
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
      width={width() === "wide" ? Math.min(1180, windowWidth() - 48) : 640}
    >
      <If when={props.open}>
        <Ask {...props} />
      </If>
    </Dialog>
  );
}
