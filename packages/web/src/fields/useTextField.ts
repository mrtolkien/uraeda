import { useEffect, useRef, useState } from "react";
import { useRepositoryPath } from "../routes.tsx";
import {
  differ,
  drawField,
  dropUnsaved,
  readUnsaved,
  savedUnsaved,
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
 * - `change`: keeps the text typed, with `extra`, like a review comment's lines, `picked`, a story
 *   comment's element, and `subject`, a settled comment's; text equal to `saved`, trimmed, leaves
 *   no entry.
 * - `discard`: forgets the unsaved text, and shows `saved` again.
 * - `saved(text)`: says `text` was saved: its entry goes, unless the field changed since.
 * - `restored`: the unsaved text the field had when drawn, while it is still unsaved: when it was
 *   typed, and whether `saved` changed since it was.
 * - `entry`: the unsaved text now, and `unsavedNow()` as the store holds it when called, for code
 *   that runs after waiting, like a submit.
 *
 * `drawn: false` is for a hook that reads a field another component draws, which says itself
 * whether it is drawn: its unsaved text is the page's only while that field shows.
 */
export function useTextField(
  field: string,
  saved: string,
  {
    drawn = true,
    extra,
    picked,
    subject,
  }: {
    drawn?: boolean;
    extra?: Unsaved["extra"];
    picked?: Unsaved["picked"];
    subject?: string;
  } = {},
) {
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

  // Whether this field dropped its entry itself, by a change back to the saved text or a save, and
  // whether it held one: an entry dropped elsewhere, like by another field on the same key, or by
  // Submit, takes the text typed here with it.
  const droppedHere = useRef(false);
  const held = useRef(entry !== undefined);
  useEffect(() => {
    if (!entry && held.current && !droppedHere.current) {
      setTyped(undefined);
    }
    held.current = entry !== undefined;
    droppedHere.current = false;
  }, [entry]);

  // While drawn, the field's unsaved text is the page's: leaving it asks first.
  const [self] = useState(() => ({}));
  useEffect(() => (drawn ? drawField(self, key, saved) : undefined), [drawn, self, key, saved]);

  // Text that became the saved text, as saved elsewhere, is unsaved no more.
  useEffect(() => {
    if (entry && !differ(entry.text, saved)) {
      dropUnsaved(key);
    }
  }, [entry, key, saved]);

  const change = (value: string) => {
    setTyped({ over: saved, text: value });
    if (!differ(value, saved)) {
      droppedHere.current = true;
      dropUnsaved(key);
      return;
    }
    const before = readUnsaved(key);
    writeUnsaved(key, {
      at: new Date().toISOString(),
      base: before?.base ?? saved,
      text: value,
      ...(extra ? { extra } : {}),
      ...(picked ? { picked } : {}),
      ...(subject === undefined ? {} : { subject }),
    });
  };

  const discard = () => {
    setTyped(undefined);
    dropUnsaved(key);
  };

  const markSaved = (value: string) => {
    setTyped({ over: saved, text: value });
    // Text typed during the save stays unsaved, over the text just saved.
    if (savedUnsaved(key, value)) {
      droppedHere.current = true;
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
