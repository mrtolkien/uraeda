// A file's diff in a session's changes: in the Changes pane, under its list, and as a pane of its
// own, `session-diff`, opened beside the list from a row (`shift+Enter`), so it reads beside the
// transcript at the room it needs. For a branch, from where it left the default branch to the file
// on disk; for a chat, the main checkout's change.
import { computed, View } from "nsh";
import { record } from "../../../store";
import type { GitDiff } from "../../../store/protocol";
import { Button, Refusal, Spinner, Text } from "../../../ui/controls";
import { Diff } from "../../../ui/document";
import { definePane, usePane } from "../../../ui/layout";
import { Empty } from "../../../ui/lists";

/** A diff's arguments: the repository, the session's folder ("" for the main checkout), the file. */
type DiffArgs = { folder: string; path: string; repo: string };

/** A file's diff, as a pane: its tab is the file's name. */
export const sessionDiff = definePane<DiffArgs>({
  closes: true,
  icon: "git-compare",
  kind: "session-diff",
  stack: "main",
  title: (args) => args.path.split("/").at(-1) ?? args.path,
  view: (props) => (
    <FileDiff
      folder={props.args.folder === "" ? null : props.args.folder}
      path={props.args.path}
      repo={props.args.repo}
    />
  ),
});

/** "+12 −3", or what a binary file's sizes did. */
function countWords(diff: GitDiff): string {
  if (diff.binaryBefore !== null || diff.binaryAfter !== null) return "binary";
  return `+${diff.added} −${diff.removed}`;
}

export function FileDiff(props: {
  folder: string | null;
  /** Back to the list it was opened from: none in a pane of its own. */
  onBack?: () => void;
  path: string;
  repo: string;
}) {
  const pane = usePane();
  const whole = pane.remember<boolean>("whole", false);
  const live = computed(() =>
    record("GitDiff", {
      branch: props.folder !== null,
      commit: null,
      folder: props.folder,
      path: props.path,
      repo: props.repo,
      whole: whole(),
    }),
  );
  const diff = () => live()();
  diff.error = () => live().error();
  const back = () => {
    whole.set(false);
    props.onBack?.();
  };
  return (
    <View style={{ flex: 1, gap: 8, padding: 12 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <If when={props.onBack !== undefined}>
          <Button compact icon="arrow-left" keys="Escape" label="Files" onPress={back} />
        </If>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text font="code" lines={2}>
            {props.path}
          </Text>
          <Text size="under" tone="faint">
            {diff() == null
              ? ""
              : `${countWords(diff()!)} · ${props.folder === null ? "not committed" : "since the branch left the default branch"}`}
          </Text>
        </View>
      </View>
      <If
        when={diff()}
        else={
          <If when={diff.error()} else={<Spinner label={`Reading the diff of ${props.path}`} />}>
            {(error) => <Refusal words={error().message} />}
          </If>
        }
      >
        {(shown) => (
          <If
            when={shown().text}
            else={
              <Empty
                action={
                  shown().isCapped
                    ? {
                        icon: "chevrons-down",
                        label: "Show the whole diff",
                        run: () => whole.set(true),
                      }
                    : undefined
                }
                icon="file-text"
                title={
                  shown().isCapped
                    ? `${shown().added + shown().removed} lines changed`
                    : "No change to show"
                }
                words={
                  shown().isCapped
                    ? "A diff past 1,000 lines is not read until asked: it may take a moment."
                    : shown().binaryBefore !== null || shown().binaryAfter !== null
                      ? "A binary file: its bytes changed, and git shows no lines of it."
                      : "The file is as its branch's start had it: an edit since put it back."
                }
              />
            }
          >
            {(text) => <Diff keys patch={text()} path={props.path} style={{ flex: 1 }} wrap />}
          </If>
        )}
      </If>
    </View>
  );
}
