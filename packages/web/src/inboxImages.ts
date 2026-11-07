// A note's image taken out of its note file by the core: the lines linking it go, and the image's
// file stays for `ura inbox clean`, or a commit of the folder, to delete once nothing links it.
import type { useFateClient } from "react-fate";
import type { ChangeView, InboxNote } from "uraeda-binding";
import { readProposalFile, rereadProposalFile } from "./attach/useEditorImages.ts";
import { readInbox, rereadChanges } from "./data.ts";
import { guarded, refusal } from "./errors.ts";
import { imageRemoved } from "./optimisticLists.ts";
import { InboxChangeView } from "./undo/changeViews.ts";

type Fate = ReturnType<typeof useFateClient>;

/** An image's file name: what Remove and its alt text name it by. */
export function imageName(path: string) {
  return path.split("/").at(-1) ?? path;
}

/**
 * Takes the image at `path`, from the repository's top level, out of the note file of `note`, over
 * the version of the file read. Gives the change it recorded, which the undo stack takes, or the
 * refusal to show: a removal that landed with no change, as one whose file held no such link, gives
 * nothing, with nothing to record.
 */
export async function removeNoteImage(
  fate: Fate,
  note: InboxNote,
  path: string,
): Promise<ChangeView | string | undefined> {
  if (note.file === undefined) {
    return "The note has no file.";
  }
  const file = note.file;
  const read = await readProposalFile(fate, file);
  if (!read) {
    return `The note file ${file} was not found.`;
  }
  const now = await readInbox(fate, "cache-first").catch(() => undefined);
  const result = await guarded(() =>
    fate.mutations.inbox.removeImage({
      input: { file, hash: read.hash, image: path },
      ...(now ? { optimistic: imageRemoved(now.categories, note.id, path) } : {}),
      view: InboxChangeView,
    }),
  );
  rereadChanges(fate);
  if (result.error) {
    return refusal(result.error).message;
  }
  await rereadProposalFile(fate, file);
  return result.result?.change ?? undefined;
}
