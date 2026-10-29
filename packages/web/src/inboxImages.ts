// A note's image taken out of its note file by the core: the lines linking it go, and the image's
// file stays for `ura inbox clean`, or a commit of the folder, to delete once nothing links it.
import { type useFateClient, view } from "react-fate";
import type { InboxNote, RemovedImage } from "uraeda-binding";
import type { Inbox } from "uraeda-server/fate";
import { readProposalFile, rereadProposalFile } from "./attach/useEditorImages.ts";
import { rereadChanges } from "./data.ts";
import { guarded, refusal } from "./errors.ts";
import { InboxView } from "./views.ts";

type Fate = ReturnType<typeof useFateClient>;

/** An image's file name: what Remove and its alt text name it by. */
export function imageName(path: string) {
  return path.split("/").at(-1) ?? path;
}

/** The inbox as an image's removal answers it: with `imageRemoved`, what Undo takes back. */
const InboxImageRemovedView = view<Inbox>()({
  categories: true,
  changes: true,
  count: true,
  hash: true,
  id: true,
  imageRemoved: { after: true, at: true, before: true, file: true, image: true },
  names: true,
  triage: true,
});

/** What a removal wrote, which Undo takes back: the core's answer. */
export type Removed = RemovedImage;

/**
 * Takes the image at `path`, from the repository's top level, out of the note file of `note`, over
 * the version of the file read. Gives what Undo needs, or the refusal to show.
 */
export async function removeNoteImage(
  fate: Fate,
  note: InboxNote,
  path: string,
): Promise<Removed | string> {
  if (note.file === undefined) {
    return "The note has no file.";
  }
  const file = note.file;
  const read = await readProposalFile(fate, file);
  if (!read) {
    return `The note file ${file} was not found.`;
  }
  const result = await guarded(() =>
    fate.mutations.inbox.removeImage({
      input: { file, hash: read.hash, image: path },
      view: InboxImageRemovedView,
    }),
  );
  rereadChanges(fate);
  if (result.error) {
    return refusal(result.error).message;
  }
  await rereadProposalFile(fate, file);
  const removed = result.result?.imageRemoved;
  return removed ?? `Could not remove ${imageName(path)}.`;
}

/** Undo of a removal: the lines linking the image go back where they were, over the file now. */
export async function restoreNoteImage(fate: Fate, removed: Removed) {
  const result = await guarded(() =>
    fate.mutations.inbox.restoreImage({ input: { removed }, view: InboxView }),
  );
  rereadChanges(fate);
  if (result.error) {
    return refusal(result.error).message;
  }
  await rereadProposalFile(fate, removed.file);
  return undefined;
}
