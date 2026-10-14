import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { VStack } from "@astryxdesign/core/VStack";
import { useCallback, useEffect, useRef } from "react";
import { useFateClient } from "react-fate";
import { AttachButton } from "./attach/AttachButton.tsx";
import { AttachStatus } from "./attach/AttachStatus.tsx";
import { DropHint } from "./attach/DropHint.tsx";
import { useImageText } from "./attach/useImageText.ts";
import type { useFile } from "./data.ts";
import { refusal } from "./errors.ts";
import { RestoreNotice } from "./fields/RestoreNotice.tsx";
import { SaveStatus } from "./fields/SaveStatus.tsx";
import { TextField } from "./fields/TextField.tsx";
import { useTextField } from "./fields/useTextField.ts";
import { useSave } from "./useSave.ts";
import { FileView } from "./views.ts";

type File = NonNullable<ReturnType<typeof useFile>>;

/** What the notice says when the notes changed since their unsaved text was typed. */
export const NOTES_CHANGED = "The notes changed since: saving replaces them.";

/**
 * A round's notes: the free notes the file holds, `read`, and the field's text, kept unsaved until
 * `commit` saves it, as "Save notes" does. `flush` saves what is unsaved at once, once the images
 * being added are in, as a submit does.
 */
export function useRoundNotes(file: File) {
  const fate = useFateClient();
  const read = file.current.items.clarifications?.notes ?? "";
  const field = useTextField(`${file.path}#notes`, read);
  // The images being added to the notes, which a submit waits for.
  const settled = useRef<() => Promise<void>>(async () => {});
  const run = async (value: string, previous: string) => {
    const result = await fate.mutations.notes.save({
      input: { folder: file.folder, notes: value, previous },
      view: FileView,
    });
    if (result.error) {
      return { message: refusal(result.error).message, ok: false as const };
    }
    field.saved(value);
    return {
      ok: true as const,
      saved: result.result?.current.items.clarifications?.notes ?? value,
    };
  };
  const save = useSave<string>(run, read);
  const { settle } = save;
  // The file's notes are the last ones written, which the next save says it replaces.
  useEffect(() => {
    settle(read);
  }, [read, settle]);
  /** Saves the notes as `value`, after the saves before it; resolves with whether it did. */
  const commit = (value: string) => save.save(value);
  /** Takes how to wait for the images being added. */
  const waitFor = useCallback((wait: () => Promise<void>) => {
    settled.current = wait;
  }, []);
  const flush = async () => {
    await settled.current();
    const unsaved = field.unsavedNow();
    return unsaved ? commit(unsaved.text) : save.flush();
  };
  return { commit, field, flush, read, save, waitFor };
}

/**
 * The round's notes as they are written: the page's main field, saved with "Save notes" or
 * Ctrl+Enter. It takes the images dropped with no field focused, as well as those pasted or picked,
 * and saves them at once with their links, and the text as typed.
 */
export function NotesField({
  notes,
  path,
}: {
  notes: ReturnType<typeof useRoundNotes>;
  path: string;
}) {
  const { commit, field, save, waitFor } = notes;
  const images = useImageText({
    label: "the notes",
    onText: (value: string, added: boolean) => {
      field.change(value);
      if (added) {
        void commit(value);
      }
    },
    path,
    priority: 1,
    text: field.text,
  });
  useEffect(() => {
    waitFor(images.settled);
  }, [waitFor, images.settled]);
  const saveNow = () => {
    if (field.dirty) {
      void commit(field.text);
    }
  };
  return (
    <VStack gap={2}>
      {field.restored && (
        <RestoreNotice
          changed={NOTES_CHANGED}
          onDiscard={field.discard}
          restored={field.restored}
        />
      )}
      <DropHint hint={images.hint} isLabelled>
        <TextField
          kind="notes"
          label="Notes"
          onChange={field.change}
          onSubmit={saveNow}
          value={field.text}
          {...images.fieldProps}
        />
      </DropHint>
      <AttachStatus status={images.status} />
      <HStack align="center" gap={2} wrap="wrap">
        <AttachButton
          name="Add image to the notes"
          onFiles={(files) => void images.addFiles(files)}
        />
        <Button isDisabled={!field.dirty} label="Save notes" onClick={saveNow} />
        <SaveStatus dirty={field.dirty} state={save.state} />
      </HStack>
    </VStack>
  );
}
