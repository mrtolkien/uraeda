import { Banner } from "@astryxdesign/core/Banner";
import { Selector } from "@astryxdesign/core/Selector";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { useState } from "react";
import { useFateClient } from "react-fate";
import type { InboxNote } from "uraeda-binding";
import { AttachButton } from "./attach/AttachButton.tsx";
import { AttachStatus } from "./attach/AttachStatus.tsx";
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
 * Add, Add as a draft with an image, or "Add and commit": the note through the core, its refusal as
 * the message to show, and a conflict reading the inbox again, for the next try to add to it as it
 * is now. When "Add and commit" only added, `notice` says why, and the form stays open.
 */
function useAdd({
  about,
  image,
  onAdded,
  typed,
}: {
  about?: string;
  image?: Picked;
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

  const withImage = async (input: AddInput, file: File) => {
    const result = await withImages.add(input, file, inbox?.categories ?? []);
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
    if (image) {
      await withImage(input, image.file);
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
    status: image && withImages.statusOf(image.file),
  };
}

/**
 * The add form: a note's text, and its category, "No category" by default, one of the inbox's, or
 * a new one, named in its own field. It reads the inbox when it opens, for the version it adds to.
 * `about`, on a feature's or a change's page, is its folder, which marks the note with its slug. Its
 * text is kept as the overlay closes and restored as it opens again (`useTypedNote`); Cancel asks
 * "Discard your changes?" first when it holds text or an image. Enter adds and commits, as "Add and
 * commit" does, beside Add. With `image`, picked with "Attach an image" and held by the overlay
 * (`onImage`), Add becomes "Add as a draft", the one way to add, which Enter takes.
 */
export function AddNote({
  about,
  image,
  onAdded,
  onCancel,
  onImage,
}: {
  about?: string;
  image?: Picked;
  onAdded: (added: NoteAdded) => void;
  onCancel: () => void;
  onImage: (image: File | undefined) => void;
}) {
  const confirm = useConfirm();
  const typed = useTypedNote();
  const { add, message, names, notice, ready, status } = useAdd({ about, image, onAdded, typed });
  // A draft with its image is never committed by its add.
  const commits = image === undefined;
  const commit = useAddAndCommit(() => add(true));

  const cancel = async () => {
    if ((typed.dirty || image) && !(await confirm(DISCARD_CHANGES))) {
      return;
    }
    typed.discard();
    onImage(undefined);
    onCancel();
  };

  return (
    <VStack gap={4}>
      {typed.restored && (
        // Its saved text is always empty: it never changes since.
        <RestoreNotice changed="" onDiscard={typed.discard} restored={typed.restored} />
      )}
      <TextField
        hasAutoFocus
        isLabelHidden
        kind="line"
        label="Note"
        onChange={typed.note.change}
        // A note is one line: Enter adds and commits it, or adds it as a draft with its image.
        onKeyDown={enterAdds(() => (commits ? ready && commit.onAddAndCommit() : void add()))}
        placeholder="What did you notice?"
        value={typed.note.text}
      />
      <CategoryField
        category={typed.category}
        name={typed.name.text}
        names={names}
        onCategory={typed.setCategory}
        onName={typed.name.change}
      />
      {image && (
        <VStack gap={2}>
          <PickedImage image={image} onRemove={() => onImage(undefined)} />
          <AttachStatus status={status} />
          <Text color="secondary" type="supporting">
            {AS_DRAFT}
          </Text>
        </VStack>
      )}
      {message && <Banner status="error" title={message} />}
      <CommitBanner notice={notice} />
      <AddButtons
        addLabel={image ? "Add as a draft" : "Add"}
        isReady={ready}
        onAdd={() => add()}
        {...(commits ? commit : {})}
        onCancel={() => void cancel()}
        start={<AttachButton onFiles={([file]) => onImage(file)} text="Attach an image" />}
      />
    </VStack>
  );
}
