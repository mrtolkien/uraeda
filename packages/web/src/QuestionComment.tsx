import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { VStack } from "@astryxdesign/core/VStack";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
} from "react";
import { AttachButton } from "./attach/AttachButton.tsx";
import { AttachStatus } from "./attach/AttachStatus.tsx";
import { DropHint } from "./attach/DropHint.tsx";
import { takesImages, useImageText } from "./attach/useImageText.ts";
import { COMMENT_CHANGED } from "./CommentForm.tsx";
import { RestoreNotice } from "./fields/RestoreNotice.tsx";
import { SaveStatus } from "./fields/SaveStatus.tsx";
import { SaveKeys } from "./fields/SaveKeys.tsx";
import { TextField } from "./fields/TextField.tsx";
import { Paragraph } from "./layout/Paragraph.tsx";
import type { useAnswer } from "./useAnswer.ts";

const styles = stylex.create({
  actions: {
    marginBlockStart: spacingVars["--spacing-2"],
  },
  spaced: {
    marginBlockStart: spacingVars["--spacing-3"],
  },
});

/**
 * How a question's comment is saved by Submit, and by its images: `save` saves a comment at once,
 * as its button and an image added do, through `commit`; Submit waits for the images being added,
 * then saves the comment still unsaved, `unsaved()`, unless a save of it already runs, and waits
 * for the saves; `pending` holds what Submit waits for.
 */
export function useCommentSaves({
  commit,
  flush,
  pending,
  unsaved,
}: {
  /** Saves the answer with this comment after the saves before it: resolves with whether it did. */
  commit: (comment: string) => Promise<boolean>;
  flush: () => Promise<boolean>;
  pending: Set<() => Promise<boolean>>;
  /** The comment unsaved now, as the store holds it. */
  unsaved: () => string | undefined;
}) {
  // The comment handed to a save still running: Submit does not save it again meanwhile. Once
  // the save returns, written or refused, Submit saves the comment the store still holds.
  const committed = useRef<string | undefined>(undefined);
  const save = (comment: string) => {
    committed.current = comment;
    return commit(comment).finally(() => {
      if (committed.current === comment) {
        committed.current = undefined;
      }
    });
  };
  // What Submit does once it waited for the images, with the comment as the store holds it then.
  const saveUnsaved = useEffectEvent(() => {
    const text = unsaved();
    if (text !== undefined && text !== committed.current) {
      void save(text);
    }
  });
  // The images being added to the comment, which a submit waits for.
  const settled = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    const before = async () => {
      await settled.current();
      saveUnsaved();
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
  }, [pending, flush]);
  const onSettled = useCallback((wait: () => Promise<void>) => {
    settled.current = wait;
  }, []);
  return { onSettled, save };
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
 * `onSettled` takes how to wait for the images under way, as a submit does. Ctrl+Enter, or
 * Cmd+Enter, calls `onSubmit`, as its Save button does.
 */
export function CommentField({
  children,
  comment,
  id,
  onChange,
  onImages,
  onSettled,
  onSubmit,
  path,
}: {
  children: ReactNode;
  comment: string;
  id: string;
  onChange: (comment: string) => void;
  onImages: (comment: string, added: boolean) => void;
  onSettled: (settled: () => Promise<void>) => void;
  onSubmit: () => void;
  path: string;
}) {
  const takes = takesImages(path);
  const images = useImageText({
    label: `${id}'s comment`,
    path,
    takes,
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
          onSubmit={onSubmit}
          value={comment}
          {...images.fieldProps}
        />
      </DropHint>
      <AttachStatus status={images.status} />
      <HStack align="center" gap={2} wrap="wrap" xstyle={styles.actions}>
        {takes && (
          <AttachButton
            name={`Add image to ${id}'s comment`}
            onFiles={(files) => void images.addFiles(files)}
          />
        )}
        {children}
      </HStack>
    </>
  );
}

/**
 * A question's comment: its field, with "Save comment" and its status, and the notice of a
 * comment restored; once the round is answered, the comment `saved`, and the notice of a comment
 * left unsaved.
 */
export function AnswerComment({
  answer,
  id,
  path,
  readOnly,
  saved,
}: {
  answer: ReturnType<typeof useAnswer>;
  id: string;
  path: string;
  readOnly: boolean;
  saved: string;
}) {
  const { field } = answer;
  if (readOnly) {
    return (
      <>
        {field.entry && (
          <RestoreNotice
            answered
            changed={COMMENT_CHANGED}
            onDiscard={field.discard}
            restored={{ at: field.entry.at, changed: false }}
          />
        )}
        {saved && <Paragraph xstyle={styles.spaced}>{saved}</Paragraph>}
      </>
    );
  }
  return (
    <VStack gap={2} xstyle={styles.spaced}>
      {field.restored && (
        <RestoreNotice
          changed={COMMENT_CHANGED}
          onDiscard={field.discard}
          restored={field.restored}
        />
      )}
      <div>
        <CommentField
          comment={field.text}
          id={id}
          onChange={field.change}
          onImages={answer.onImages}
          onSettled={answer.onSettled}
          onSubmit={answer.saveComment}
          path={path}
        >
          <Button isDisabled={!field.dirty} label="Save comment" onClick={answer.saveComment} />
          <SaveStatus dirty={field.dirty} state={answer.state} />
          <SaveKeys />
        </CommentField>
      </div>
    </VStack>
  );
}
