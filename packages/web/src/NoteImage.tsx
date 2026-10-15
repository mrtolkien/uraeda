// A note with an image (US6): the image picked in the add form, and the add that makes the note a
// draft holding it, through the core's attach and its encoding (the attachments decision).
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { Thumbnail } from "@astryxdesign/core/Thumbnail";
import { useState } from "react";
import { useFateClient } from "react-fate";
import type { AttachedView, InboxNote } from "uraeda-binding";
import { useAttach } from "./attach/useAttach.ts";
import { readInbox, rereadChanges } from "./data.ts";
import { type Refusal, refusal } from "./errors.ts";
import { DraftView, InboxView } from "./views.ts";

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

/** Takes back a note added as a draft, with its draft unless the human typed in it. */
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

/**
 * Adds a note as a draft holding an image: the note as a draft linked from the inbox first, then
 * the image attached to that draft, which makes it a folder, then its link at the end of the
 * draft's What. An image the core refuses takes the note and its draft back out: the form keeps
 * the text, and shows the core's message under the image, as image attachments do.
 */
export function useAddAsDraft() {
  const fate = useFateClient();
  // The draft's path is known once it is written: each upload names it.
  const { attach, status } = useAttach({ path: "" });
  // The image the status is about: another one picked since shows none.
  const [tried, setTried] = useState<File>();

  const add = async (
    input: { about?: string; category?: string; hash: string; text: string },
    image: File,
  ): Promise<AddedAsDraft> => {
    const made = await fate.mutations.inbox.addAsDraft({ input, view: DraftView });
    const written = made.result as { hash: string; path: string } | undefined;
    if (made.error || !written) {
      return { ...refusal(made.error), ok: false };
    }
    setTried(image);
    const [uploaded] = await attach([image], written.path);
    if (!uploaded?.ok) {
      const note = await noteOfDraft(fate, written.path);
      if (note) {
        await undoAsDraft(fate, note);
      }
      return { byImage: true, kind: "refused", message: uploaded?.message ?? "", ok: false };
    }
    const attached = uploaded.value as AttachedView;
    const draft = attached.moved ?? written.path;
    const linked = await fate.mutations.inbox.linkImage({
      input: { draft, hash: written.hash, link: attached.link },
      view: DraftView,
    });
    rereadChanges(fate);
    if (linked.error) {
      return { ...refusal(linked.error), ok: false };
    }
    return { draft, note: await noteOfDraft(fate, draft), ok: true };
  };

  return { add, statusOf: (image: File) => (image === tried ? status : undefined) };
}
