import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useState } from "react";
import { AttachButton } from "./attach/AttachButton.tsx";
import { AttachStatus } from "./attach/AttachStatus.tsx";
import { DropHint } from "./attach/DropHint.tsx";
import type { useImageText } from "./attach/useImageText.ts";
import { useConfirm } from "./fields/Confirm.tsx";
import { RestoreNotice } from "./fields/RestoreNotice.tsx";
import { TextField } from "./fields/TextField.tsx";
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

/** What Cancel asks on a comment whose text changed. */
export const DISCARD_COMMENT = {
  body: "The text you typed is deleted.",
  cancel: "Keep editing",
  confirm: "Discard",
  title: "Discard your comment?",
};

/** What the restore notice adds when the comment changed since its unsaved text was typed. */
const COMMENT_CHANGED = "The comment changed since: saving replaces it.";

/** What every comment form takes, wherever its text is kept. */
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

/** A form whose text its page holds, `text` and `onTextChange`, or the form itself. */
type Held = Shared & {
  field?: undefined;
  initial?: string;
  onTextChange?: (text: string) => void;
  text?: string;
};

/**
 * A form whose text is a field of the unsaved store, `field` its key, over `saved`, the comment's
 * text as the file holds it, empty for a new one.
 */
type Stored = Shared & { field: string; saved?: string };

/**
 * A comment being written: where it goes, the start of what it comments on, its text, Cancel, and
 * the button that sends it. With `field`, its text is kept in the unsaved store by that key, so it
 * survives the form moving and a reload, restored with a notice; "Unsaved changes" shows while it
 * differs from `saved`, and Cancel asks "Discard your comment?" first. Without, `text` and
 * `onTextChange` hold the text outside the form, as the review and the mockup page do. Shared by
 * the review, the mockup page, and the settled points.
 */
export function CommentForm(props: Held | Stored) {
  return props.field === undefined ? <HeldForm {...props} /> : <StoredForm {...props} />;
}

function HeldForm({ initial = "", onTextChange, text: held, ...shared }: Held) {
  const [own, setOwn] = useState(initial);
  return <CommentFields {...shared} onChange={onTextChange ?? setOwn} text={held ?? own} />;
}

function StoredForm({ field: key, onCancel, onSubmit, saved = "", ...shared }: Stored) {
  const field = useTextField(key, saved);
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

/** The form itself, on a text it is given; with `dirty`, its button waits for a change. */
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
  dirty?: boolean;
  onChange: (text: string) => void;
  restored?: ReactNode;
  text: string;
}) {
  const [error, setError] = useState<string>();
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
              value={text}
              {...images.fieldProps}
            />
          </DropHint>
        ) : (
          <TextField kind="comment" label="Comment text" onChange={onChange} value={text} />
        )}
        {images && <AttachStatus status={images.status} />}
        {(error ?? notice) && <span {...stylex.props(statusStyles.error)}>{error ?? notice}</span>}
        <HStack align="center" gap={2} justify="end" wrap="wrap">
          {dirty && (
            <Text color="secondary" type="supporting">
              Unsaved changes
            </Text>
          )}
          {images && <AttachButton onFiles={(files) => void images.addFiles(files)} />}
          {action}
          <Button label="Cancel" onClick={onCancel} />
          <Button
            clickAction={async () => setError(await onSubmit(text))}
            isDisabled={!text.trim() || images?.busy || dirty === false}
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
