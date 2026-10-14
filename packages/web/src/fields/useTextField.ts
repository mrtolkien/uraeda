import { useEffect, useState } from "react";
import { useRepositoryPath } from "../routes.tsx";
import {
  differ,
  drawField,
  dropUnsaved,
  readUnsaved,
  type Unsaved,
  unsavedKey,
  useUnsaved,
  writeUnsaved,
} from "./unsaved.ts";

/**
 * A text field of the page's repository, by its key, `<path>#notes` for one: the text it shows,
 * its unsaved text kept in the store, and its saved text, `saved`, always the file's, never copied
 * into the store. The file never writes into the field while it holds unsaved text.
 *
 * - `dirty`: the text differs from `saved`, its ends trimmed.
 * - `change`: keeps the text typed, with `extra`, like a review comment's lines; text equal to
 *   `saved`, trimmed, leaves no entry.
 * - `discard`: forgets the unsaved text, and shows `saved` again.
 * - `saved(text)`: says `text` was saved: its entry goes, unless the field changed since.
 * - `restored`: the unsaved text the field had when drawn, while it is still unsaved: when it was
 *   typed, and whether `saved` changed since it was.
 * - `entry`: the unsaved text now, and `unsavedNow()` as the store holds it when called, for code
 *   that runs after waiting, like a submit.
 */
export function useTextField(field: string, saved: string, extra?: Unsaved["extra"]) {
  const key = unsavedKey(useRepositoryPath(), field);
  const entry = useUnsaved(key);
  // The unsaved text the field had when drawn, forgotten once it is gone, discarded or saved: what
  // is typed after is not restored.
  const [atMount, setAtMount] = useState(() => readUnsaved(key));
  if (atMount && !entry) {
    setAtMount(undefined);
  }
  // The text typed that leaves no entry, like a space after the saved text, shown while `saved`
  // is still the one it was typed over: a save's text, until the file's comes back.
  const [typed, setTyped] = useState<{ over: string; text: string }>();
  const shown = typed && (typed.over === saved || !differ(typed.text, saved)) ? typed.text : saved;
  const text = entry?.text ?? shown;

  // While drawn, the field's unsaved text is the page's: leaving it asks first.
  const [self] = useState(() => ({}));
  useEffect(() => drawField(self, key, saved), [self, key, saved]);

  // Text that became the saved text, as saved elsewhere, is unsaved no more.
  useEffect(() => {
    if (entry && !differ(entry.text, saved)) {
      dropUnsaved(key);
    }
  }, [entry, key, saved]);

  const change = (value: string) => {
    setTyped({ over: saved, text: value });
    if (!differ(value, saved)) {
      dropUnsaved(key);
      return;
    }
    const before = readUnsaved(key);
    writeUnsaved(key, {
      at: new Date().toISOString(),
      base: before?.base ?? saved,
      text: value,
      ...(extra ? { extra } : {}),
    });
  };

  const discard = () => {
    setTyped(undefined);
    dropUnsaved(key);
  };

  const markSaved = (value: string) => {
    setTyped({ over: saved, text: value });
    const now = readUnsaved(key);
    if (now?.text === value) {
      dropUnsaved(key);
    } else if (now) {
      // Typed during the save: still unsaved, over the text just saved.
      writeUnsaved(key, { ...now, base: value });
    }
  };

  const restored: { at: string; changed: boolean } | undefined =
    atMount && entry ? { at: atMount.at, changed: differ(entry.base, saved) } : undefined;

  return {
    change,
    dirty: differ(text, saved),
    discard,
    entry,
    restored,
    saved: markSaved,
    text,
    unsavedNow: (): Unsaved | undefined => readUnsaved(key),
  };
}
