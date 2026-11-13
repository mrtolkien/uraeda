// A file's head line, as a buffer's line in Neovim: its folders, then its name, a dot while its
// text is not saved, and under it where the file lives, the main checkout or a feature's worktree,
// and on which branch: what a save writes, and where the Git page lists it.
import { View } from "nsh";
import type { Buffer } from "../../store/protocol";
import { Icon, Text } from "../../ui/controls";
import { tokens } from "../../ui/tokens";

/** Where a buffer's file lives, in words: "Main checkout · main". */
export function whereWords(buffer: Buffer): string {
  if (buffer.worktree !== null) {
    const folder = buffer.worktree.split("/").pop() ?? buffer.worktree;
    return `Worktree ${folder} · ${buffer.branch}`;
  }
  if (!buffer.checkedOut) {
    return `Branch ${buffer.branch}, which no checkout has: a save makes its worktree`;
  }
  return buffer.branch === "" ? "Main checkout" : `Main checkout · ${buffer.branch}`;
}

export function Where(props: { buffer: Buffer; dirty: boolean }) {
  const parts = () => props.buffer.path.split("/");
  const folders = () => parts().slice(0, -1).join("/");
  return (
    <View style={{ flexBasis: 220, flexGrow: 1, flexShrink: 1, gap: 2 }}>
      <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        <Icon name={props.buffer.readOnly === null ? "file-pen-line" : "file-text"} />
        <If when={folders() !== ""}>
          <Text font="code" tone="quiet">
            {`${folders()}/`}
          </Text>
        </If>
        <Text bold font="code">
          {parts().at(-1) ?? props.buffer.path}
        </Text>
        <If when={props.dirty}>
          <Text testID="buffer-unsaved" tone="needs">
            ●
          </Text>
        </If>
      </View>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
        <Icon
          colour={tokens.role.inkFaint}
          name={props.buffer.worktree === null ? "folder" : "folder-git-2"}
        />
        <Text size="under" tone="faint">
          {whereWords(props.buffer)}
        </Text>
      </View>
    </View>
  );
}
