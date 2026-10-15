// What a round of questions answers into: a feature's latest round, or the inbox's triage, which
// has no feature. The answers, the notes, and the submit go through the target's own mutations.
import { createContext, useEffect, useState } from "react";
import { useFateClient } from "react-fate";
import { FileView } from "./views.ts";

/** A feature's round, by its folder, or the triage, `specs/INBOX-TRIAGE.md`. */
export type RoundTarget = { folder: string } | { triage: true };

/** Whether the target is the inbox's triage. */
export function isTriage(target: RoundTarget): target is { triage: true } {
  return "triage" in target;
}

/**
 * The hash of the round's text as the page last read or wrote it, `current`: the triage is
 * submitted over it, so the page's own saves, like the notes a submit saves first, are not taken
 * for a change made elsewhere. The page's reads of its own saves may be drawn after a later save:
 * only a read of another text replaces `current`.
 */
export class Hashes {
  current: string;
  #written = new Set<string>();

  constructor(current: string) {
    this.current = current;
  }

  /** Takes the hash of a text the page wrote. */
  wrote(hash: string) {
    this.current = hash;
    this.#written.add(hash);
  }

  /** Takes the hash of the text the page read, unless it is one of its own saves, drawn late. */
  read(hash: string) {
    if (!this.#written.has(hash)) {
      this.current = hash;
    }
  }
}

export const RoundHash = createContext(new Hashes(""));

/** The page's `Hashes`, from the hash of the text it reads, `hash`. */
export function useHashes(hash: string) {
  const hashes = useState(() => new Hashes(hash))[0];
  useEffect(() => {
    hashes.read(hash);
  }, [hashes, hash]);
  return hashes;
}

/**
 * The round's writes into its target, each keeping the hash of the text it wrote in `hash`, the
 * page's `RoundHash`.
 */
export function useRoundWrites(target: RoundTarget, hash: Hashes) {
  const fate = useFateClient();
  /** Keeps the hash of the text a save wrote. */
  const kept = (written?: { current: { document: { hash: string } } } | null) => {
    if (written) {
      hash.wrote(written.current.document.hash);
    }
  };
  return {
    /** Saves a question's answer, over the answer last read, `previous`. */
    answer: async (input: {
      comment: string;
      letters: Array<string>;
      previous: string;
      question: string;
    }) => {
      const result = isTriage(target)
        ? await fate.mutations.triage.answer({ input, view: FileView })
        : await fate.mutations.answer.save({
            input: { ...input, folder: target.folder },
            view: FileView,
          });
      kept(result.result);
      return result;
    },
    /** Saves the round's notes, over the notes last read, `previous`. */
    notes: async (input: { notes: string; previous: string }) => {
      const result = isTriage(target)
        ? await fate.mutations.triage.notes({ input, view: FileView })
        : await fate.mutations.notes.save({
            input: { ...input, folder: target.folder },
            view: FileView,
          });
      kept(result.result);
      return result;
    },
    /** Submits the round, `name` in a feature's folder, or the triage over the hash kept. */
    submit: (name: string) =>
      isTriage(target)
        ? fate.mutations.triage.submit({ input: { previous: hash.current }, view: FileView })
        : fate.mutations.answers.submit({
            input: { file: name, folder: target.folder },
            view: FileView,
          }),
  };
}
