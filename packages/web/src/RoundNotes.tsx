import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { useCallback, useEffect, useId, useRef } from "react";
import { AttachButton } from "./attach/AttachButton.tsx";
import { AttachStatus } from "./attach/AttachStatus.tsx";
import { DropHint } from "./attach/DropHint.tsx";
import { useImageDrop } from "./attach/useImageDrop.ts";
import { useImageText } from "./attach/useImageText.ts";
import type { useFile } from "./data.ts";
import { refusal } from "./errors.ts";
import { RestoreNotice } from "./fields/RestoreNotice.tsx";
import { SaveStatus } from "./fields/SaveStatus.tsx";
import { SaveKeys } from "./fields/SaveKeys.tsx";
import { TextField } from "./fields/TextField.tsx";
import { useTextField } from "./fields/useTextField.ts";
import { Paragraph } from "./layout/Paragraph.tsx";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";
import { type Hashes, type RoundTarget, useRoundWrites } from "./roundTarget.ts";
import { useSave } from "./useSave.ts";
import { Empty } from "./layout/Empty.tsx";

type File = NonNullable<ReturnType<typeof useFile>>;

const styles = stylex.create({
  text: {
    // The notes as typed, their lines kept.
    whiteSpace: "pre-wrap",
  },
});

/** What the notice says when the notes changed since their unsaved text was typed. */
export const NOTES_CHANGED = "The notes changed since: saving replaces them.";

/**
 * A round's notes: the free notes the file holds, `read`, and the field's text, kept unsaved until
 * `commit` saves it, as "Save notes" does. `flush` saves what is unsaved at once, once the images
 * being added are in, as a submit does. `target` is the round they are written in, `hashes` the
 * page's `RoundHash`, which it provides below the page's own hooks.
 */
export function useRoundNotes(file: File, target: RoundTarget, hashes: Hashes) {
  const writes = useRoundWrites(target, hashes);
  const read = file.current.items.clarifications?.notes ?? "";
  const field = useTextField(`${file.path}#notes`, read);
  // The images being added to the notes, which a submit waits for.
  const settled = useRef<() => Promise<void>>(async () => {});
  const run = async (value: string, previous: string) => {
    const result = await writes.notes({ notes: value, previous });
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
  queued,
  takes,
}: {
  notes: ReturnType<typeof useRoundNotes>;
  path: string;
  /** Takes the images dropped while the field was not drawn, which it adds once drawn. */
  queued?: () => Array<globalThis.File> | undefined;
  /** Whether the round's file takes images, as the core says. */
  takes: boolean;
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
    takes,
    text: field.text,
  });
  useEffect(() => {
    waitFor(images.settled);
  }, [waitFor, images.settled]);
  const { addFiles } = images;
  useEffect(() => {
    const files = queued?.();
    if (files?.length) {
      void addFiles(files);
    }
  }, [queued, addFiles]);
  const saveNow = () => {
    if (field.dirty) {
      void commit(field.text);
    }
  };
  return (
    <VStack gap={2}>
      <NotesRestored notes={notes} />
      <DropHint hint={images.hint} isLabelled>
        <TextField
          id={NOTES_FIELD}
          kind="notes"
          label="Anything else"
          onChange={field.change}
          onSubmit={saveNow}
          value={field.text}
          {...images.fieldProps}
        />
      </DropHint>
      <AttachStatus status={images.status} />
      <HStack align="center" gap={2} wrap="wrap">
        {takes && (
          <AttachButton
            name="Add image to the notes"
            onFiles={(files) => void images.addFiles(files)}
          />
        )}
        <Button isDisabled={!field.dirty} label="Save notes" onClick={saveNow} />
        <SaveStatus dirty={field.dirty} state={save.state} />
        <SaveKeys />
      </HStack>
    </VStack>
  );
}

/**
 * The notice over the notes whose unsaved text was restored, with Discard, and whether they changed
 * since: in their field, and at the round's end while the field is not drawn.
 */
function NotesRestored({ notes: { field } }: { notes: ReturnType<typeof useRoundNotes> }) {
  return (
    field.restored && (
      <RestoreNotice changed={NOTES_CHANGED} onDiscard={field.discard} restored={field.restored} />
    )
  );
}

/** The id of the notes' field, which "Edit notes" focuses once its tab or sheet shows it. */
export const NOTES_FIELD = "round-notes";

/**
 * The round's notes at its end, as typed, read-only: marked while unsaved, with "Edit notes", or
 * "Write a note" while there are none, which `onEdit` opens their field for, in the column's Notes
 * tab on wide screens and in a sheet on the phone. While their field is not drawn, `fieldShown`
 * false, the notice of their restored text shows here, with Discard.
 */
export function NotesRead({
  fieldShown,
  notes,
  onEdit,
}: {
  fieldShown: boolean;
  notes: ReturnType<typeof useRoundNotes>;
  onEdit: () => void;
}) {
  const narrow = isNarrow(useWidthClass());
  const title = useId();
  const { field, save } = notes;
  const written = field.text.trim() !== "";
  return (
    <section aria-labelledby={title}>
      <VStack gap={2}>
        <Heading id={title} level={2}>
          Notes
        </Heading>
        {!fieldShown && <NotesRestored notes={notes} />}
        {written ? (
          <Paragraph xstyle={styles.text}>{field.text}</Paragraph>
        ) : (
          <Empty>
            No notes yet. Write one from anywhere: the Notes{" "}
            {narrow ? "button below" : "tab of the column"}.
          </Empty>
        )}
        <HStack align="center" gap={2} wrap="wrap">
          <Button
            icon={<Icon icon="uraeda:pencil" />}
            label={written ? "Edit notes" : "Write a note"}
            onClick={onEdit}
            size="sm"
          />
          <SaveStatus dirty={field.dirty} state={save.state} />
        </HStack>
      </VStack>
    </section>
  );
}

/**
 * While the notes' field is not drawn, `shown` false, the images dropped on the round's page with no
 * field focused still go to the notes: `onOpen` draws the field, which adds them. Kept meanwhile,
 * they are taken once by the returned function, which `NotesField` takes as `queued`.
 */
export function useNotesDrop({
  onOpen,
  shown,
  takes,
}: {
  onOpen: () => void;
  shown: boolean;
  takes: boolean;
}) {
  const queued = useRef<Array<globalThis.File>>(undefined);
  const none = useRef<HTMLElement>(null);
  useImageDrop({
    label: "the notes",
    onFiles: (files) => {
      queued.current = files;
      onOpen();
    },
    priority: 1,
    ref: none,
    takes: takes && !shown,
  });
  return useCallback(() => {
    const files = queued.current;
    queued.current = undefined;
    return files;
  }, []);
}
