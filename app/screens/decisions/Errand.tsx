// The decisions check's errands for an agent: "Review with AI", which asks for a check while none
// is on the default branch, and "Apply the answers" once the human answered it. Each opens the
// continue dialog with the server's message whole, and starts a chat only from its Start (rule 2).
import { type JSX, signal, View } from "nsh";
import { record } from "../../store";
import type { Errand } from "../../store/protocol";
import { Button } from "../../ui/controls";
import { ContinueDialog } from "../runs/ContinueDialog";

const LABELS: Record<Errand, string> = {
  "apply-decisions-check": "Apply the answers",
  "check-decisions": "Review with AI",
  postpone: "Postpone",
};

/** An errand: its words, whether its message is read, what opens its dialog, and the dialog. */
export function useErrand(repo: string, errand: Errand) {
  const message = record("ErrandMessage", { errand, repo });
  const open = signal(false);
  const label = LABELS[errand];
  const dialog: JSX.Element = (
    <If when={message()?.text}>
      {(text) => (
        <ContinueDialog
          folder={null}
          onClose={() => open.set(false)}
          open={open()}
          repo={repo}
          run={{ label, step: null, text: text(), trigger: null }}
        />
      )}
    </If>
  );
  return { dialog, label, open: () => open.set(true), ready: () => message()?.text !== undefined };
}

/** The errand's button, its key `r` in the pane, and its dialog. */
export function ErrandButton(props: { errand: Errand; repo: string }) {
  const errand = useErrand(props.repo, props.errand);
  return (
    <If when={errand.ready()}>
      <View style={{ alignItems: "flex-start" }}>
        <Button
          icon={props.errand === "check-decisions" ? "message-circle-question" : "send"}
          keys="r"
          label={errand.label}
          onPress={errand.open}
          testID={`errand-${props.errand}`}
        />
        {errand.dialog}
      </View>
    </If>
  );
}
