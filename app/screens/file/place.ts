// Where the reader is in a file, which the panes beside the document share: the document says the
// block at the top as the reader scrolls, and the outline and the plan's tasks light the part it is
// in; they ask the document to go to a block, which it brings to the top. Kept by file for the run
// of the app, out of any pane: a pane moved to the other stack, or a tab hidden, loses nothing.
import { type Accessor, type Signal, signal } from "nsh";
import type { FileArgs } from "./read";

type Place = {
  /** The top-level block at the top of the reader. */
  top: Signal<number>;
  /** The latest jump asked: a block, numbered so the same block asked twice goes again. */
  jump: Signal<{ block: number; times: number } | undefined>;
};

const places = new Map<string, Place>();

function placeOf(args: FileArgs): Place {
  const key = `${args.repo}\n${args.folder}/${args.name}`;
  const known = places.get(key);
  if (known !== undefined) return known;
  const made: Place = {
    jump: signal<{ block: number; times: number } | undefined>(undefined),
    top: signal(0),
  };
  places.set(key, made);
  return made;
}

/** The block at the top of the reader, by id: 0 until it scrolled. */
export const topBlock = (args: FileArgs): Accessor<number> => placeOf(args).top;

/** Says the block at the top of the reader. */
export const atTop = (args: FileArgs, block: number) => placeOf(args).top.set(block);

/** Asks the reader to bring `block` to its top. */
export function jumpTo(args: FileArgs, block: number) {
  const jump = placeOf(args).jump;
  jump.set({ block, times: (jump()?.times ?? 0) + 1 });
}

/** The latest jump asked of the reader. */
export const jumps = (args: FileArgs) => placeOf(args).jump;
