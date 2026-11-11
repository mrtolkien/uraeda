// The commit of one checkout: its message, typed in the app's one text field and kept on the
// device until it is committed, with the default from what is staged shown in its place while it
// is blank; and Commit, which names how many files it takes and where. `Ctrl+Enter` in the field,
// or the button, commits: never Enter, which adds a line. `c` goes to the field. A hook's refusal
// shows above it, whole, in the hook's words, and the files stay staged.
import { View } from "nsh";
import { isPending, write } from "./writes";
import type { GitGroup } from "../../store/protocol";
import { Button, Text } from "../../ui/controls";
import { registerKey } from "../../ui/keys/registry";
import { TextField, type TextFieldRef, unsavedKey, unsavedText } from "../../ui/text";

export function CommitBox(props: { group: GitGroup; held: boolean; repo: string; where: string }) {
  let field: TextFieldRef | undefined;
  const message = unsavedText(unsavedKey(props.repo, `git#commit:${props.group.id}`), () => "");
  const staged = () => props.group.files.filter((file) => file.staged !== "no").length;
  const can = () => !props.held && staged() > 0;
  const commit = () => {
    if (!can()) return false;
    const typed = message.text();
    const files = `${staged()} ${staged() === 1 ? "file" : "files"}`;
    void write(
      props.where,
      "git.commit",
      { folder: props.group.folder, message: typed, repo: props.repo },
      `Committing ${files} in ${props.group.name}`,
    ).then((landed) => {
      // The field gives the keys back to the list, where the next file waits.
      if (landed) {
        message.discard();
        field?.blur();
      }
    });
    return undefined;
  };
  registerKey({
    hint: "c",
    hintLabel: "commit",
    keys: "c",
    label: "write the commit's message",
    run: () => {
      if (props.held || props.group.files.length === 0) return false;
      field?.focus();
      return undefined;
    },
  });
  const label = () => {
    if (props.held) return "An agent works here";
    if (staged() === 0) return "Stage files to commit";
    return `Commit ${staged()} ${staged() === 1 ? "file" : "files"} to ${props.group.name}`;
  };
  return (
    <View style={{ gap: 8 }}>
      <TextField
        disabled={props.held}
        hint={
          staged() === 0
            ? "Nothing is staged: s stages the file under the cursor, a every file."
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
