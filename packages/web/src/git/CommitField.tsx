// A group's commit message on the Git page: the shared editor, empty until typed, its text unsaved
// until its commit lands, kept on a refusal for the next try, and marked as unsaved. Ctrl+Enter, or
// Cmd+Enter, commits what is staged, as the pane's Commit does.
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import type { Ref } from "react";
import type { EditorHandle } from "../fields/editor/Editor.tsx";
import { RestoreNotice } from "../fields/RestoreNotice.tsx";
import { TextField } from "../fields/TextField.tsx";
import { useTextField } from "../fields/useTextField.ts";
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
  const field = useTextField(messageField(group.folder), "");
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
        onSubmit={() => void onCommit()}
        ref={ref}
        value={field.text}
      />
      {field.dirty && (
        <HStack align="center" gap={2} wrap="wrap">
          <Button label="Clear the message" onClick={field.discard} variant="ghost" />
          <Text color="secondary" type="supporting">
            Unsaved message
          </Text>
        </HStack>
      )}
    </VStack>
  );
}
