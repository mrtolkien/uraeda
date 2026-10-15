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
import { plain } from "./Spans.tsx";
import { InboxView } from "./views.ts";

type Fate = ReturnType<typeof useFateClient>;

/** The line under the image, saying what Add does with it. */
export const AS_DRAFT = "With an image, the note is saved as a draft, linked from the inbox.";

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

/** The image picked for a note, its preview freed as another replaces it or it goes. */
export function usePickedImage() {
  const [picked, setPicked] = useState<Picked>();
  const pick = (file: File | undefined) => {
    if (picked?.preview !== undefined) {
      URL.revokeObjectURL(picked.preview);
    }
    setPicked(file ? { file, preview: previewOf(file) } : undefined);
  };
  return [picked, pick] as const;
}

/** The image picked for the note: its thumbnail, its name, and Remove. */
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

/** The add's input to the core: the note's text, its category, and its feature or bug. */
export type AddInput = { about?: string; category?: string; hash: string; text: string };

/**
 * How long the add may take, the core's encoding included, as an image's upload (R72). One the
 * server never answers ends then.
 */
const UPLOAD_TIMEOUT = 120_000;

/**
 * The note an add whose answer was lost wrote after all: one of the inbox now, not in `before`,
 * that links a draft and reads `text`. The server may finish an add the page stopped waiting for.
 */
async function addedAfterAll(fate: Fate, before: Notes, text: string) {
  const now = await readInbox(fate).catch(() => undefined);
  const note = now && addedNote(before, now.categories);
  const typed = text.split(/\s+/).filter(Boolean).join(" ");
  return note?.draft !== undefined && note.draft !== null && plain(note.spans) === typed
    ? { draft: note.draft, note }
    : undefined;
}

/**
 * Adds a note with an image in one request to the repository's `POST /r/<name>/inbox/note-image`:
 * the core encodes the image and writes the draft folder holding the note and the image, linked
 * from the inbox, all or nothing, so a refusal leaves nothing to clean up. Its status shows under
 * the image: "Adding <name>…", then the refusal, which a conflict leaves to the form. A request
 * whose answer is lost is done when the inbox now holds its note, so a retry never adds it twice.
 */
export function useAddWithImage() {
  const fate = useFateClient();
  const fetch = useServerFetch();
  const repo = useRepository();
  const announce = useAnnounce();
  // The image the status is about: another one picked since shows none.
  const [shown, setShown] = useState<{ image: File; status: AttachStatus }>();

  const show = (image: File, text: string, error = false) => {
    setShown({ image, status: { error, text } });
    announce(text, error ? "assertive" : "polite");
  };

  const refused = (image: File, message: string): AddedAsDraft => {
    show(image, message, true);
    return { byImage: true, kind: "refused", message, ok: false };
  };

  const send = async (input: AddInput, image: File) => {
    const body = new FormData();
    for (const [key, value] of Object.entries(input)) {
      body.append(key, value);
    }
    body.append("file", image);
    const query = new URLSearchParams(image.name ? { name: image.name } : {});
    const response = await fetch(`${repoPath(repo, "/inbox/note-image")}?${query}`, {
      body,
      method: "POST",
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT),
    });
    const answer = (await response.json().catch(() => ({}))) as { draft?: string; error?: string };
    return answer.draft ?? refusal(answer.error ?? `HTTP ${response.status}`);
  };

  const add = async (input: AddInput, image: File, before: Notes): Promise<AddedAsDraft> => {
    const name = image.name || "pasted image";
    if (image.size > IMAGE_LIMIT) {
      return refused(image, overLimit(name, image.size));
    }
    show(image, `Adding ${name}…`);
    let sent: string | Refusal;
    try {
      sent = await send(input, image);
    } catch (error) {
      const done = await addedAfterAll(fate, before, input.text);
      if (done) {
        rereadChanges(fate);
        return { ...done, ok: true };
      }
      const timedOut = (error as { name?: unknown } | null)?.name === "TimeoutError";
      return refused(image, timedOut ? TIMED_OUT : "Could not reach the Uraeda server.");
    }
    if (typeof sent !== "string") {
      if (sent.kind === "conflict") {
        setShown(undefined);
        return { ...sent, ok: false };
      }
      return refused(image, sent.message);
    }
    rereadChanges(fate);
    return { draft: sent, note: await noteOfDraft(fate, sent), ok: true };
  };

  const statusOf = (image: File) => (shown?.image === image ? shown.status : undefined);
  return { add, statusOf };
}

/** The refusal of an add the server did not answer in time. */
const TIMED_OUT = "The note could not be added: the server did not answer in time.";
