// A note with an image (US6): the image picked in the add form, and the add that makes the note a
// draft folder holding it, in one call to the core, which encodes the image (the attachments
// decision).
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { Thumbnail } from "@astryxdesign/core/Thumbnail";
import { useAnnounce } from "@astryxdesign/core/hooks";
import { useState } from "react";
import { useFateClient } from "react-fate";
import type { InboxNote } from "uraeda-binding";
import { IMAGE_LIMIT, overLimit } from "uraeda-server/limits";
import { useServerFetch } from "./attach/ServerFetch.tsx";
import type { AttachStatus } from "./attach/useAttach.ts";
import { readInbox, rereadChanges } from "./data.ts";
import { type Refusal, refusal } from "./errors.ts";
import { repoPath, useRepository } from "./routes.tsx";
import { InboxView } from "./views.ts";

type Fate = ReturnType<typeof useFateClient>;

/** The line under the images, saying what Add does with them. */
export const AS_DRAFT = "With images, the note is saved as a draft, linked from the inbox.";

/** An image picked for a note, and its preview, made once as it is picked. */
export type Picked = { file: File; preview?: string };

/** A file's own image, or nothing where the browser makes none. */
function previewOf(file: File): string | undefined {
  try {
    return URL.createObjectURL(file);
  } catch {
    return undefined;
  }
}

/** What changes the images picked for a note. */
export type PickedChanges = {
  add: (files: ReadonlyArray<File>) => void;
  clear: () => void;
  remove: (image: Picked) => void;
};

/** The images picked for a note, in order, their previews freed as they go. */
export function usePickedImages(): readonly [ReadonlyArray<Picked>, PickedChanges] {
  const [picked, setPicked] = useState<ReadonlyArray<Picked>>([]);
  const free = (images: ReadonlyArray<Picked>) => {
    for (const image of images) {
      if (image.preview !== undefined) {
        URL.revokeObjectURL(image.preview);
      }
    }
  };
  return [
    picked,
    {
      add: (files: ReadonlyArray<File>) =>
        setPicked((now) => [...now, ...files.map((file) => ({ file, preview: previewOf(file) }))]),
      clear: () => {
        free(picked);
        setPicked([]);
      },
      remove: (image: Picked) => {
        free([image]);
        setPicked((now) => now.filter((one) => one !== image));
      },
    },
  ] as const;
}

/** An image picked for the note: its thumbnail, its name, and Remove. */
export function PickedImage({ image, onRemove }: { image: Picked; onRemove: () => void }) {
  const name = image.file.name;
  return (
    <HStack align="center" gap={2}>
      {/* Decorative: the name beside it says which image it is. */}
      <Thumbnail alt="" src={image.preview} />
      <Text>{name}</Text>
      <Button label={`Remove ${name}`} onClick={onRemove} variant="ghost">
        Remove
      </Button>
    </HStack>
  );
}

/** The note of the inbox, as it is now, that links the draft at `path`. */
export async function noteOfDraft(fate: Fate, path: string): Promise<InboxNote | undefined> {
  const inbox = await readInbox(fate);
  return inbox.categories.flatMap((category) => category.notes).find((note) => note.draft === path);
}

/** A note's lines, as one text: what tells two notes apart. */
const linesOf = (note: InboxNote) => note.lines.join("\n");

/** The inbox's notes, in every category. */
export type Notes = ReadonlyArray<{ notes: ReadonlyArray<InboxNote> }>;

/** The note an add wrote: the one of `after` that `before` does not hold. */
export function addedNote(before: Notes, after: Notes): InboxNote | undefined {
  const left = before.flatMap((category) => category.notes.map(linesOf));
  return after
    .flatMap((category) => category.notes)
    .find((note) => {
      const index = left.indexOf(linesOf(note));
      if (index < 0) {
        return true;
      }
      left.splice(index, 1);
      return false;
    });
}

/**
 * Takes back a note added as a draft, by its lines as the add wrote them, with its draft unless the
 * human typed in it: refused by the core once the note changed or left.
 */
export async function undoAsDraft(fate: Fate, note: InboxNote) {
  const result = await fate.mutations.inbox.undoAsDraft({
    input: { lines: [...note.lines] },
    view: InboxView,
  });
  rereadChanges(fate);
  return result.error ? refusal(result.error).message : undefined;
}

/**
 * What an add with an image gave: the note and its draft's path, or the refusal to show, `byImage`
 * when the image's status under it shows it already.
 */
export type AddedAsDraft =
  | { draft: string; note?: InboxNote; ok: true }
  | (Refusal & { byImage?: boolean; ok: false });

/** The add's input to the core: the note's text, its category, and its feature or change. */
export type AddInput = { about?: string; category?: string; hash: string; text: string };

/**
 * How long the add may take, the core's encoding included, as an image's upload (R72). One the
 * server never answers ends then.
 */
const UPLOAD_TIMEOUT = 120_000;

/** The words of a text: what tells a draft's title from another, however the core spaces it. */
const words = (text: string) => text.split(/\s+/).filter(Boolean).join(" ");

/**
 * The note an add whose answer was lost wrote after all: one of the inbox now, not in `before`,
 * that links a draft whose title, as the core reads it, has the words of `text`. The server may
 * finish an add the page stopped waiting for.
 */
async function addedAfterAll(fate: Fate, before: Notes, text: string) {
  const now = await readInbox(fate).catch(() => undefined);
  const note = now && addedNote(before, now.categories);
  return note?.draft && note.draftTitle && words(note.draftTitle) === words(text)
    ? { draft: note.draft, note }
    : undefined;
}

/**
 * Posts images to the repository's `POST /r/<name>/inbox/note-image`, with the form's `fields`: the
 * core encodes them and writes the draft folder, all or nothing. Gives the draft's path, or the
 * refusal.
 */
function useNoteImagesPost() {
  const fetch = useServerFetch();
  const repo = useRepository();
  return async (fields: Record<string, string>, images: ReadonlyArray<File>) => {
    const body = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      body.append(key, value);
    }
    for (const image of images) {
      body.append("file", image);
    }
    // One name per image, in order: an empty one for a pasted image, which the core names.
    const query = new URLSearchParams(images.map((image) => ["name", image.name]));
    const response = await fetch(`${repoPath(repo, "/inbox/note-image")}?${query}`, {
      body,
      method: "POST",
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT),
    });
    const answer = (await response.json().catch(() => ({}))) as { draft?: string; error?: string };
    return answer.draft ?? refusal(answer.error ?? `HTTP ${response.status}`);
  };
}

/** The first image over the core's size limit, as its refusal, if any. */
function tooBig(images: ReadonlyArray<File>): string | undefined {
  const big = images.find((image) => image.size > IMAGE_LIMIT);
  return big && overLimit(big.name || "pasted image", big.size);
}

/** What an upload's status is about: the images it was shown for, and the status. */
type Shown = { images: ReadonlyArray<File>; status: AttachStatus };

/** The status of the upload of `images`: none once other images are picked. */
function statusFor(shown: Shown | undefined, images: ReadonlyArray<File>) {
  const same =
    shown?.images.length === images.length && shown.images.every((file, i) => file === images[i]);
  return same ? shown.status : undefined;
}

/**
 * Adds a note with images in one request: the core encodes the images and writes the draft folder
 * holding the note and the images, linked from the inbox, all or nothing, so a refusal leaves
 * nothing to clean up. Its status shows under the images: "Adding <name>…", then the refusal,
 * which a conflict leaves to the form. A request whose answer is lost is done when the inbox now
 * holds its note, so a retry never adds it twice.
 */
export function useAddWithImage() {
  const fate = useFateClient();
  const post = useNoteImagesPost();
  const announce = useAnnounce();
  const [shown, setShown] = useState<Shown>();

  const show = (images: ReadonlyArray<File>, text: string, error = false) => {
    setShown({ images, status: { error, text } });
    announce(text, error ? "assertive" : "polite");
  };

  const refused = (images: ReadonlyArray<File>, message: string): AddedAsDraft => {
    show(images, message, true);
    return { byImage: true, kind: "refused", message, ok: false };
  };

  const add = async (
    input: AddInput,
    images: ReadonlyArray<File>,
    before: Notes,
  ): Promise<AddedAsDraft> => {
    const big = tooBig(images);
    if (big) {
      return refused(images, big);
    }
    show(images, `Adding ${images.map((image) => image.name || "pasted image").join(", ")}…`);
    let sent: string | Refusal;
    try {
      sent = await post(input, images);
    } catch (error) {
      const done = await addedAfterAll(fate, before, input.text);
      if (done) {
        rereadChanges(fate);
        return { ...done, ok: true };
      }
      const timedOut = (error as { name?: unknown } | null)?.name === "TimeoutError";
      return refused(images, timedOut ? TIMED_OUT : "Could not reach the Uraeda server.");
    }
    if (typeof sent !== "string") {
      if (sent.kind === "conflict") {
        setShown(undefined);
        return { ...sent, ok: false };
      }
      return refused(images, sent.message);
    }
    rereadChanges(fate);
    return { draft: sent, note: await noteOfDraft(fate, sent), ok: true };
  };

  return { add, statusOf: (images: ReadonlyArray<File>) => statusFor(shown, images) };
}

/**
 * Adds images to an existing note, one request: into the draft it links, or into the draft it
 * becomes. Its status shows under the note's images; gives the note's draft, or nothing once
 * refused, which the status says.
 */
export function useAttachToNote() {
  const fate = useFateClient();
  const post = useNoteImagesPost();
  const announce = useAnnounce();
  const [status, setStatus] = useState<AttachStatus>();

  const say = (text: string, error = false) => {
    setStatus({ error, text });
    announce(text, error ? "assertive" : "polite");
  };

  const attach = async (note: { hash: string; id: string }, files: ReadonlyArray<File>) => {
    const big = tooBig(files);
    if (big) {
      say(big, true);
      return undefined;
    }
    say(`Adding ${files.map((file) => file.name || "pasted image").join(", ")}…`);
    let sent: string | Refusal;
    try {
      sent = await post({ hash: note.hash, id: note.id }, files);
    } catch (error) {
      const timedOut = (error as { name?: unknown } | null)?.name === "TimeoutError";
      say(
        timedOut ? "The server did not answer in time." : "Could not reach the Uraeda server.",
        true,
      );
      return undefined;
    }
    if (typeof sent !== "string") {
      say(sent.message, true);
      if (sent.kind === "conflict") {
        rereadChanges(fate);
      }
      return undefined;
    }
    setStatus(undefined);
    rereadChanges(fate);
    return sent;
  };

  return { attach, status };
}

/** The refusal of an add the server did not answer in time. */
const TIMED_OUT = "The note could not be added: the server did not answer in time.";
