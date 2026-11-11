// The document renderer's pages: `spec`, a document with every kind of block and span;
// `diagrams`, one drawn and one that fails; `reply`, a reply that grows as an agent's streams,
// from the moment it is shown, its last block changing every frame, until it is whole.
import { cleanup, signal } from "nsh";
import { markdownTree } from "uraeda/native";
import { DIAGRAMS, longReply, ROW_SVG, SPEC } from "./sample";
import type { Document as Tree } from "../../store/protocol";
import { Document, Reply } from "../../ui/document";

const tree = (text: string) => JSON.parse(markdownTree(text)) as Tree;

/** The gallery's images: the prototype's picture; any other is a link. */
const image = (shown: { path: string | null }) =>
  shown.path?.endsWith("mockups/row.svg") === true ? ROW_SVG : undefined;

export const spec = () => <Document document={tree(SPEC)} image={image} />;

export const diagrams = () => <Document document={tree(DIAGRAMS)} image={image} />;

/** How much a reply grows a frame, in characters, and how many sections it has whole. */
const PIECE = 40;
const SECTIONS = 6;

export function reply() {
  const whole = longReply(SECTIONS);
  const text = signal(whole.slice(0, 400));
  const done = signal(false);
  let going = true;
  const grow = () => {
    if (!going) return;
    const next = text().length + PIECE;
    text.set(whole.slice(0, next));
    if (next < whole.length) requestAnimationFrame(grow);
    else done.set(true);
  };
  requestAnimationFrame(grow);
  cleanup(() => (going = false));
  return <Reply done={done} image={image} text={text} />;
}
