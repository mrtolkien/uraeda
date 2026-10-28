// A note's image taken out of its draft: the line linking it goes, and the image's file stays for
// `ura inbox clean`, or a commit of the folder, to delete once nothing links it.
import type { useFateClient } from "react-fate";
import type { InboxNote } from "uraeda-binding";
import { readDraft } from "./attach/useEditorImages.ts";
import { rereadChanges } from "./data.ts";
import { draftFile } from "./draftFile.ts";
import { refusal } from "./errors.ts";
import { DraftView } from "./views.ts";

type Fate = ReturnType<typeof useFateClient>;

/** An image's file name: what Remove and its alt text name it by. */
export function imageName(path: string) {
  return path.split("/").at(-1) ?? path;
}

/** `text` with every character a regular expression reads as syntax escaped. */
const escaped = (text: string) => text.replaceAll(/[$()*+.?[\\\]^{|}]/g, String.raw`\$&`);

/**
 * `text` without its images linking `target`, a path from the file's folder: a line left empty
 * goes, with the blank line before it when a blank line or the end follows it, as the core links
 * each image after a blank line.
 */
export function withoutImage(text: string, target: string) {
  const link = String.raw`!\[[^\]]*\]\(<?(?:\./)?${escaped(target)}>?(?:\s+"[^"]*")?\)`;
  const lines = text.split("\n");
  const kept: Array<string> = [];
  lines.forEach((line, at) => {
    if (!new RegExp(link).test(line)) {
      kept.push(line);
      return;
    }
    // The spaces around a link inside a line become one, the line's indent kept.
    const rest = line
      .replaceAll(new RegExp(link, "g"), "")
      .replaceAll(/(\S) {2,}(?=\S)/g, "$1 ")
      .trimEnd();
    if (rest.trim() !== "") {
      kept.push(rest);
      return;
    }
    const next = lines[at + 1];
    if (kept.at(-1)?.trim() === "" && (next === undefined || next.trim() === "")) {
      kept.pop();
    }
  });
  return kept.join("\n");
}

/** What a removal wrote: the draft's file and the text it held before, for Undo. */
export type Removed = { before: string; file: string; hash: string };

/**
 * Takes the image at `path`, from the repository's top level, out of the draft of `note`: the
 * draft's text without its link, saved over the version read. Gives what Undo needs, or the
 * refusal to show.
 */
export async function removeNoteImage(
  fate: Fate,
  note: InboxNote,
  path: string,
): Promise<Removed | string> {
  if (note.draft === undefined) {
    return "The note links no draft.";
  }
  const file = draftFile(note.draft);
  const draft = await readDraft(fate, file);
  if (!draft) {
    return `The draft ${file} was not found.`;
  }
  const folder = file.slice(0, file.lastIndexOf("/") + 1);
  const text = withoutImage(draft.text, path.startsWith(folder) ? path.slice(folder.length) : path);
  if (text === draft.text) {
    return `The draft no longer links ${imageName(path)}.`;
  }
  const result = await fate.mutations.text.save({
    input: { hash: draft.hash, path: file, text },
    view: DraftView,
  });
  rereadChanges(fate);
  if (result.error) {
    return refusal(result.error).message;
  }
  return { before: draft.text, file, hash: result.result?.hash ?? "" };
}

/** Undo of a removal: the draft's text as it was, over the version the removal wrote. */
export async function restoreNoteImage(fate: Fate, removed: Removed) {
  const result = await fate.mutations.text.save({
    input: { hash: removed.hash, path: removed.file, text: removed.before },
    view: DraftView,
  });
  rereadChanges(fate);
  return result.error ? refusal(result.error).message : undefined;
}
