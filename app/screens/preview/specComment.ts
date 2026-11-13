// A comment on a mockup or a story from its own page: a review comment of the feature's spec,
// while it waits for the human's review, on the block that shows the page. The spec opens beside
// the page, at that block, the comment's field under it, about the page or the element picked in
// it; the page stays in view. Where the spec does not show the page, there is nothing to anchor a
// comment to, and the page offers none.
import { record } from "../../store";
import type { Block, VersionView } from "../../store/protocol";
import { besideOpener } from "../../ui/layout";
import { readerPane } from "../file/panes";
import { jumpTo } from "../file/place";
import { shownOf } from "../file/read";
import { reviewable } from "../review/Marks";
import { reviewOf } from "../review/state";

/**
 * How a preview's page comments, while its feature's spec waits for review and shows the page in
 * the block `find` names: `undefined` otherwise. Called in a pane's view.
 */
export function useSpecComment(
  repo: string,
  folder: string,
  find: (version: VersionView) => number | undefined,
): () => ((about: string) => void) | undefined {
  const args = { folder, name: "spec.md", repo };
  const spec = record("WorkflowFile", { id: `${folder}/spec.md`, repo });
  const open = besideOpener();
  return () => {
    const file = spec();
    if (file === null || file === undefined || !reviewable(file)) return undefined;
    const version = shownOf(file);
    const at = find(version);
    const block: Block | undefined = at === undefined ? undefined : version.document.blocks[at];
    if (block === undefined) return undefined;
    return (about) => {
      const review = reviewOf(args);
      review.cursor.set(block.id);
      review.writing.set({ about, block: block.id });
      open(readerPane(args));
      jumpTo(args, block.id);
    };
  };
}
