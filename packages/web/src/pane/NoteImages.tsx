import { HStack } from "@astryxdesign/core/HStack";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { useRef } from "react";
import { useFateClient } from "react-fate";
import type { InboxNote } from "uraeda-binding";
import { AttachButton } from "../attach/AttachButton.tsx";
import { AttachStatus } from "../attach/AttachStatus.tsx";
import { DropHint, dropStyles } from "../attach/DropHint.tsx";
import { useImageDrop } from "../attach/useImageDrop.ts";
import { ImageView } from "../ImageView.tsx";
import { noteOfDraft, useAttachToNote } from "../NoteImage.tsx";
import { redirect, repoPath, useRepoPath, useRepository } from "../routes.tsx";
import { imagePath } from "../Spans.tsx";

/** An image's name, without its folders and extension: its alt text. */
function altOf(path: string) {
  return (path.split("/").at(-1) ?? path).replace(/\.[^.]*$/, "");
}

/**
 * A note's images, in the order its draft links them, drawn under its text, and "Add images" for
 * more: picked, or dropped on the page. A note with no draft becomes one as it takes its first
 * images, and the pane follows it to its new address.
 */
export function NoteImages({ hash, note }: { hash: string; note: InboxNote }) {
  const fate = useFateClient();
  const here = useRepoPath();
  const repo = useRepository();
  const box = useRef<HTMLDivElement>(null);
  const { attach, status } = useAttachToNote();

  const add = async (files: Array<File>) => {
    const draft = await attach({ hash, id: note.id }, files);
    if (draft === undefined) {
      return;
    }
    const added = await noteOfDraft(fate, draft);
    if (added) {
      redirect(here(`/inbox/${added.key}`));
    }
  };
  const drop = useImageDrop({
    label: "the note",
    onFiles: (files) => void add(files),
    priority: 1,
    ref: box,
  });

  return (
    <DropHint hint={drop.hint}>
      <div ref={box} {...stylex.props(drop.isTarget && dropStyles.target)}>
        <VStack gap={2}>
          <HStack align="center" gap={2}>
            <AttachButton multiple onFiles={(files) => void add(files)} />
          </HStack>
          <AttachStatus status={status} />
          {note.images.map((path) => {
            const src = imagePath(path);
            return src && <ImageView alt={altOf(path)} key={path} src={repoPath(repo, src)} />;
          })}
        </VStack>
      </div>
    </DropHint>
  );
}
