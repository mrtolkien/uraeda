// A group's commit message on the Git page: the shared editor, filled with the message the commit
// takes by default, from what is staged, until something else is typed. Typed text stays unsaved
// until its commit lands, kept on a refusal for the next try, and marked as unsaved. One line, as a
// commit's subject: Enter commits what is staged, as the pane's Commit does, which the line under the
// field says while it has the focus, the only time Enter is its; the line keeps its room otherwise,
// so nothing moves as the focus comes and goes. The phone hints no key: Commit staged is the tap.
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { type Ref, useState } from "react";
import type { EditorHandle } from "../fields/editor/Editor.tsx";
import { RestoreNotice } from "../fields/RestoreNotice.tsx";
import { TextLine } from "../fields/TextLine.tsx";
import { useTextField } from "../fields/useTextField.ts";
import { KeyCap } from "../keys/KeyCap.tsx";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import type { GitGroup } from "./data.ts";
import { messageField } from "./useGitWrites.ts";

const styles = stylex.create({
  hidden: { visibility: "hidden" },
});

export function CommitField({
  group,
  isDisabled,
  onCommit,
  ref,
}: {
  group: GitGroup;
  isDisabled: boolean;
  onCommit: () => Promise<unknown>;
  ref?: Ref<EditorHandle> | undefined;
}) {
  const offered = group.defaultMessage ?? "";
  const field = useTextField(messageField(group.folder), offered);
  const commit = () => void onCommit();
  const [isFocused, setFocused] = useState(false);
  const narrow = isNarrow(useWidthClass());
  return (
    <VStack gap={2}>
      {field.restored && (
        <RestoreNotice changed="" onDiscard={field.discard} restored={field.restored} />
      )}
      <TextLine
        isDisabled={isDisabled}
        label="Message"
        onBlur={() => setFocused(false)}
        onChange={field.change}
        onEnter={commit}
        onFocus={() => setFocused(true)}
        onSubmit={commit}
        ref={ref}
        value={field.text}
      />
      {!narrow && (
        <div aria-hidden={!isFocused} {...stylex.props(!isFocused && styles.hidden)}>
          <Text color="secondary" type="supporting">
            <KeyCap>⏎</KeyCap> commits what is staged
          </Text>
        </div>
      )}
      {field.dirty && (
        <HStack align="center" gap={2} wrap="wrap">
          <Button
            label={offered ? "Use the default message" : "Clear the message"}
            onClick={field.discard}
            variant="ghost"
          />
          <Text color="secondary" type="supporting">
            Unsaved message
          </Text>
        </HStack>
      )}
    </VStack>
  );
}
