// The New page's draft, one per repository, which its three cards share: the composer's text and
// the entries it was filled from, its sources, kept together in the unsaved store, so a reload
// keeps both; its images, and a session's run, kept for the document's life. A line's Start
// replaces it, with an Undo; a card under the composer adds to it. The Change and Feature cards
// each kept a text of their own before: the first read joins them into it, once.
import { type SetStateAction, useCallback, useLayoutEffect } from "react";
import {
  dropUnsaved,
  readUnsaved,
  unsavedKey,
  useUnsaved,
  writeUnsaved,
} from "./fields/unsaved.ts";
import { useUndoToast } from "./layout/useUndoToast.ts";
import { type Entry, insertion, type Source, withAdded } from "./NewEntries.tsx";
import { useRepositoryPath } from "./routes.tsx";
import { useDraft } from "./useDraft.ts";

/** The draft's field in the unsaved store. */
const FIELD = "new-draft";

/** The fields the Change and the Feature cards kept their own texts in, the Change's first. */
const OLD_FIELDS = ["new-change", "new-feature-proposal"] as const;

/** What the draft holds: its text, and the entries it was filled from. */
type Held = { sources: ReadonlyArray<Source>; text: string };

/** The draft stored under `key`, as the store holds it: empty without an entry. */
function held(key: string): Held {
  const entry = readUnsaved(key);
  return { sources: entry?.sources ?? [], text: entry?.text ?? "" };
}

/**
 * Stores `next` under `key`: an empty text leaves no entry, and a text of spaces alone forgets its
 * sources, as a composer emptied no longer holds what it was filled from.
 */
function store(key: string, { sources, text }: Held) {
  if (text === "") {
    dropUnsaved(key);
    return;
  }
  writeUnsaved(key, {
    at: new Date().toISOString(),
    base: "",
    ...(text.trim() === "" || sources.length === 0 ? {} : { sources }),
    text,
  });
}

/**
 * Joins the old cards' texts of `repo` into its draft, after what it holds, the Change's text, a
 * blank line, then the Feature's, and drops their entries: once, as nothing is left to join after.
 */
function joinOld(repo: string, key: string) {
  const old = OLD_FIELDS.map((field) => unsavedKey(repo, field));
  const texts = old.map((each) => readUnsaved(each)?.text ?? "");
  if (old.every((each) => readUnsaved(each) === undefined)) {
    return;
  }
  const now = held(key);
  const text = [now.text, ...texts].filter((part) => part.trim() !== "").join("\n\n");
  store(key, { sources: now.sources, text });
  for (const each of old) {
    dropUnsaved(each);
  }
}

/** A source as the draft keeps it, for an entry put in its text as `inserted`. */
function sourceOf(entry: Entry, inserted: string): Source {
  return {
    ...(entry.linked === undefined ? {} : { linked: entry.linked }),
    ...(entry.section === undefined ? {} : { section: entry.section }),
    id: entry.id,
    inserted,
    kind: entry.kind,
    text: entry.text,
  };
}

/**
 * The New page's draft of the page's repository:
 *
 * - `text`, `setText`: the composer's text; emptied, it forgets its sources.
 * - `sources`: the entries the text was filled from.
 * - `images`, `setImages`: its images, kept for the document's life; a reload drops them.
 * - `insert`: adds an entry under the text, with a link to its file, as a card under the composer.
 * - `start`: replaces the draft with the entry alone, without its link or images, as a line's
 *   Start; a draft that held more than spaces, or images, comes back with the "Draft replaced"
 *   toast's Undo, its sources and images with it.
 * - `sent(text)`: empties the draft, its images too, while it still holds `text`: a newer draft
 *   stays whole. Whether it went.
 * - `unsavedNow()`: the text as the store holds it when called.
 */
export function useNewDraft() {
  const repo = useRepositoryPath();
  const key = unsavedKey(repo, FIELD);
  useLayoutEffect(() => joinOld(repo, key), [repo, key]);
  const entry = useUnsaved(key);
  const kept = useDraft(`new:${repo}`);
  const toast = useUndoToast();
  const setText = useCallback(
    (update: SetStateAction<string>) => {
      const now = held(key);
      const text = typeof update === "function" ? update(now.text) : update;
      store(key, { sources: text.trim() === "" ? [] : now.sources, text });
    },
    [key],
  );
  const insert = (entry: Entry) => {
    const now = held(key);
    const added = insertion(entry);
    const source = sourceOf(entry, added);
    const others = now.sources.filter((s) => !(s.kind === source.kind && s.id === source.id));
    store(key, { sources: [...others, source], text: withAdded(now.text, added) });
  };
  const start = (entry: Entry) => {
    const before = held(key);
    const images = kept.images;
    const added = insertion(entry, { link: false });
    store(key, { sources: [sourceOf(entry, added)], text: added });
    kept.setImages([]);
    if (before.text.trim() !== "" || images.length > 0) {
      toast("Draft replaced", async () => {
        store(key, before);
        kept.setImages(images);
        return undefined;
      });
    }
  };
  // Whether the draft still held `text`, and went with its images: a newer draft stays whole.
  const sent = (text: string) => {
    if (held(key).text.trim() !== text.trim()) {
      return false;
    }
    dropUnsaved(key);
    kept.setImages([]);
    return true;
  };
  return {
    images: kept.images,
    insert,
    kept,
    sent,
    setImages: kept.setImages,
    setText,
    sources: entry?.sources ?? [],
    start,
    text: entry?.text ?? "",
    unsavedNow: () => readUnsaved(key)?.text,
  };
}

/** The New page's draft, as its cards share it. */
export type NewDraft = ReturnType<typeof useNewDraft>;
