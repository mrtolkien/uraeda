// The priorities' order as the page shows it: the server's, with the moves the human made on top
// of it until the server's own order comes back. A move shows at once, is written once, in the
// order the moves were made, and a refusal puts the rows back and says why under the section the
// row was moved in (`sent`, which every control of the app uses for the same rule).
import { type Accessor, computed, signal, untracked } from "nsh";
import { type Arrangement, arrangementOf, byKey, type Move, moveOf } from "./order";
import { call, type Live, StoreError } from "../../store";
import type { Priorities, ProposalsMove } from "../../store/protocol";
import { sent, refusalOf } from "../../ui/controls";
import { remember } from "../shell/undo";

/** What the page shows: an order, and the write that made it, for one the human made. */
type Shown = { order: Arrangement; write?: Omit<ProposalsMove, "repo" | "hash"> };

export type Order = {
  /** The order shown now. */
  order: Accessor<Arrangement>;
  /** Whether a running proposal: it shows in Ongoing, apart, and no move lands among them. */
  runs: (key: string) => boolean;
  /** Shows the move at once, and writes it after the moves before it. */
  move: (move: Move) => void;
  /** Why the last move was refused, and the section it was made in, until the next move. */
  refusal: Accessor<{ section: string; words: string } | null>;
  pending: Accessor<boolean>;
};

/** A refusal in words that name the way out. */
function words(error: unknown) {
  if (error instanceof StoreError && error.code === "conflict") {
    return "The priorities changed elsewhere, and show as they are now: move it again.";
  }
  if (error instanceof StoreError && error.code === "offline") {
    return "Not moved: the server is not reachable. It moves once the app is back online.";
  }
  return refusalOf(error);
}

export function createOrder(repo: Accessor<string>, priorities: Live<Priorities | null>): Order {
  const known = computed(() => {
    const now = priorities();
    return now ? byKey(now) : new Map();
  });
  const truth = computed((): Shown => {
    const now = priorities();
    return { order: now ? arrangementOf(now) : {} };
  });
  // The hash the last write left, until the record shows it: a second move sent before the
  // record caught up is written over the first, not refused as a conflict.
  let wrote: { over: string; now: string } | undefined;
  const hash = () => {
    const now = untracked(priorities)?.hash ?? "";
    return wrote !== undefined && wrote.over === now ? wrote.now : now;
  };
  const shown = sent(truth, async (next: Shown) => {
    if (next.write === undefined) return;
    const over = hash();
    try {
      const written = await call("proposals.move", { ...next.write, hash: over, repo: repo() });
      wrote = { now: written.hash, over };
      // Moves a second apart are one action on the stack, and say nothing: the row moved.
      remember(written.change, "Moved a proposal in the priorities.", {
        quiet: true,
        repo: repo(),
        run: `priorities:${repo()}`,
      });
    } catch (error) {
      throw new Error(words(error), { cause: error });
    }
  });
  const section = signal<string | null>(null);
  const runs = (key: string) => (known().get(key)?.running ?? null) !== null;

  return {
    move: (move) => {
      const made = untracked(() => moveOf(shown.value().order, move, runs));
      if (made === undefined) return;
      section.set(move.section);
      shown.set({ order: made.after, write: made.input });
    },
    order: () => shown.value().order,
    pending: shown.pending,
    refusal: () => {
      const refused = shown.refusal();
      const where = section();
      return refused === null || where === null ? null : { section: where, words: refused };
    },
    runs,
  };
}
