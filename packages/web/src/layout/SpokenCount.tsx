// A count in a small badge, as a tab's or an outline row's: its number shown, its word read out
// after it, "2 running", "1 comment".
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";

/** `count`, shown, then `word`, read out after it. */
export function SpokenCount({ count, word }: { count: number; word: string }) {
  return (
    <>
      {count}
      <VisuallyHidden> {word}</VisuallyHidden>
    </>
  );
}
