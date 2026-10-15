import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useRef, useState } from "react";
import { AttachButton } from "./attach/AttachButton.tsx";
import { AttachStatus } from "./attach/AttachStatus.tsx";
import { DropHint } from "./attach/DropHint.tsx";
import type { useImageText } from "./attach/useImageText.ts";
import { type ConfirmOptions, useConfirm } from "./fields/Confirm.tsx";
import { RestoreNotice } from "./fields/RestoreNotice.tsx";
import { SaveStatus } from "./fields/SaveStatus.tsx";
import { TextField } from "./fields/TextField.tsx";
import type { Unsaved } from "./fields/unsaved.ts";
import { useTextField } from "./fields/useTextField.ts";
import { statusStyles } from "./Question.tsx";

/** A comment field's images: the `useImageText` of the text the form holds. */
export type CommentImages = ReturnType<typeof useImageText>;

const styles = stylex.create({
  form: {
    margin: 0,
  },
  quote: {
    // The commented lines, quoted with the selection's bar.
    borderInlineStartColor: "var(--color-selection-edge)",
    borderInlineStartStyle: "solid",
    borderInlineStartWidth: spacingVars["--spacing-1"],
    display: "block",
    overflowWrap: "anywhere",
    paddingInlineStart: spacingVars["--spacing-3"],
  },
});

/**
 * A comment form's status: "Unsaved changes" alone, in the room `SaveStatus` keeps for it, so the
 * first letter typed moves none of the form's buttons; the form says its error itself.
 */
const IDLE = { kind: "idle" } as const;

/** What Cancel asks on a comment whose text changed. */
export const DISCARD_COMMENT: ConfirmOptions = {
  body: "The text you typed is deleted.",
  cancel: "Keep editing",
  confirm: "Discard",
  destructive: true,
  title: "Discard your comment?",
};

/** What the restore notice adds when the comment changed since its unsaved text was typed. */
export const COMMENT_CHANGED = "The comment changed since: saving replaces it.";

/** What every comment form takes. */
type Shared = {
  /** A button before Cancel. */
  action?: ReactNode;
  /** Where the comment goes, above its field. */
  anchor: string;
  /** The field's images, pasted, dropped, or picked with "Add image", the first button. */
  images?: CommentImages;
  /** An error about the comment from outside it, like a verdict refused while it is open. */
  notice?: string;
  onCancel: () => void;
  /** Resolves with nothing once the comment is written, or with the error to show, the text kept. */
  onSubmit: (text: string) => Promise<string | undefined>;
  quote?: string;
  submitLabel?: string;
};

/**
 * A comment being written: where it goes, the start of what it comments on, its text, Cancel, and
 * the button that sends it. Its text is a field of the unsaved store, `field` its key, over
 * `saved`, the comment's text as the file holds it, empty for a new one, with `extra`, a review
 * comment's lines, or `subject`, a settled comment's: it survives the form moving and a reload, restored with a notice; "Unsaved
 * changes" shows while it differs from `saved`, its button waits for a change, Ctrl+Enter or
 * Cmd+Enter sends it as its button does, and Cancel asks "Discard your comment?" first. Shared by
 * the review, the mockup page, and the settled points.
 */
export function CommentForm({
  extra,
  field: key,
  onCancel,
  onSubmit,
  saved = "",
  subject,
  ...shared
}: Shared & { extra?: Unsaved["extra"]; field: string; saved?: string; subject?: string }) {
  const field = useTextField(key, saved, { extra, subject });
  const confirm = useConfirm();
  const cancel = async () => {
    if (field.dirty && !(await confirm(DISCARD_COMMENT))) {
      return;
    }
    field.discard();
    onCancel();
  };
  const submit = async (text: string) => {
    const error = await onSubmit(text);
    if (error === undefined) {
      field.saved(text);
    }
    return error;
  };
  return (
    <CommentFields
      {...shared}
      dirty={field.dirty}
      onCancel={() => void cancel()}
      onChange={field.change}
      onSubmit={submit}
      restored={
        field.restored && (
          <RestoreNotice
            changed={COMMENT_CHANGED}
            onDiscard={field.discard}
            restored={field.restored}
          />
        )
      }
      text={field.text}
    />
  );
}

/** The form itself, on the text its field holds: its button waits for a change. */
function CommentFields({
  action,
  anchor,
  dirty,
  images,
  notice,
  onCancel,
  onChange,
  onSubmit,
  quote,
  restored,
  submitLabel = "Add comment",
  text,
}: Shared & {
  dirty: boolean;
  onChange: (text: string) => void;
  restored?: ReactNode;
  text: string;
}) {
  const [error, setError] = useState<string>();
  const canSubmit = text.trim() !== "" && !images?.busy && dirty;
  // The button and Ctrl+Enter, or Cmd+Enter, send the comment once: not again while it is being
  // sent, by either, nor when the button is disabled.
  const [sending, setSending] = useState(false);
  const inFlight = useRef(false);
  const submit = async () => {
    if (!canSubmit || inFlight.current) {
      return;
    }
    inFlight.current = true;
    setSending(true);
    try {
      setError(await onSubmit(text));
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  };
  const submitKey = () => void submit();
  return (
    <form
      aria-label="Comment"
      onSubmit={(event) => event.preventDefault()}
      {...stylex.props(styles.form)}
    >
      <VStack gap={2}>
        {restored}
        <Text color="secondary" type="supporting">
          {anchor}
        </Text>
        {quote && (
          <div {...stylex.props(styles.quote)}>
            <Text type="supporting">{quote}</Text>
          </div>
        )}
        {images ? (
          <DropHint hint={images.hint} isLabelled>
            <TextField
              kind="comment"
              label="Comment text"
              onChange={onChange}
              onSubmit={submitKey}
              value={text}
              {...images.fieldProps}
            />
          </DropHint>
        ) : (
          <TextField
            kind="comment"
            label="Comment text"
            onChange={onChange}
            onSubmit={submitKey}
            value={text}
          />
        )}
        {images && <AttachStatus status={images.status} />}
        {(error ?? notice) && <span {...stylex.props(statusStyles.error)}>{error ?? notice}</span>}
        <HStack align="center" gap={2} justify="end" wrap="wrap">
          <SaveStatus dirty={dirty} state={IDLE} />
          {images && <AttachButton onFiles={(files) => void images.addFiles(files)} />}
          {action}
          <Button label="Cancel" onClick={onCancel} />
          <Button
            clickAction={submit}
            isDisabled={!canSubmit || sending}
            label={submitLabel}
            variant="primary"
          />
        </HStack>
      </VStack>
    </form>
  );
}

/** The start of a commented text: its first 120 characters or so, cut at a word. */
export function quoteOf(text: string) {
  const flat = text.replaceAll(/\s+/g, " ").trim();
  if (flat.length <= 120) {
    return flat;
  }
  const cut = flat.slice(0, 120);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 60 ? cut.lastIndexOf(" ") : 120)}…`;
}
