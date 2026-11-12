// "Postpone the feature…", beside Drop at the pane's foot, far from Next: it asks first, with the
// workflow's message whole, as the server writes it. Postponing sends that message to the
// feature's latest session, made when it has none, and opens it: the agent writes the proposal
// that stays, moves its line to Later, and closes the folder, asking before what it cannot settle.
import { signal, View } from "nsh";
import { call, navigate, record } from "../../store";
import type { Feature } from "../../store/protocol";
import { Button, Refusal, Text } from "../../ui/controls";
import { Dialog, Well } from "../../ui/surfaces";
import type { FeatureArgs } from "./read";

export function Postpone(props: { args: FeatureArgs; feature: Feature }) {
  const message = record("ErrandMessage", {
    errand: "postpone",
    folder: props.args.folder,
    repo: props.args.repo,
  });
  const asking = signal(false);
  const pending = signal(false);
  const refusal = signal<string | null>(null);
  const what = props.feature.kind === "change" ? "change" : "feature";
  const postpone = async (text: string) => {
    pending.set(true);
    refusal.set(null);
    try {
      const sent = await call("session.send", {
        folder: props.args.folder,
        repo: props.args.repo,
        text,
      });
      asking.set(false);
      navigate({ id: sent.session, page: "session-id", repo: props.args.repo });
    } catch (error) {
      refusal.set((error as Error).message);
    }
    pending.set(false);
  };
  return (
    // Without a branch to close, there is nothing to postpone: the button is not drawn.
    <If when={message()?.refusal === null ? message()?.text : undefined}>
      {(text) => (
        <>
          <Button
            icon="calendar-clock"
            keys="P"
            label={`Postpone the ${what}…`}
            onPress={() => asking.set(true)}
            testID="postpone"
          />
          <Dialog
            icon="calendar-clock"
            onClose={() => asking.set(false)}
            open={asking()}
            title={`Postpone the ${what}?`}
          >
            <View style={{ gap: 12 }}>
              <Text>
                {`An agent writes what was learned as a proposal, moves its line to Later in the priorities, and closes its folder on its branch, which keeps every commit. It asks you before anything it cannot settle. The message it is sent:`}
              </Text>
              <Well>
                <Text font="code">{text()}</Text>
              </Well>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Button
                  first
                  icon="calendar-clock"
                  label={`Postpone ${props.feature.label ?? props.feature.title}`}
                  onPress={() => void postpone(text())}
                  pending={pending()}
                  testID="postpone-send"
                  variant="main"
                />
                <Button label="Keep it going" onPress={() => asking.set(false)} />
              </View>
              <If when={refusal()}>{(words) => <Refusal words={words()} />}</If>
            </View>
          </Dialog>
        </>
      )}
    </If>
  );
}
