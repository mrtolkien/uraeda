// Two parts of the feature's subject pane: what stops the workflow, at its file and line, and the
// drop, deliberate behind its question, which says after where the feature went.
import { signal, View } from "nsh";
import { call, navigate } from "../../store";
import type { Dropped, Feature } from "../../store/protocol";
import { Banner, Button, Refusal, Text } from "../../ui/controls";
import { usePane } from "../../ui/layout";
import { Dialog } from "../../ui/surfaces";
import type { FeatureArgs } from "./read";

/** `ura check`'s problems that stop the workflow, each at its file and line. */
export function Problems(props: { feature: Feature }) {
  return (
    <If when={props.feature.problems.length > 0}>
      <Banner
        icon="triangle-alert"
        title={`What stops the ${props.feature.kind === "change" ? "change" : "feature"}`}
        tone="danger"
      >
        {props.feature.problems
          .map(
            (problem) =>
              `${problem.file}${problem.line === null ? "" : `:${problem.line}`}: ${problem.message}`,
          )
          .join("\n")}
      </Banner>
    </If>
  );
}

/** What a drop left, in words: its branch stays, and its worktree when it had changes. */
function droppedWords(dropped: Dropped): string {
  const worktree =
    dropped.worktreeLeft === null
      ? "Its worktree is removed."
      : `Its worktree stays: ${dropped.worktreeLeft}`;
  const priorities = dropped.committed
    ? "Its line left the priorities."
    : "Its line's removal from the priorities waits for a commit, on the Git page.";
  return `Its branch ${dropped.branch} stays. ${worktree} ${priorities}`;
}

/**
 * "Drop the feature…": a danger tube at the pane's foot, far from "Next", asking first. Once
 * dropped, the pane says what stayed, and the way home.
 */
export function Drop(props: { args: FeatureArgs; feature: Feature }) {
  const pane = usePane();
  const asking = signal(false);
  const pending = signal(false);
  const refusal = signal<string | null>(null);
  const dropped = pane.remember<string | null>("dropped", null);
  const what = props.feature.kind === "change" ? "change" : "feature";
  const drop = async () => {
    pending.set(true);
    refusal.set(null);
    try {
      dropped.set(
        droppedWords(
          await call("feature.drop", { folder: props.args.folder, repo: props.args.repo }),
        ),
      );
      asking.set(false);
    } catch (error) {
      refusal.set((error as Error).message);
    }
    pending.set(false);
  };
  return (
    <View style={{ alignItems: "flex-start", paddingTop: 24 }}>
      <Button
        icon="trash-2"
        label={`Drop the ${what}…`}
        onPress={() => asking.set(true)}
        variant="danger"
      />
      <Dialog
        icon="trash-2"
        onClose={() => asking.set(false)}
        open={asking()}
        title={`Drop the ${what}?`}
      >
        <View style={{ gap: 12 }}>
          <Text>
            {
              "Its proposal leaves the priorities, and its worktree is removed unless it holds uncommitted changes. Its branch stays: nothing it committed is lost."
            }
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Button
              icon="trash-2"
              label={`Drop ${props.feature.label ?? props.feature.title}`}
              onPress={() => void drop()}
              pending={pending()}
              variant="danger"
            />
            <Button label="Keep it" onPress={() => asking.set(false)} />
          </View>
          <If when={refusal()}>{(words) => <Refusal words={words()} />}</If>
        </View>
      </Dialog>
    </View>
  );
}

/**
 * What the drop of this pane's feature left, once dropped: shown above whatever the pane shows
 * then, the feature's page or "No feature", with the way home.
 */
export function DroppedNote() {
  const dropped = usePane().remember<string | null>("dropped", null);
  return (
    <If when={dropped()}>
      {(shown) => (
        <Banner
          action={<Button icon="house" label="Home" onPress={() => navigate({ page: "home" })} />}
          icon="trash-2"
          title="Dropped"
          tone="info"
        >
          {shown()}
        </Banner>
      )}
    </If>
  );
}
