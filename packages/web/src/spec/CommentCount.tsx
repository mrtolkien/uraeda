// A count of pending comments, as the column's Review tab, the phone's status line, and Contents'
// rows show it: its number, its word read out after it.
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";

/** "1 comment", "2 comments". */
export function commentsLabel(count: number) {
  return `${count} ${count === 1 ? "comment" : "comments"}`;
}

/** "N comments", its number shown, its word read out after it. */
export function CommentCount({ count }: { count: number }) {
  return (
    <>
      {count}
      <VisuallyHidden> {count === 1 ? "comment" : "comments"}</VisuallyHidden>
    </>
  );
}
