import { AnnouncedBanner } from "./layout/AnnouncedBanner.tsx";
import { Selector } from "@astryxdesign/core/Selector";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { type ClipboardEvent, type FocusEvent, useEffect, useRef, useState } from "react";
import { useFateClient } from "react-fate";
import type { InboxNote } from "uraeda-binding";
import { AttachButton } from "./attach/AttachButton.tsx";
import { AttachStatus } from "./attach/AttachStatus.tsx";
import { DropHint, dropStyles } from "./attach/DropHint.tsx";
import { useImageDrop } from "./attach/useImageDrop.ts";
import { pastedImages } from "./attach/useImageText.ts";
import { useInbox } from "./data.ts";
import { type Refusal, refusal } from "./errors.ts";
import { DISCARD_CHANGES, useConfirm } from "./fields/Confirm.tsx";
import { RestoreNotice } from "./fields/RestoreNotice.tsx";
import { TextField } from "./fields/TextField.tsx";
import { useTextField } from "./fields/useTextField.ts";
import {
  type AddInput,
  addedNote,
  AS_FILE,
  type Picked,
  PickedImage,
  type PickedChanges,
  useAddWithImage,
} from "./NoteImage.tsx";
import { AddButtons, enterAdds } from "./QuickAdd.tsx";
import { InboxView } from "./views.ts";

/** The Category menu's values for no category and a new one; a category's is its name, after `:`. */
const NONE = "none";
const NEW = "new";

/**
 * Opens a selector reached with the keyboard, as Tab does from the note's field, by the key that
 * opens it: not one clicked, which opens itself, nor one the focus comes back to as it closes.
 */
function openOnTab(event: FocusEvent<HTMLElement>) {
  const trigger = event.currentTarget;
  const from = event.relatedTarget;
  if (!trigger.matches(":focus-visible") || from?.closest("[role='listbox'], [popover]")) {
    return;
  }
  trigger.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" }));
}

/**
 * The Category menu: "No category", the inbox's categories, and "New category…", which shows a
 * field for the new one's name. Tab from the note's field opens it.
 */
function CategoryField({
  category,
  name,
  names,
  onCategory,
  onName,
}: {
  category: string;
  name: string;
  names: ReadonlyArray<string>;
  onCategory: (category: string) => void;
  onName: (name: string) => void;
}) {
  return (
    <>
      <Selector
        label="Category"
        onChange={onCategory}
        onFocus={openOnTab}
        options={[
          { label: "No category", value: NONE },
          ...names.map((one) => ({ label: one, value: `:${one}` })),
          { type: "divider" as const },
          { label: "New category…", value: NEW },
        ]}
        presentation="popover"
        value={category}
      />
      {category === NEW && (
        <TextInput hasAutoFocus label="Category name" onChange={onName} value={name} />
      )}
    </>
  );
}

/**
 * The form's typed text, each kept like every text field: the note's, under the unsaved store's
 * `inbox-add`, and a new category's name, under `inbox-add#category`, which brings its "New
 * category…" choice back with it.
 */
function useTypedNote(start?: string | null) {
  const note = useTextField("inbox-add", "");
  const name = useTextField("inbox-add#category", "");
  // A category the form was opened on, `null` for none, wins over a name left behind; a plain
  // opening, with no place, brings the name back with its "New category…".
  const [category, setCategory] = useState(() =>
    start !== undefined ? (start ? `:${start}` : NONE) : name.text ? NEW : NONE,
  );
  const naming = category === NEW;
  return {
    category,
    chosen: category === NONE ? undefined : naming ? name.text.trim() : category.slice(1),
    // A name left behind another choice is not the form's: it shows again with "New category…".
    dirty: note.dirty || (naming && name.dirty),
    discard: () => {
      note.discard();
      name.discard();
    },
    name,
    note,
    restored: note.restored ?? (naming ? name.restored : undefined),
    setCategory,
    /** Forgets the text just added, unless more was typed meanwhile. */
    added: (text: string, typedName: string) => {
      if (note.unsavedNow()?.text === text) {
        note.discard();
      }
      if (naming && name.unsavedNow()?.text === typedName) {
        name.discard();
      }
    },
  };
}

/**
 * What a note's add reports: the note, and its note file when added as one. It is never committed:
 * commits come from the commit page.
 */
export type NoteAdded = {
  file?: string;
  note: InboxNote | undefined;
};

/**
 * Add, or Add as a file with images: the note through the core, its refusal as the message to
 * show, and a conflict reading the inbox again, for the next try to add to it as it is now.
 */
function useAdd({
  about,
  images,
  onAdded,
  typed,
}: {
  about?: string;
  images: ReadonlyArray<Picked>;
  onAdded: (added: NoteAdded) => void;
  typed: ReturnType<typeof useTypedNote>;
}) {
  const fate = useFateClient();
  const inbox = useInbox();
  const withImages = useAddWithImage();
  const [message, setMessage] = useState<string>();
  const text = typed.note.text;
  const chosen = typed.chosen;
  const ready = text.trim() !== "" && chosen !== "";

  const refused = (failed: Refusal) => {
    setMessage(failed.message);
    if (failed.kind === "conflict") {
      void fate.request({ inbox: { id: "inbox", view: InboxView } }, { mode: "network-only" });
    }
  };

  const withImage = async (input: AddInput, files: ReadonlyArray<File>) => {
    const result = await withImages.add(input, files, inbox?.categories ?? []);
    if (!result.ok) {
      if (!result.byImage) {
        refused(result);
      }
      return;
    }
    typed.added(text, typed.name.text);
    onAdded({ file: result.file, note: result.note });
  };

  const add = async () => {
    if (!ready) {
      return;
    }
    setMessage(undefined);
    const input: AddInput = {
      hash: inbox?.hash ?? "",
      text,
      ...(chosen === undefined ? {} : { category: chosen }),
      ...(about === undefined ? {} : { about }),
    };
    if (images.length > 0) {
      await withImage(
        input,
        images.map((image) => image.file),
      );
      return;
    }
    const before = inbox?.categories ?? [];
    const result = await fate.mutations.inbox.add({
      input,
      view: InboxView,
    });
    if (result.error) {
      refused(refusal(result.error));
      return;
    }
    typed.added(text, typed.name.text);
    onAdded({ note: addedNote(before, result.result?.categories ?? []) });
  };

  return {
    add,
    message,
    names: inbox?.names ?? [],
    ready,
    status: withImages.statusOf(images.map((image) => image.file)),
  };
}

/**
 * Gives the overlay, through `closes`, what it asks before it closes: with text or images, "Discard
 * your changes?", which discards them; with neither, nothing.
 */
function useCloseGuard({
  closes,
  images,
  picked,
  typed,
}: {
  closes: (ask: () => Promise<boolean>) => void;
  images: ReadonlyArray<Picked>;
  picked: PickedChanges;
  typed: ReturnType<typeof useTypedNote>;
}) {
  const confirm = useConfirm();
  // What the overlay's close reads: the form as it is now.
  const now = useRef({ images, typed });
  useEffect(() => {
    now.current = { images, typed };
  }, [images, typed]);
  // Its text and images go once the human confirms, or with nothing typed.
  useEffect(
    () =>
      closes(async () => {
        const { images, typed } = now.current;
        if ((typed.dirty || images.length > 0) && !(await confirm(DISCARD_CHANGES))) {
          return false;
        }
        typed.discard();
        picked.clear();
        return true;
      }),
    [closes, confirm, picked],
  );
}

/**
 * The add form: a note's text, and its category, "No category" by default, one of the inbox's, or
 * a new one, named in its own field. It reads the inbox when it opens, for the version it adds to.
 * `about`, on a feature's or a change's page, is its folder, which marks the note with its slug. Its
 * text is kept as the page changes and restored as it opens again (`useTypedNote`); closing the
 * overlay asks "Discard your changes?" first when it holds text or images, through `closes`, which
 * the overlay asks. Enter adds, as Add does, its one button: the commit page commits. With
 * `images`, picked with "Attach an image", dropped, or pasted, and held by the overlay (`picked`),
 * Add becomes "Add as a file".
 */
export function AddNote({
  about,
  category,
  closes,
  images,
  onAdded,
  picked,
}: {
  about?: string;
  /** The category the form opens on: a name, or `null` for none, which is the default. */
  category?: string | null;
  /** Gives the overlay what it asks before it closes: `false` keeps the form open. */
  closes: (ask: () => Promise<boolean>) => void;
  images: ReadonlyArray<Picked>;
  onAdded: (added: NoteAdded) => void;
  picked: PickedChanges;
}) {
  const typed = useTypedNote(category);
  const { add, message, names, ready, status } = useAdd({ about, images, onAdded, typed });
  const field = useRef<HTMLTextAreaElement>(null);
  const drop = useImageDrop({ label: "the note", onFiles: picked.add, priority: 1, ref: field });

  useCloseGuard({ closes, images, picked, typed });

  return (
    <VStack gap={4}>
      {typed.restored && (
        // Its saved text is always empty: it never changes since.
        <RestoreNotice changed="" onDiscard={typed.discard} restored={typed.restored} />
      )}
      <DropHint hint={drop.hint}>
        <TextField
          // The field's box, which a text field's own style no longer reaches (Astryx 0.7).
          controlXstyle={drop.isTarget ? dropStyles.target : undefined}
          hasAutoFocus
          isLabelHidden
          kind="line"
          label="Note"
          onChange={typed.note.change}
          // A note is one line: Enter adds it, or adds it as a file with its images.
          onKeyDown={enterAdds(() => void add())}
          onPaste={(event: ClipboardEvent<HTMLTextAreaElement>) => {
            const files = pastedImages(event);
            if (files) {
              event.preventDefault();
              picked.add(files);
            }
          }}
          placeholder="What did you notice?"
          ref={field}
          value={typed.note.text}
        />
      </DropHint>
      <CategoryField
        category={typed.category}
        name={typed.name.text}
        names={names}
        onCategory={typed.setCategory}
        onName={typed.name.change}
      />
      {images.length > 0 && (
        <VStack gap={2}>
          <HStack gap={2} wrap="wrap">
            {images.map((image) => (
              <PickedImage
                image={image}
                key={image.preview ?? image.file.name}
                onRemove={() => picked.remove(image)}
              />
            ))}
          </HStack>
          <AttachStatus status={status} />
          <Text color="secondary" type="supporting">
            {AS_FILE}
          </Text>
        </VStack>
      )}
      {message && <AnnouncedBanner status="error" title={message} />}
      <AddButtons
        addLabel={images.length === 0 ? "Add" : "Add as a file"}
        isReady={ready}
        onAdd={add}
        start={<AttachButton multiple onFiles={picked.add} text="Attach an image" />}
      />
    </VStack>
  );
}
