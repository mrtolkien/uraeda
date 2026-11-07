// The images attached to a proposal or note file, from its editor, as an entry of the undo stack:
// the images' writes, and the save of the text that links them, taken back and redone together.
import { useCallback, useRef } from "react";
import { useFateClient } from "react-fate";
import type { ChangeView } from "uraeda-binding";
import { splitProposal } from "../pane/proposalText.ts";
import { changeEntry, joinChanges } from "../undo/changeEntry.ts";
import type { UndoEntry } from "../undo/stack.ts";
import { useUndo } from "../undo/useUndo.ts";
import { readProposalFile, rereadProposalFile } from "./useEditorImages.ts";

type Fate = ReturnType<typeof useFateClient>;

/** A run of images attached from an editor, as it ended. */
export type Attached = {
  /** The changes the images' writes answered, in order. */
  changes: ReadonlyArray<ChangeView>;
  /** The file's path once the run ended: a single file becomes a folder with its first image. */
  path: string;
  /**
   * The file's path, its whole text, and its frontmatter, as the run started, its typing saved:
   * the links' save writes that frontmatter back before the field's text.
   */
  start: { head: string; path: string; text: string };
  /** The field's text the run handed over, its links in it, which the editor saves. */
  text: string;
};

/** A text's bytes, UTF-8, in base64, as a change holds them. */
function base64(text: string) {
  let binary = "";
  for (const byte of new TextEncoder().encode(text)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/** The name a label gives a file: its own, or its folder's for a folder's `proposal.md`. */
export function fileName(path: string) {
  const name =
    path
      .replace(/\/(proposal|note)\.md$/, "")
      .split("/")
      .at(-1) ?? path;
  return name.replace(/\.md$/, "");
}

/**
 * The entry of the images `attached` added: the images' writes joined, with the save of the text
 * that links them, read as the file holds it when the undo runs. It is refused once the file's text,
 * its frontmatter included, changed since: an edit after the links' save is not the action's to
 * take back.
 */
export function attachedEntry(fate: Fate, attached: Attached): UndoEntry | undefined {
  const [first, ...rest] = attached.changes;
  if (!first) {
    return undefined;
  }
  const images = rest.reduce(joinChanges, first);
  const subject = fileName(attached.start.path);
  const count = attached.changes.length;
  const label = `Added ${count === 1 ? "an image" : `${count} images`} to “${subject}”`;
  // The file's page where the last replay left it: back at its start after an undo, at the path the
  // run left it, in its folder, after a redo.
  let place = { path: `/edit/${attached.path}` };
  const base = changeEntry(fate, images, label, place, subject);
  // The entry over the images and the text's save, made by the first undo, which reads the save.
  let whole: UndoEntry | undefined;
  const reread = () =>
    Promise.all([
      rereadProposalFile(fate, attached.start.path),
      rereadProposalFile(fate, attached.path),
    ]);
  const undo = async () => {
    if (!whole) {
      const now = await readProposalFile(fate, attached.path).catch(() => undefined);
      // The whole file, its frontmatter too, as the links' save wrote it: an edit of either since
      // is not the action's to take back.
      if (!now || now.text !== `${attached.start.head}${attached.text}`) {
        return `Could not undo: “${subject}” changed since in ${attached.path}.`;
      }
      const saved = images.files.find((file) => file.path === attached.path);
      const files = saved
        ? images.files.map((file) => (file === saved ? { ...file, after: base64(now.text) } : file))
        : [
            ...images.files,
            { after: base64(now.text), before: base64(attached.start.text), path: attached.path },
          ];
      whole = changeEntry(fate, { ...images, files }, label, place, subject);
    }
    const refused = await whole.undo();
    await reread();
    if (refused === undefined) {
      place = { path: `/edit/${attached.start.path}` };
    }
    return refused;
  };
  return {
    committed: () => (whole ?? base).committed?.() ?? Promise.resolve(false),
    label,
    get place() {
      return place;
    },
    redo: async () => {
      const refused = await (whole ?? base).redo();
      await reread();
      if (refused === undefined) {
        place = { path: `/edit/${attached.path}` };
      }
      return refused;
    },
    undo,
  };
}

/**
 * Records the runs of images an editor attaches: `started(path)` reads the file as a run starts,
 * its typing saved; `ended(run)` holds the recording of a run that ended with images, and `take()`
 * hands it over, to call once the save of the text that links them landed: an undo before it would
 * find the file without its links, and be refused.
 */
export function useRecordAttached() {
  const fate = useFateClient();
  const record = useUndo();
  const start = useRef<Attached["start"]>(undefined);
  const pending = useRef<() => void>(undefined);
  const take = useCallback(() => {
    const recording = pending.current;
    pending.current = undefined;
    return recording;
  }, []);
  return {
    ended: (run: Omit<Attached, "start">) => {
      // The run's start, as the next run's own replaces it.
      const started = start.current;
      pending.current = () => {
        const entry = started && attachedEntry(fate, { ...run, start: started });
        if (entry) {
          record(entry);
        }
      };
    },
    started: async (path: string) => {
      const read = await readProposalFile(fate, path).catch(() => undefined);
      start.current = read && { head: splitProposal(read).head, path, text: read.text };
    },
    take,
  };
}
