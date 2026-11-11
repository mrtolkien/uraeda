// What a document's blocks share, from the `Document` or the `Reply` that draws them: the screen's
// hands on its links, images, and blocks, and the width the document is laid out at.
import { type Accessor, context, type JSX } from "nsh";
import type { Block, SpanImage, SpanLink } from "../../store/protocol";

/** What a screen gives a document: each is optional, and a document without them only reads. */
export type DocumentHands = {
  /**
   * A link that stays in the app was pressed: a file of the repository, a heading (`#anchor`), a
   * wikilink, or a story. The screen goes there. A web address opens in the system's browser
   * without it.
   */
  onLink?: (link: SpanLink) => void;
  /**
   * The address an image of the repository is drawn from, `/r/<name>/images/...`, or none: an
   * image without one is a link to it, its alt text the words, never loaded.
   */
  image?: (image: SpanImage) => string | undefined;
  /**
   * The screen's own mark on a block, drawn under it: a question's answer, a review's comment, a
   * selection's line. Called once as each block is made, for each block of the top level, each
   * list's item, and each table's row; `block.id` is stable for a tree.
   */
  mark?: (block: Block) => JSX.Element | undefined;
  /** A block the screen draws its own way, as a story or a mockup embedded live, or none. */
  override?: (block: Block) => JSX.Element | undefined;
};

export type Shared = DocumentHands & {
  /** The width the document is laid out at, in points: 0 until its first layout. */
  width: Accessor<number>;
  /** How far its prose starts from its left edge: centred in a wider pane, else 0. */
  inset: Accessor<number>;
};

export const DocumentContext = context<Shared>({ inset: () => 0, width: () => 0 });
