// A note's images in the inbox: pasted in its field as it is edited in place, dropped on the page
// for the selected note, shown under its row while it is selected, and removed there with Undo.
// The core writes them, into the note's file, written for it when it has none (see
// `useAttachToNote`).
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { VStack } from "@astryxdesign/core/VStack";
import { borderVars, colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useRef } from "react";
import { useFateClient } from "react-fate";
import type { InboxNote } from "uraeda-binding";
import { AttachStatus } from "./attach/AttachStatus.tsx";
import { DropHint, dropStyles } from "./attach/DropHint.tsx";
import { useImageDrop } from "./attach/useImageDrop.ts";
import { ImageView } from "./ImageView.tsx";
import { imageName, removeNoteImage, restoreNoteImage } from "./inboxImages.ts";
import type { Inbox } from "./inboxPanes.ts";
import { useUndoToast } from "./layout/useUndoToast.ts";
import { OutlineImages } from "./lists/OutlineEditor.tsx";
import { useAttachToNote } from "./NoteImage.tsx";
import { repoPath, useRepository } from "./routes.tsx";
import { useOpenAddForm } from "./SidebarAdd.tsx";
import { imagePath } from "./Spans.tsx";

const styles = stylex.create({
  // Under the row, from its text's edge, over the rows after it: it pushes none of them. On a
  // surface of its own, framed as a popover is, over the next rows' links and `…` (z-index 2).
  float: {
    backgroundColor: colorVars["--color-background-card"],
    borderColor: colorVars["--color-border"],
    borderStyle: "solid",
    borderWidth: borderVars["--border-width"],
    insetBlockStart: "100%",
    insetInlineStart: "var(--card-gutter, 0px)",
    // Its widest, the row's width past the gutter, a custom property: the token lint takes a
    // `var()` only whole, not in a calc.
    "--note-images-width": "calc(100% - var(--card-gutter, 0px))",
    maxInlineSize: "var(--note-images-width)",
    padding: spacingVars["--spacing-2"],
    position: "absolute",
    zIndex: 3,
  },
  // The list's box, which the upload's status is placed against.
  zone: { position: "relative" },
  // "Adding <name>…", over the list's top end, just above it: it moves no row as it comes and goes.
  status: {
    insetBlockEnd: "100%",
    insetInlineEnd: 0,
    position: "absolute",
  },
});

/**
 * A note's images, each a preview that opens full size, with its Remove under it, floating under
 * the note's row. `onRemove` takes one out of the note's file.
 */
export function NoteImages({
  note,
  onRemove,
}: {
  note: InboxNote;
  onRemove: (path: string) => void;
}) {
  const repo = useRepository();
  const shown = note.images.flatMap((path) => {
    const src = imagePath(path);
    return src ? [{ path, src: repoPath(repo, src) }] : [];
  });
  if (shown.length === 0) {
    return null;
  }
  return (
    <div aria-label="The note's images" role="group" {...stylex.props(styles.float)}>
      <HStack gap={2} wrap="wrap">
        {shown.map(({ path, src }) => (
          <VStack gap={1} hAlign="center" key={path}>
            <ImageView alt={imageName(path)} size="note" src={src} />
            <Button
              icon={<Icon icon="close" />}
              isIconOnly
              label={`Remove ${imageName(path)}`}
              onClick={() => onRemove(path)}
              size="sm"
              variant="ghost"
            />
          </VStack>
        ))}
      </HStack>
    </div>
  );
}

/** What the inbox's list hands the images: its writes in turn, and its rows as drawn. */
type Outline = {
  drawn: {
    sections: ReadonlyArray<{
      id: string;
      items: ReadonlyArray<{
        children: ReadonlyArray<{ key: string }>;
        key: string;
        source?: InboxNote | undefined;
      }>;
    }>;
  };
  write: (call: (now: Inbox) => Promise<string | undefined>) => Promise<boolean>;
};

/** The note of the row `key`, a nested row's being its note's. */
function noteOfRow(outline: Outline, key: string) {
  for (const section of outline.drawn.sections) {
    for (const item of section.items) {
      if (item.key === key || item.children.some((child) => child.key === key)) {
        return item.source;
      }
    }
  }
  return undefined;
}

/**
 * The images of the inbox's notes: `imagesOf` draws a note's under its row, `withPaste` gives a
 * row's field the paste of images into its note, and `dropZone` takes the files dropped on the page
 * for the selected note (`onSelected` hears it), or, with none, for a new note: the add form opens
 * with them, in the category of an Add row selected. A refusal goes to `onRefused`.
 */
export function useInboxImages({
  categoryOf,
  inbox,
  onRefused,
  outline,
}: {
  categoryOf: (section: string) => string | undefined;
  inbox: Inbox;
  onRefused: (message: string | undefined) => void;
  outline: Outline;
}) {
  const fate = useFateClient();
  const toast = useUndoToast();
  const openForm = useOpenAddForm();
  const { attach, status } = useAttachToNote();
  const box = useRef<HTMLDivElement>(null);
  const selected = useRef<string | undefined>(undefined);

  /**
   * Adds `files` to `note`: after the writes asked before, as the text its field just saved, when
   * `isAfterWrites`, or when its line will link the note file written for it; at once into the
   * note file it links, which leaves `INBOX.md` as it is.
   */
  const toNote = (note: InboxNote, files: Array<File>, isAfterWrites: boolean) => {
    const call = (now: Pick<Inbox, "hash">) => attach({ hash: now.hash, id: note.id }, files);
    if (isAfterWrites || note.file === undefined) {
      void outline.write(call);
    } else {
      void call(inbox).then((failed) => failed !== undefined && onRefused(failed));
    }
  };

  const onDrop = (files: Array<File>) => {
    const key = selected.current;
    const note = key === undefined ? undefined : noteOfRow(outline, key);
    if (!note) {
      const section = key?.startsWith("add:") ? key.slice("add:".length) : undefined;
      openForm("note", {
        images: files,
        ...(section === undefined ? {} : { category: categoryOf(section) ?? null }),
      });
      return;
    }
    // A row's field open with its text: left, which saves the text before the images go.
    const active = document.activeElement as HTMLElement | null;
    const isEditing = active?.tagName === "TEXTAREA" && box.current?.contains(active) === true;
    if (isEditing) {
      active?.blur();
    }
    toNote(note, files, isEditing);
  };
  const drop = useImageDrop({
    label: "the selected note, or a new one",
    onFiles: onDrop,
    priority: 0,
    ref: box,
  });

  const remove = async (note: InboxNote, path: string) => {
    const removed = await removeNoteImage(fate, note, path);
    if (typeof removed === "string") {
      onRefused(removed);
      return;
    }
    toast(`Removed ${imageName(path)} from the note's file`, () => restoreNoteImage(fate, removed));
  };

  return {
    /** Wraps the list: the drop's zone, outlined while it is the drop's target. */
    dropZone: (children: ReactNode) => (
      <DropHint hint={drop.hint}>
        <div ref={box} {...stylex.props(styles.zone, drop.isTarget && dropStyles.target)}>
          <div {...stylex.props(styles.status)}>
            <AttachStatus status={status} />
          </div>
          {children}
        </div>
      </DropHint>
    ),
    /** A note's images under its row, if it has any. */
    imagesOf: (note: InboxNote) =>
      note.images.length > 0 ? (
        <NoteImages note={note} onRemove={(path) => void remove(note, path)} />
      ) : undefined,
    onSelected: (key: string | undefined) => {
      selected.current = key;
    },
    /** A row's field, whose pasted images go to `note` once its text is saved. */
    withPaste:
      (note: InboxNote) =>
      (editor: ReactNode): ReactNode => (
        <OutlineImages value={(files) => toNote(note, files, true)}>{editor}</OutlineImages>
      ),
  };
}
