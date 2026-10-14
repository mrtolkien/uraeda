import { HStack } from "@astryxdesign/core/HStack";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, type RefObject, useCallback, useEffect, useRef } from "react";
import { AttachButton } from "./attach/AttachButton.tsx";
import { AttachStatus } from "./attach/AttachStatus.tsx";
import { DropHint } from "./attach/DropHint.tsx";
import { useImageText } from "./attach/useImageText.ts";
import { TextField } from "./fields/TextField.tsx";

const styles = stylex.create({
  actions: {
    marginBlockStart: spacingVars["--spacing-2"],
  },
});

/** An answer: its letters, and its comment. */
type Answer = { comment: string; letters: ReadonlyArray<string> };

/**
 * How a question's answer is saved, with its comment's images: at once with their links, as a file
 * with images is, and by Submit, which saves a comment still being written first, its images
 * added. The answer as shown is `local`; `pending` holds what Submit waits for.
 */
export function useCommentSaves({
  flush,
  initial,
  local,
  pending,
  schedule,
  setComment,
}: {
  flush: () => Promise<boolean>;
  initial: string;
  local: RefObject<Answer & { dirty: boolean }>;
  pending: Set<() => Promise<boolean>>;
  schedule: (value: Answer, immediately?: boolean) => void;
  setComment: (comment: string) => void;
}) {
  // The comment last handed to a save: Submit does not save it again while that save runs.
  const committed = useRef(initial);
  /** Saves the answer at once, with the comment as typed. */
  const commit = useCallback(
    (value: Answer) => {
      committed.current = value.comment;
      schedule(value, true);
    },
    [schedule],
  );
  // The images being added to the comment, which a submit waits for.
  const settled = useRef<() => Promise<void>>(async () => {});
  const onImages = useCallback(
    (value: string, added: boolean) => {
      setComment(value);
      remember(local, value);
      if (added) {
        commit({ comment: value, letters: local.current.letters });
      }
    },
    [commit, local, setComment],
  );
  useEffect(() => {
    const before = async () => {
      await settled.current();
      if (local.current.dirty && local.current.comment !== committed.current) {
        commit({ comment: local.current.comment, letters: local.current.letters });
      }
      return flush();
    };
    pending.add(before);
    return () => {
      pending.delete(before);
      // A follow-up that stops applying during an upload still saves the image's link once it is
      // added: Submit waits for it, or the commit would delete the image (R74).
      const after = afterRemoval(settled, flush);
      pending.add(after);
      void after().finally(() => pending.delete(after));
    };
  }, [pending, flush, commit, local]);
  const onSettled = useCallback((wait: () => Promise<void>) => {
    settled.current = wait;
  }, []);
  return { commit, onImages, onSettled };
}

/** Takes a comment as the answer's at once, before it is drawn: Submit may read it first. */
function remember(local: RefObject<Answer & { dirty: boolean }>, comment: string) {
  local.current = { ...local.current, comment };
}

/** What Submit waits for of a question gone: its images, then its last save. */
function afterRemoval(settled: RefObject<() => Promise<void>>, flush: () => Promise<boolean>) {
  return async () => {
    await settled.current();
    return flush();
  };
}

/**
 * A question's comment as it is written: it takes images pasted, dropped while it has the focus,
 * or picked with "Add image". `onImages` takes the text once they are added, to save at once.
 * `onSettled` takes how to wait for the images under way, as a submit does.
 */
export function CommentField({
  children,
  comment,
  id,
  onChange,
  onImages,
  onSettled,
  path,
}: {
  children: ReactNode;
  comment: string;
  id: string;
  onChange: (comment: string) => void;
  onImages: (comment: string, added: boolean) => void;
  onSettled: (settled: () => Promise<void>) => void;
  path: string;
}) {
  const images = useImageText({
    label: `${id}'s comment`,
    path,
    text: comment,
    // The notes take a drop with no field focused: a comment takes it only while focused.
    onText: onImages,
    priority: 0,
  });
  useEffect(() => {
    onSettled(images.settled);
  }, [onSettled, images.settled]);
  return (
    <>
      <DropHint hint={images.hint} isLabelled>
        <TextField
          kind="comment"
          label="Comment"
          onChange={onChange}
          value={comment}
          {...images.fieldProps}
        />
      </DropHint>
      <AttachStatus status={images.status} />
      <HStack align="center" gap={2} wrap="wrap" xstyle={styles.actions}>
        <AttachButton
          name={`Add image to ${id}'s comment`}
          onFiles={(files) => void images.addFiles(files)}
        />
        {children}
      </HStack>
    </>
  );
}
