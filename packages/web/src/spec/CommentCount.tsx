// A count of pending comments, as the phone's status line and Contents' rows show it: its number,
// its word read out after it.
import { noun, plural } from "../labels.ts";
import { SpokenCount } from "../layout/SpokenCount.tsx";

/** "1 comment", "2 comments". */
export function commentsLabel(count: number) {
  return plural(count, "comment");
}

/** "N comments", its number shown, its word read out after it. */
export function CommentCount({ count }: { count: number }) {
  return <SpokenCount count={count} word={noun(count, "comment")} />;
}
