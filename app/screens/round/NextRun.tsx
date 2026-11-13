// The agent's next run, once the human's step is committed: its name on a button, which opens the
// continue dialog with the workflow's message and how each step runs. The run never starts by
// itself, and never from a key typed in a field (rule 2).
import { signal } from "nsh";
import { record } from "../../store";
import { Button, Text } from "../../ui/controls";
import { ContinueDialog } from "../runs/ContinueDialog";

export function NextRun(props: { folder: string; repo: string }) {
  const message = record("RecommendedMessage", { id: props.folder, repo: props.repo });
  const asking = signal(false);
  const run = () => {
    const shown = message();
    return shown?.name && shown.trigger !== null
      ? { label: shown.name, step: shown.step, text: shown.text, trigger: shown.trigger }
      : undefined;
  };
  return (
    <If
      when={run()}
      else={<If when={message()?.reason}>{(reason) => <Text tone="quiet">{reason()}</Text>}</If>}
    >
      {(next) => (
        <>
          <Button
            icon="play"
            label={next().label}
            onPress={() => asking.set(true)}
            testID="next-run"
            variant="main"
          />
          <ContinueDialog
            folder={props.folder}
            onClose={() => asking.set(false)}
            open={asking()}
            repo={props.repo}
            run={next()}
          />
        </>
      )}
    </If>
  );
}
