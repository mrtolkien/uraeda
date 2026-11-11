// What a review hangs under a block of the reader: its pending comments, each with its edit and
// its removal, and the comment being written on it. A comment that spans blocks hangs under the
// last of them; a general comment, or one on a decision, is the Review pane's.
import { View } from "nsh";
import { call } from "../../store";
import type { Block, CommentItem, FileView } from "../../store/protocol";
import { Button, Text } from "../../ui/controls";
import { Well } from "../../ui/surfaces";
import type { FileArgs } from "../file/read";
import { CommentField } from "./Comment";
import { reviewOf } from "./state";

/** Whether a file waits for the human's review: a spec or a plan, committed for it. */
export const reviewable = (file: FileView) =>
  (file.kind === "spec" || file.kind === "plan") && file.status === "awaiting-human";

/** The pending comments of a file. */
export const pendingOf = (file: FileView): ReadonlyArray<CommentItem> =>
  file.review?.review?.comments ?? [];

/** Whether a comment hangs under a block: it is on the file's lines, and ends in it. */
export const hangsUnder = (comment: CommentItem, block: Block) =>
  !comment.general &&
  comment.decision === null &&
  comment.endLine >= block.startLine &&
  comment.endLine <= block.endLine;

function Pending(props: { args: FileArgs; comment: CommentItem; file: () => FileView }) {
  const review = reviewOf(props.args);
  const editing = () => {
    const writing = review.writing();
    return writing !== null && "number" in writing && writing.number === props.comment.number;
  };
  const where = { file: props.args.name, folder: props.args.folder, repo: props.args.repo };
  return (
    <If
      when={!editing()}
      else={
        <CommentField
          args={props.args}
          autoFocus
          editing={props.comment}
          file={props.file()}
          label="Your comment"
          lines={null}
          onClose={() => review.writing.set(null)}
        />
      }
    >
      <Well style={{ gap: 4 }}>
        <Text tone="info">{props.comment.text}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Button
            icon="pencil"
            label="Edit"
            onPress={() => review.writing.set({ number: props.comment.number })}
          />
          <Button
            icon="trash-2"
            label="Remove"
            onPress={() => void call("review.remove", { ...where, number: props.comment.number })}
          />
        </View>
      </Well>
    </If>
  );
}

/** The mark under each block of a file under review: called once per block, it reads as it changes. */
export function reviewMark(args: FileArgs, file: () => FileView) {
  const review = reviewOf(args);
  return (block: Block) => {
    if (block.parent !== null) return undefined;
    const comments = () =>
      reviewable(file()) ? pendingOf(file()).filter((one) => hangsUnder(one, block)) : [];
    const writing = () => {
      const now = review.writing();
      return reviewable(file()) && now !== null && "block" in now && now.block === block.id;
    };
    return (
      <View style={{ gap: 6 }}>
        <Each key={(comment: CommentItem) => comment.number} of={comments()}>
          {(comment) => <Pending args={args} comment={comment()} file={file} />}
        </Each>
        <If when={writing()}>
          <CommentField
            args={args}
            autoFocus
            file={file()}
            label={`Your comment on lines ${block.startLine} to ${block.endLine}`}
            lines={{ endLine: block.endLine, startLine: block.startLine }}
            onClose={() => review.writing.set(null)}
            testID="review-comment"
          />
        </If>
      </View>
    );
  };
}
