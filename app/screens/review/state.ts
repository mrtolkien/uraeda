// Where a review is, by file, for the run of the app and out of any pane: the block the reader's
// cursor holds, and the comment being written, on a block or on a pending comment. The reader and
// the Review pane beside it share it: a move of a pane loses nothing, and the text typed is the
// device's, never this state's.
import { type Signal, signal } from "nsh";
import type { FileArgs } from "../file/read";

/**
 * The comment being written: a new one on a block, `about` what its text starts with, as a story or
 * an element picked in it; or a pending one by its number.
 */
export type Writing = { about?: string; block: number } | { number: number } | null;

type Review = { cursor: Signal<number | null>; writing: Signal<Writing> };

const reviews = new Map<string, Review>();

export function reviewOf(args: FileArgs): Review {
  const key = `${args.repo}\n${args.folder}/${args.name}`;
  const known = reviews.get(key);
  if (known !== undefined) return known;
  const made: Review = { cursor: signal<number | null>(null), writing: signal<Writing>(null) };
  reviews.set(key, made);
  return made;
}
