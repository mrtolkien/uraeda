import { HStack } from "@astryxdesign/core/HStack";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useFateClient } from "react-fate";
import { AttachButton } from "./attach/AttachButton.tsx";
import { AttachStatus } from "./attach/AttachStatus.tsx";
import { DropHint } from "./attach/DropHint.tsx";
import { useImageText } from "./attach/useImageText.ts";
import type { useFile } from "./data.ts";
import { refusal } from "./errors.ts";
import { GrowingTextArea, statusStyles } from "./Question.tsx";
import { useSave } from "./useSave.ts";
import { FileView } from "./views.ts";

type File = NonNullable<ReturnType<typeof useFile>>;

/**
 * A round's notes: their text, saved as typed, replaced by notes changed elsewhere when nothing of
 * them waits to be saved. `flush` saves them at once, once the images being added are in, as a
 * submit does.
 */
export function useRoundNotes(file: File) {
  const fate = useFateClient();
  const read = file.current.items.clarifications?.notes ?? "";
  const [text, setText] = useState(read);
  // The images being added to the notes, which a submit waits for.
  const settled = useRef<() => Promise<void>>(async () => {});
  const save = useSave<string>(async (value, previous) => {
    const result = await fate.mutations.notes.save({
      input: { folder: file.folder, notes: value, previous },
      view: FileView,
    });
    if (result.error) {
      return { message: refusal(result.error).message, ok: false };
    }
    return { ok: true, saved: result.result?.current.items.clarifications?.notes ?? value };
  }, read);
  const { idle, settle } = save;
  const shown = useRef(text);
  useLayoutEffect(() => {
    shown.current = text;
  });
  useEffect(() => {
    if (idle() && read !== shown.current) {
      setText(read);
    }
    settle(read);
  }, [read, idle, settle]);
  /** Takes how to wait for the images being added. */
  const waitFor = useCallback((wait: () => Promise<void>) => {
    settled.current = wait;
  }, []);
  return { flush: () => settled.current().then(() => save.flush()), save, setText, text, waitFor };
}

/**
 * The round's notes as they are written: the page's main field, which takes the images dropped
 * with no field focused, as well as those pasted or picked, saved at once with their links.
 */
export function NotesField({
  notes,
  path,
}: {
  notes: ReturnType<typeof useRoundNotes>;
  path: string;
}) {
  const { save, setText, waitFor } = notes;
  const images = useImageText({
    label: "the notes",
    onText: (value: string, added: boolean) => {
      setText(value);
      save.schedule(value, added);
    },
    path,
    priority: 1,
    text: notes.text,
  });
  useEffect(() => {
    waitFor(images.settled);
  }, [waitFor, images.settled]);
  return (
    <>
      <VStack gap={2}>
        <DropHint hint={images.hint} isLabelled>
          <GrowingTextArea
            label="Notes"
            onChange={(value) => {
              setText(value);
              save.schedule(value);
            }}
            value={notes.text}
            {...images.fieldProps}
          />
        </DropHint>
        <AttachStatus status={images.status} />
        <HStack gap={2}>
          <AttachButton
            name="Add image to the notes"
            onFiles={(files) => void images.addFiles(files)}
          />
        </HStack>
      </VStack>
      {save.state.kind === "error" && (
        <span {...stylex.props(statusStyles.error)}>Not saved: {save.state.message}</span>
      )}
    </>
  );
}
