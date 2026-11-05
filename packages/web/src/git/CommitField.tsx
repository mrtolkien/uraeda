// A group's commit message on the Git page: the shared editor, filled with the message the commit
// takes by default, from what is staged, until something else is typed. Typed text stays unsaved
// until its commit lands, kept on a refusal for the next try, and marked as unsaved. Enter commits
// what is staged, as the pane's Commit does, and Shift+Enter adds a line for a body: the line under
// the field says so, as a key is never one to guess, but on the phone, which hints no key.
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import type { Ref } from "react";
import type { EditorHandle } from "../fields/editor/Editor.tsx";
import { RestoreNotice } from "../fields/RestoreNotice.tsx";
import { TextField } from "../fields/TextField.tsx";
import { useTextField } from "../fields/useTextField.ts";
import { KeyCap } from "../keys/KeyCap.tsx";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import type { GitGroup } from "./data.ts";
import { messageField } from "./useGitWrites.ts";

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
  // The phone hints no key: its keyboard has no Shift+Enter, and Commit staged is the tap.
  const narrow = isNarrow(useWidthClass());
  return (
    <VStack gap={2}>
      {field.restored && (
        <RestoreNotice changed="" onDiscard={field.discard} restored={field.restored} />
      )}
      <TextField
        isDisabled={isDisabled}
        kind="line"
        label="Message"
        onChange={field.change}
        onEnter={commit}
        onSubmit={commit}
        ref={ref}
        value={field.text}
      />
      {!narrow && (
        <Text color="secondary" type="supporting">
          <KeyCap>Enter</KeyCap> commits what is staged, <KeyCap>Shift+Enter</KeyCap> adds a line
        </Text>
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
