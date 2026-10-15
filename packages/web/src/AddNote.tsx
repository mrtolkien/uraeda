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
 * The add form: a note's text, and its category, "No category" by default, one of the inbox's, or
 * a new one, named in its own field. It reads the inbox when it opens, for the version it adds to.
 * `about`, on a feature's or a bug's page, is its folder, which marks the note with its slug. Its
 * text is the unsaved store's `inbox-add`, kept as the overlay closes and restored as it opens
 * again; Cancel asks "Discard your changes?" first when it holds text. Enter adds.
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
  const field = useTextField("inbox-add", "");
  const text = field.text;
  const [category, setCategory] = useState(NONE);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string>();
  const chosen = category === NONE ? undefined : category === NEW ? name.trim() : category.slice(1);
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
    // Forgotten once added, unless more was typed meanwhile.
    if (field.unsavedNow()?.text === text) {
      field.discard();
    }
    onAdded(addedNote(before, result.result?.categories ?? []));
  };

  const cancel = async () => {
    if (field.dirty && !(await confirm(DISCARD_CHANGES))) {
      return;
    }
    field.discard();
    onCancel();
  };

  return (
    <VStack gap={4}>
      {field.restored && (
        // Its saved text is always empty: it never changes since.
        <RestoreNotice changed="" onDiscard={field.discard} restored={field.restored} />
      )}
      <TextField
        hasAutoFocus
        isLabelHidden
        kind="line"
        label="Note"
        onChange={field.change}
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
        category={category}
        name={name}
        names={inbox?.names ?? []}
        onCategory={setCategory}
        onName={setName}
      />
      {message && <Banner status="error" title={message} />}
      <HStack gap={2} justify="end">
        <Button label="Cancel" onClick={() => void cancel()} variant="secondary" />
        <Button clickAction={add} isDisabled={!ready} label="Add" variant="primary" />
      </HStack>
    </VStack>
  );
}
