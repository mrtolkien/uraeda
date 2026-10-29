// A proposal's save refused as the file changed elsewhere: the editor page's banner, with the text
// to copy and the new version to load.
import { Button } from "@astryxdesign/core/Button";
import { VStack } from "@astryxdesign/core/VStack";
import { AnnouncedBanner } from "../layout/AnnouncedBanner.tsx";
import type { ProposalEditorState } from "./useProposalEditor.ts";

/** A save refused as the file changed elsewhere: the text to copy, or the new version to load. */
export function ConflictBanner({ editor }: { editor: ProposalEditorState }) {
  if (!editor.conflict) {
    return null;
  }
  return (
    <AnnouncedBanner
      collapsible={false}
      description={
        <VStack gap={2}>
          <Button
            label="Copy my text"
            onClick={() => void navigator.clipboard?.writeText(editor.field.text)}
          />
          <Button clickAction={editor.reload} label="Load the new version" />
        </VStack>
      }
      status="error"
      title={editor.conflict}
    />
  );
}
