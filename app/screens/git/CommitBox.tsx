// The commit of one checkout: its message, typed in the app's one text field and kept on the
// device until it is committed, with the default from what is staged shown in its place while it
// is blank; and Commit, which names how many files it takes and where. `Ctrl+Enter` in the field,
// or the button, commits: never Enter, which adds a line. `c` goes to the field. The message
// leaves the field as it commits, and comes back if the commit is refused, before what was typed
// meanwhile. A hook's refusal shows above it, whole, in the hook's words, and the files stay staged.
import { type JSX, View } from "nsh";
import { isPending, write } from "./writes";
import type { GitGroup } from "../../store/protocol";
import { Button, Text } from "../../ui/controls";
import { keyScope, registerKey } from "../../ui/keys/registry";
import { TextField, type TextFieldRef, unsavedKey, unsavedText } from "../../ui/text";
import { isNarrow } from "../../ui/width";
import { plural } from "../../ui/words";

function CommitBox(props: {
  group: GitGroup;
  held: boolean;
  repo: string;
  /** Whether its group is the one shown, which its keys act on. */
  shown: () => boolean;
  where: string;
}) {
  let field: TextFieldRef | undefined;
  const message = unsavedText(unsavedKey(props.repo, `git#commit:${props.group.id}`), () => "");
  const staged = () => props.group.files.filter((file) => file.staged !== "no").length;
  const can = () => !props.held && staged() > 0;
  const commit = () => {
    if (!can() || message.pending()) return false;
    const files = plural(staged(), "file");
    const { repo, where } = props;
    const { folder, name } = props.group;
    void message
      .send(async (typed) => {
        const landed = await write(
          where,
          "git.commit",
          { folder, message: typed, repo },
          `Committing ${files} in ${name}`,
        );
        // Its refusal is the write's, shown above the field: the message comes back.
        if (!landed) throw new Error("The commit was refused.");
      })
      .then((done) => {
        // The field gives the keys back to the list, where the next file waits.
        if (done.ok) field?.blur();
      });
    return undefined;
  };
  // Its keys are on while its group is the one shown: the next box is drawn before this one
  // goes, and two boxes' `c` and `Ctrl+Enter` would mean two things for that moment (ruling R515).
  const keys = keyScope({ kind: "pane", name: "Commit", on: props.shown });
  registerKey(
    {
      hint: "c",
      hintLabel: "commit",
      keys: "c",
      label: "write the commit's message",
      run: () => {
        if (props.held || props.group.files.length === 0) return false;
        field?.focus();
        return undefined;
      },
    },
    keys,
  );
  const label = () => {
    if (props.held) return "An agent works here";
    if (staged() === 0) return "Stage files to commit";
    return `Commit ${plural(staged(), "file")} to ${props.group.name}`;
  };
  return (
    <View style={{ gap: 8 }}>
      <TextField
        disabled={props.held}
        hint={
          staged() === 0
            ? isNarrow()
              ? "Nothing is staged: tap a file's box to stage it."
              : "Nothing is staged: s stages the file under the cursor, a every file."
            : isNarrow()
              ? "Left blank, the commit takes the message shown."
              : "Ctrl+Enter commits. Left blank, it takes the message shown."
        }
        label={`The commit message of ${props.group.name}`}
        onChange={message.change}
        onSave={() => void commit()}
        placeholder={props.group.defaultMessage ?? "The commit's message"}
        ref={(made) => (field = made)}
        rows={{ max: 8, min: 2 }}
        testID="git-message"
        value={message.text()}
      />
      <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
        <Button
          disabled={!can()}
          icon="git-commit-horizontal"
          keys="mod+Enter"
          label={label()}
          scope={keys}
          onPress={() => void commit()}
          pending={isPending(props.where)}
          testID="git-commit"
          variant="main"
        />
        <If when={props.group.folder !== null}>
          <Text size="under" tone="faint">
            On its feature's branch, in its worktree.
          </Text>
        </If>
      </View>
    </View>
  );
}

/**
 * The commit box of the group the cursor is in, keyed by the group, so each keeps its own message
 * as the cursor crosses them. `above` draws what stands over the box, the group's refusal.
 */
export function CommitBoxes(props: {
  above?: (group: GitGroup) => JSX.Element;
  group: () => GitGroup | undefined;
  held: (group: GitGroup) => boolean;
  repo: string;
  where: (group: GitGroup) => string;
}) {
  return (
    <Each
      key={(shown: GitGroup) => shown.id}
      of={props.group() === undefined ? [] : [props.group()!]}
    >
      {(shown) => (
        <View style={{ gap: 6 }}>
          {props.above?.(shown())}
          <CommitBox
            group={shown()}
            held={props.held(shown())}
            repo={props.repo}
            shown={() => props.group()?.id === shown().id}
            where={props.where(shown())}
          />
        </View>
      )}
    </Each>
  );
}
