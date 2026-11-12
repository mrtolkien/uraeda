// Parts of the feature's subject pane: what stops the workflow, at its file and line; its name, as
// the lists show it; and the drop, deliberate behind its question, which says after where the
// feature went.
import { signal } from "nsh";
import { call, navigate } from "../../store";
import type { Dropped, Feature } from "../../store/protocol";
import { Banner, Button, Confirm, Link, Refusal } from "../../ui/controls";
import { registerKey } from "../../ui/keys";
import { usePane } from "../../ui/layout";
import type { FeatureArgs } from "./read";
import { NameDialog } from "../NameDialog";

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

/**
 * Rename, `R` or its link: the name the feature shows in the sidebar, Home, and its page, kept by
 * the server beside the repository; a blank one gives it back its title.
 */
export function Rename(props: { args: FeatureArgs; feature: Feature }) {
  const asking = signal(false);
  const what = props.feature.kind === "change" ? "change" : "feature";
  registerKey({
    hint: "R",
    hintLabel: "rename",
    icon: "pencil",
    keys: "R",
    label: `Rename the ${what}`,
    run: () => void asking.set(true),
  });
  return (
    <>
      <Link alone onPress={() => asking.set(true)} size="under">
        Rename
      </Link>
      <If when={asking()}>
        <NameDialog
          icon="pencil"
          initial={props.feature.label ?? props.feature.title}
          label="Name"
          onClose={() => asking.set(false)}
          onSave={async (label) => {
            const named = label === props.feature.title ? "" : label;
            await call("item.settings", {
              folder: props.args.folder,
              label: named === "" ? null : named,
              repo: props.args.repo,
            });
          }}
          title={`Rename the ${what}`}
          words={`Left blank, it is called by its title, “${props.feature.title}”.`}
        />
      </If>
    </>
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
    } catch (error) {
      refusal.set((error as Error).message);
    }
    pending.set(false);
  };
  return (
    <>
      <Button
        icon="trash-2"
        label={`Drop the ${what}…`}
        onPress={() => asking.set(true)}
        pending={pending()}
        variant="danger"
      />
      <If when={refusal()}>{(words) => <Refusal words={words()} />}</If>
      <Confirm
        icon="trash-2"
        keep="Keep it"
        label={`Drop ${props.feature.label ?? props.feature.title}`}
        loses
        onClose={() => asking.set(false)}
        onConfirm={() => void drop()}
        open={asking()}
        title={`Drop the ${what}?`}
        words="Its proposal leaves the priorities, and its worktree is removed unless it holds uncommitted changes. Its branch stays: nothing it committed is lost."
      />
    </>
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
