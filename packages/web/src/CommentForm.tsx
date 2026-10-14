import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useState } from "react";
import { GrowingTextArea, statusStyles } from "./Question.tsx";

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
 * A comment being written: where it goes, the start of what it comments on, its text, Cancel, and
 * the button that sends it. `onSubmit` resolves with nothing once the comment is written, or with
 * the error to show, the text kept. `text` and `onTextChange` hold the text outside the form, so
 * it survives the form moving. `action` goes before Cancel. Shared by the review and the mockup
 * page.
 */
export function CommentForm({
  action,
  anchor,
  initial = "",
  onCancel,
  onSubmit,
  onTextChange,
  quote,
  submitLabel = "Add comment",
  text: held,
}: {
  action?: ReactNode;
  anchor: string;
  initial?: string;
  onCancel: () => void;
  onSubmit: (text: string) => Promise<string | undefined>;
  onTextChange?: (text: string) => void;
  quote?: string;
  submitLabel?: string;
  text?: string;
}) {
  const [own, setOwn] = useState(initial);
  const text = held ?? own;
  const setText = onTextChange ?? setOwn;
  const [error, setError] = useState<string>();
  return (
    <form
      aria-label="Comment"
      onSubmit={(event) => event.preventDefault()}
      {...stylex.props(styles.form)}
    >
      <VStack gap={2}>
        <Text color="secondary" type="supporting">
          {anchor}
        </Text>
        {quote && (
          <div {...stylex.props(styles.quote)}>
            <Text type="supporting">{quote}</Text>
          </div>
        )}
        <GrowingTextArea label="Comment text" onChange={setText} value={text} />
        {error && <span {...stylex.props(statusStyles.error)}>{error}</span>}
        <HStack gap={2} justify="end" wrap="wrap">
          {action}
          <Button label="Cancel" onClick={onCancel} />
          <Button
            clickAction={async () => setError(await onSubmit(text))}
            isDisabled={!text.trim()}
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
