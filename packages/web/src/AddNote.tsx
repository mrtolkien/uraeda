import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Selector } from "@astryxdesign/core/Selector";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { type KeyboardEvent, useState } from "react";
import { useFateClient } from "react-fate";
import type { InboxNote } from "uraeda-binding";
import { useInbox } from "./data.ts";
import { refusal } from "./errors.ts";
import { DISCARD_CHANGES, useConfirm } from "./fields/Confirm.tsx";
import { RestoreNotice } from "./fields/RestoreNotice.tsx";
import { TextField } from "./fields/TextField.tsx";
import { useTextField } from "./fields/useTextField.ts";
import { useWidthClass } from "./layout/useWidthClass.ts";
import { InboxView } from "./views.ts";

/** The Category menu's values for no category and a new one; a category's is its name, after `:`. */
const NONE = "none";
const NEW = "new";

/** A note's lines, as one text: what tells two notes apart. */
const linesOf = (note: InboxNote) => note.lines.join("\n");

/** The inbox's notes, in every category. */
type Notes = ReadonlyArray<{ notes: ReadonlyArray<InboxNote> }>;

/** The note an add wrote: the one of `after` that `before` does not hold. */
function addedNote(before: Notes, after: Notes): InboxNote | undefined {
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

/**
 * The add form: a note's text, and its category, "No category" by default, one of the inbox's, or
 * a new one, named in its own field. It reads the inbox when it opens, for the version it adds to.
 * `about`, on a feature's or a bug's page, is its folder, which marks the note with its slug. Its
 * text is kept as the overlay closes and restored as it opens again (`useTypedNote`); Cancel asks
 * "Discard your changes?" first when it holds text. Enter adds.
 */
export function AddNote({
  about,
  onAdded,
  onCancel,
}: {
  about?: string;
  onAdded: (note: InboxNote | undefined) => void;
  onCancel: () => void;
}) {
  const fate = useFateClient();
  const confirm = useConfirm();
  const inbox = useInbox();
  const typed = useTypedNote();
  const text = typed.note.text;
  const chosen = typed.chosen;
  const [message, setMessage] = useState<string>();
  const ready = text.trim() !== "" && chosen !== "";

  const add = async () => {
    if (!ready) {
      return;
    }
    setMessage(undefined);
    const before = inbox?.categories ?? [];
    const result = await fate.mutations.inbox.add({
      input: {
        hash: inbox?.hash ?? "",
        text,
        ...(chosen === undefined ? {} : { category: chosen }),
        ...(about === undefined ? {} : { about }),
      },
      view: InboxView,
    });
    if (result.error) {
      const failed = refusal(result.error);
      setMessage(failed.message);
      if (failed.kind === "conflict") {
        // The next try adds to the inbox as it is now.
        void fate.request({ inbox: { id: "inbox", view: InboxView } }, { mode: "network-only" });
      }
      return;
    }
    typed.added(text, typed.name.text);
    onAdded(addedNote(before, result.result?.categories ?? []));
  };

  const cancel = async () => {
    if (typed.dirty && !(await confirm(DISCARD_CHANGES))) {
      return;
    }
    typed.discard();
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
        onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
          // A note is one line: Enter adds it.
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            void add();
          }
        }}
        placeholder="What did you notice?"
        value={text}
      />
      <CategoryField
        category={typed.category}
        name={typed.name.text}
        names={inbox?.names ?? []}
        onCategory={typed.setCategory}
        onName={typed.name.change}
      />
      {message && <Banner status="error" title={message} />}
      <HStack gap={2} justify="end">
        <Button label="Cancel" onClick={() => void cancel()} variant="secondary" />
        <Button clickAction={add} isDisabled={!ready} label="Add" variant="primary" />
      </HStack>
    </VStack>
  );
}
