// A group's commit message on the Git page, and its Commit under it, where the eye ends after
// typing: the shared editor, filled with the message the commit takes by default, from what is
// staged, until something else is typed. Typed text stays unsaved until its commit lands, kept on a
// refusal for the next try, and marked as unsaved. One line, as a commit's subject: Enter in it
// commits what is staged, as Commit does, whose button shows the key on wide screens.
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import type { Ref } from "react";
import type { EditorHandle } from "../fields/editor/Editor.tsx";
import { RestoreNotice } from "../fields/RestoreNotice.tsx";
import { TextLine } from "../fields/TextLine.tsx";
import { useTextField } from "../fields/useTextField.ts";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { WriteButton } from "../writes/WriteButton.tsx";
import type { GitGroup } from "./data.ts";
import { messageField } from "./useGitWrites.ts";

/** What Commit says: the files it commits, "Commit 2 files", or "Commit" while none is staged. */
export function commitLabel(staged: number): string {
  if (staged === 0) {
    return "Commit";
  }
  return staged === 1 ? "Commit 1 file" : `Commit ${staged} files`;
}

export function CommitField({
  group,
  isDisabled,
  isPrimary,
  onCommit,
  ref,
  staged,
}: {
  group: GitGroup;
  isDisabled: boolean;
  /** The main checkout's Commit is the page's primary action; a worktree's is secondary. */
  isPrimary: boolean;
  onCommit: () => Promise<unknown>;
  ref?: Ref<EditorHandle> | undefined;
  /** How many files are staged: none disables Commit. */
  staged: number;
}) {
  const offered = group.defaultMessage ?? "";
  const field = useTextField(messageField(group.folder), offered);
  const narrow = isNarrow(useWidthClass());
  const commit = () => void onCommit();
  return (
    <VStack gap={2}>
      {field.restored && (
        <RestoreNotice changed="" onDiscard={field.discard} restored={field.restored} />
      )}
      <TextLine
        isDisabled={isDisabled}
        label="Message"
        onChange={field.change}
        onEnter={commit}
        onSubmit={commit}
        ref={ref}
        value={field.text}
      />
      <HStack align="center" gap={2} wrap="wrap">
        <WriteButton
          // Its key, as the New page's Start shows its own: the phone has no such key.
          endContent={!narrow && <Icon aria-hidden="true" icon="uraeda:enter" label="Enter" />}
          isDisabled={isDisabled || staged === 0}
          label={commitLabel(staged)}
          onClick={onCommit}
          {...(staged === 0 ? { tooltip: "Tick a file to commit it" } : {})}
          variant={isPrimary ? "primary" : "secondary"}
        />
        {field.dirty && (
          <>
            <Button
              label={offered ? "Use the default message" : "Clear the message"}
              onClick={field.discard}
              variant="ghost"
            />
            <Text color="secondary" type="supporting">
              Unsaved message
            </Text>
          </>
        )}
      </HStack>
    </VStack>
  );
}
