// What a round of questions answers into: a feature's latest round, or the inbox's triage, which
// has no feature. The answers, the notes, the submit, and its retry go through the target's own
// mutations.
import { createContext, useContext, useEffect, useState } from "react";
import { useFateClient } from "react-fate";
import { FileView } from "./views.ts";

/** A feature's round, by its folder, or the triage, `specs/INBOX-TRIAGE.md`. */
export type RoundTarget = { folder: string } | { triage: true };

/** Whether the target is the inbox's triage. */
export function isTriage(target: RoundTarget): target is { triage: true } {
  return "triage" in target;
}

/**
 * The hash of the round's text as the page last read or wrote it, `current`: the triage's saves
 * and its submit are based on it, and the core refuses them once the file holds anything else, as
 * another page's answer. The page's writes to the triage run one after another, each based on the
 * hash the last one left. A read of a text the page already had, drawn late, does not replace it.
 */
export class Hashes {
  current: string;
  #seen = new Set<string>();
  #queue: Promise<unknown> = Promise.resolve();

  constructor(current: string) {
    this.current = current;
    this.#seen.add(current);
  }

  /** Takes the hash of a text the page wrote. */
  wrote(hash: string) {
    this.current = hash;
    this.#seen.add(hash);
  }

  /** Takes the hash of the text the page read, unless the page already had that text. */
  read(hash: string) {
    if (!this.#seen.has(hash)) {
      this.current = hash;
      this.#seen.add(hash);
    }
  }

  /** Runs a write after the page's writes before it, based on the hash the last one left. */
  serial<T>(write: (base: string) => Promise<T>): Promise<T> {
    const next = this.#queue.then(() => write(this.current));
    this.#queue = next.catch(() => undefined);
    return next;
  }
}

/** The page's `Hashes`, provided by `RoundPage`: none outside a round. */
export const RoundHash = createContext<Hashes | null>(null);

/** The `Hashes` of the round page around. */
export function useRoundHash(): Hashes {
  const hashes = useContext(RoundHash);
  if (!hashes) {
    throw new Error("A round's question is drawn in its RoundPage.");
  }
  return hashes;
}

/** The page's `Hashes`, from the hash of the text it reads, `hash`. */
export function useHashes(hash: string) {
  const hashes = useState(() => new Hashes(hash))[0];
  useEffect(() => {
    hashes.read(hash);
  }, [hashes, hash]);
  return hashes;
}

/** A text written, whose hash the page keeps. */
type Written = { current: { document: { hash: string } } } | null | undefined;

/**
 * The round's writes into its target. The triage's are based on the hash `hashes` keeps, which
 * each keeps in turn.
 */
export function useRoundWrites(target: RoundTarget, hashes: Hashes) {
  const fate = useFateClient();
  /** Runs a triage's write in turn, keeping the hash of the text it wrote. */
  const based = <T extends { result?: Written }>(write: (base: string) => Promise<T>) =>
    hashes.serial(async (base) => {
      const result = await write(base);
      if (result.result) {
        hashes.wrote(result.result.current.document.hash);
      }
      return result;
    });
  return {
    /** Saves a question's answer, over the answer last read, `previous`. */
    answer: (input: {
      comment: string;
      letters: Array<string>;
      previous: string;
      question: string;
    }) =>
      isTriage(target)
        ? based((base) =>
            fate.mutations.triage.answer({ input: { ...input, base }, view: FileView }),
          )
        : fate.mutations.answer.save({
            input: { ...input, folder: target.folder },
            view: FileView,
          }),
    /** Saves the round's notes, over the notes last read, `previous`. */
    notes: (input: { notes: string; previous: string }) =>
      isTriage(target)
        ? based((base) =>
            fate.mutations.triage.notes({ input: { ...input, base }, view: FileView }),
          )
        : fate.mutations.notes.save({ input: { ...input, folder: target.folder }, view: FileView }),
    /** Commits the round again after a hook refused it: `name` in a feature's folder. */
    retry: (name: string) =>
      isTriage(target)
        ? fate.mutations.triage.retry({ input: {}, view: FileView })
        : fate.mutations.commit.retry({
            input: { file: name, folder: target.folder },
            view: FileView,
          }),
    /** Submits the round, `name` in a feature's folder, or the triage over the hash kept. */
    submit: (name: string) =>
      isTriage(target)
        ? hashes.serial((previous) =>
            fate.mutations.triage.submit({ input: { previous }, view: FileView }),
          )
        : fate.mutations.answers.submit({
            input: { file: name, folder: target.folder },
            view: FileView,
          }),
  };
}
