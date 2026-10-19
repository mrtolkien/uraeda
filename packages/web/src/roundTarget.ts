// What a round of questions answers into: a feature's latest round, or a round on the default
// branch, the inbox's triage or the decisions check, which has no feature. The answers, the notes,
// the submit, and its retry go through the target's own mutations.
import { createContext, useContext, useEffect, useState } from "react";
import { useFateClient } from "react-fate";
import { FileView } from "./views.ts";

/**
 * A feature's round, by its folder, or a round on the default branch, by its id among workflow
 * files: `inbox-triage` or `decisions-check`.
 */
export type RoundTarget = { folder: string } | { round: string };

/** The inbox's triage, among workflow files: it has no feature folder. */
export const TRIAGE_ID = "inbox-triage";

/** Whether the target is a round on the default branch. */
export function isDefaultRound(target: RoundTarget): target is { round: string } {
  return "round" in target;
}

/**
 * The hash of the round's text as the page last read or wrote it, `current`: the triage's saves
 * and its submit are based on it, and the core refuses them once the file holds anything else, as
 * another page's answer. The page's writes to a default-branch round run one after another, each based on the
 * hash the last one left. A read drawn while a write is sent may hold the text from before it: it
 * waits for the write, and is dropped once the write wrote, the write's hash being as new. Any
 * other read is taken, a text the page had before included, as another page may write it back.
 */
export class Hashes {
  current: string;
  /** Whether a write is sent and not answered yet: one at a time. */
  #sending = false;
  /** The last read drawn while the write was sent, and whether the write wrote. */
  #waiting: string | null = null;
  #written = false;
  #queue: Promise<unknown> = Promise.resolve();

  constructor(current: string) {
    this.current = current;
  }

  /** Takes the hash of a text the page wrote. */
  wrote(hash: string) {
    this.current = hash;
    this.#written = true;
  }

  /** Takes the hash of the text the page read, once no write it may be older than is sent. */
  read(hash: string) {
    if (this.#sending) {
      this.#waiting = hash;
    } else {
      this.current = hash;
    }
  }

  /** Runs a write after the page's writes before it, based on the hash the last one left. */
  serial<T>(write: (base: string) => Promise<T>): Promise<T> {
    const next = this.#queue.then(async () => {
      this.#sending = true;
      this.#written = false;
      try {
        return await write(this.current);
      } finally {
        this.#settle();
      }
    });
    this.#queue = next.catch(() => undefined);
    return next;
  }

  /** Once the write is answered, takes the read drawn meanwhile unless the write wrote. */
  #settle() {
    this.#sending = false;
    if (this.#waiting !== null && !this.#written) {
      this.current = this.#waiting;
    }
    this.#waiting = null;
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
 * The round's writes into its target. A default-branch round's are based on the hash `hashes`
 * keeps, which each keeps in turn.
 */
export function useRoundWrites(target: RoundTarget, hashes: Hashes) {
  const fate = useFateClient();
  /** Runs a default-branch round's write in turn, keeping the hash of the text it wrote. */
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
      isDefaultRound(target)
        ? based((base) =>
            fate.mutations.defaultRound.answer({
              input: { ...input, base, id: target.round },
              view: FileView,
            }),
          )
        : fate.mutations.answer.save({
            input: { ...input, folder: target.folder },
            view: FileView,
          }),
    /** Saves the round's notes, over the notes last read, `previous`. */
    notes: (input: { notes: string; previous: string }) =>
      isDefaultRound(target)
        ? based((base) =>
            fate.mutations.defaultRound.notes({
              input: { ...input, base, id: target.round },
              view: FileView,
            }),
          )
        : fate.mutations.notes.save({ input: { ...input, folder: target.folder }, view: FileView }),
    /** Commits the round again after a hook refused it: `name` in a feature's folder. */
    retry: (name: string) =>
      isDefaultRound(target)
        ? fate.mutations.defaultRound.retry({ input: { id: target.round }, view: FileView })
        : fate.mutations.commit.retry({
            input: { file: name, folder: target.folder },
            view: FileView,
          }),
    /**
     * Submits the round, `name` in a feature's folder, or a default-branch round over the hash kept. `resumes`
     * answers it to continue the implementation.
     */
    submit: (name: string, resumes = false) =>
      isDefaultRound(target)
        ? hashes.serial((previous) =>
            fate.mutations.defaultRound.submit({
              input: { id: target.round, previous },
              view: FileView,
            }),
          )
        : fate.mutations.answers.submit({
            input: { file: name, folder: target.folder, ...(resumes ? { resumes } : {}) },
            view: FileView,
          }),
  };
}
