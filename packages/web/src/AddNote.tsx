import { Banner } from "@astryxdesign/core/Banner";
import { Selector } from "@astryxdesign/core/Selector";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { type ClipboardEvent, useRef, useState } from "react";
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
import { useWidthClass } from "./layout/useWidthClass.ts";
import {
  type AddInput,
  addedNote,
  AS_DRAFT,
  type Picked,
  PickedImage,
  type PickedChanges,
  useAddWithImage,
} from "./NoteImage.tsx";
import {
  AddButtons,
  useAddAndCommit,
  CommitBanner,
  type CommitNotice,
  enterAdds,
  uncommitted,
} from "./QuickAdd.tsx";
import { InboxAddedView, InboxView } from "./views.ts";

/** The Category menu's values for no category and a new one; a category's is its name, after `:`. */
const NONE = "none";
const NEW = "new";

/**
 * The Category menu: "No category", the inbox's categories, and "New category…", which shows a
 * field for the new one's name.
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
  const wide = useWidthClass() === "wide";
  return (
    <>
      <Selector
        label="Category"
        onChange={onCategory}
        options={[
          { label: "No category", value: NONE },
          ...names.map((one) => ({ label: one, value: `:${one}` })),
          { type: "divider" as const },
          { label: "New category…", value: NEW },
        ]}
        presentation={wide ? "popover" : "bottom-sheet"}
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
function useTypedNote() {
  const note = useTextField("inbox-add", "");
  const name = useTextField("inbox-add#category", "");
  const [category, setCategory] = useState(() => (name.text ? NEW : NONE));
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

/** What a note's add reports: the note, its draft when added as one, and its commit, if any. */
export type NoteAdded = {
  /** With "Add and commit", the inbox's version after the commit, for Undo to remove it from. */
  committed?: { hash: string };
  draft?: string;
  note: InboxNote | undefined;
};

/**
 * Add, Add as a draft with images, or "Add and commit": the note through the core, its refusal as
 * the message to show, and a conflict reading the inbox again, for the next try to add to it as it
 * is now. When "Add and commit" only added, `notice` says why, and the form stays open.
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
  const [notice, setNotice] = useState<CommitNotice>();
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
    onAdded({ draft: result.draft, note: result.note });
  };

  const add = async (commit = false) => {
    if (!ready) {
      return;
    }
    setMessage(undefined);
    setNotice(undefined);
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
      input: { ...input, commit },
      view: InboxAddedView,
    });
    if (result.error) {
      refused(refusal(result.error));
      return;
    }
    const answer = result.result;
    typed.added(text, typed.name.text);
    // Only added: the form stays open, saying why.
    const why = commit ? uncommitted(answer?.added, "the inbox", "INBOX.md") : undefined;
    if (why) {
      setNotice(why);
      return;
    }
    onAdded({
      ...(commit && answer ? { committed: { hash: answer.hash } } : {}),
      note: addedNote(before, answer?.categories ?? []),
    });
  };

  return {
    add,
    message,
    names: inbox?.names ?? [],
    notice,
    ready,
    status: withImages.statusOf(images.map((image) => image.file)),
  };
}

/**
 * The add form: a note's text, and its category, "No category" by default, one of the inbox's, or
 * a new one, named in its own field. It reads the inbox when it opens, for the version it adds to.
 * `about`, on a feature's or a change's page, is its folder, which marks the note with its slug. Its
 * text is kept as the overlay closes and restored as it opens again (`useTypedNote`); Cancel asks
 * "Discard your changes?" first when it holds text or images. Enter adds and commits, as "Add and
 * commit" does, beside Add. With `images`, picked with "Attach an image", dropped, or pasted, and
 * held by the overlay (`picked`), Add becomes "Add as a draft", the one way to add, which Enter takes.
 */
export function AddNote({
  about,
  images,
  onAdded,
  onCancel,
  picked,
}: {
  about?: string;
  images: ReadonlyArray<Picked>;
  onAdded: (added: NoteAdded) => void;
  onCancel: () => void;
  picked: PickedChanges;
}) {
  const confirm = useConfirm();
  const typed = useTypedNote();
  const { add, message, names, notice, ready, status } = useAdd({ about, images, onAdded, typed });
  // A draft with its images is never committed by its add.
  const commits = images.length === 0;
  const field = useRef<HTMLTextAreaElement>(null);
  const drop = useImageDrop({ label: "the note", onFiles: picked.add, priority: 1, ref: field });
  const commit = useAddAndCommit(() => add(true));

  const cancel = async () => {
    if ((typed.dirty || images.length > 0) && !(await confirm(DISCARD_CHANGES))) {
      return;
    }
    typed.discard();
    picked.clear();
    onCancel();
  };

  return (
    <VStack gap={4}>
      {typed.restored && (
        // Its saved text is always empty: it never changes since.
        <RestoreNotice changed="" onDiscard={typed.discard} restored={typed.restored} />
      )}
      <DropHint hint={drop.hint}>
        <TextField
          hasAutoFocus
          isLabelHidden
          kind="line"
          label="Note"
          onChange={typed.note.change}
          // A note is one line: Enter adds and commits it, or adds it as a draft with its images.
          onKeyDown={enterAdds(() => (commits ? ready && commit.onAddAndCommit() : void add()))}
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
          xstyle={drop.isTarget ? dropStyles.target : undefined}
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
          {images.map((image) => (
            <PickedImage
              image={image}
              key={image.preview ?? image.file.name}
              onRemove={() => picked.remove(image)}
            />
          ))}
          <AttachStatus status={status} />
          <Text color="secondary" type="supporting">
            {AS_DRAFT}
          </Text>
        </VStack>
      )}
      {message && <Banner status="error" title={message} />}
      <CommitBanner notice={notice} />
      <AddButtons
        addLabel={commits ? "Add" : "Add as a draft"}
        isReady={ready}
        onAdd={() => add()}
        {...(commits ? commit : {})}
        onCancel={() => void cancel()}
        start={<AttachButton multiple onFiles={picked.add} text="Attach an image" />}
      />
    </VStack>
  );
}
