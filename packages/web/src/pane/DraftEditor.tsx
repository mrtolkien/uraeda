// A draft's text, drawn or edited, with its save, its conflict, and its images: the editor page's,
// and the one an entry's pane opens with Edit (C2), on the same unsaved text.
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { AttachButton } from "../attach/AttachButton.tsx";
import { AttachStatus } from "../attach/AttachStatus.tsx";
import { DropHint } from "../attach/DropHint.tsx";
import { Blocks } from "../Blocks.tsx";
import { MAIN_CHECKOUT, type useDraft, useProposalHints } from "../data.ts";
import { RestoreNotice } from "../fields/RestoreNotice.tsx";
import { SaveKeys } from "../fields/SaveKeys.tsx";
import { SaveStatus } from "../fields/SaveStatus.tsx";
import { TextField } from "../fields/TextField.tsx";
import { Paragraph } from "../layout/Paragraph.tsx";
import { StoriesProvider } from "../stories.tsx";
import type { DraftEditorState } from "./useDraftEditor.ts";

type Draft = NonNullable<ReturnType<typeof useDraft>>;
type Hints = ReturnType<typeof useProposalHints>;

/** What the notice says when the file changed since its unsaved text was typed. */
const EDITOR_CHANGED = "The file changed since: saving replaces it.";

/** A save refused as the file changed elsewhere: the text to copy, or the new version to load. */
export function ConflictBanner({ editor }: { editor: DraftEditorState }) {
  if (!editor.conflict) {
    return null;
  }
  return (
    <Banner
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

/** The template's guidance for each section the draft leaves empty. */
function SectionHints({ draft, hints }: { draft: Draft; hints: Hints }) {
  const shown = hints.filter((hint) => draft.emptySections.includes(hint.heading));
  if (shown.length === 0) {
    return null;
  }
  return (
    <VStack gap={1}>
      <Text color="secondary" type="supporting">
        To write in the empty sections:
      </Text>
      {shown.map((hint) => (
        <Paragraph color="secondary" key={hint.heading}>
          <Text color="secondary" weight="semibold">
            {hint.heading}
          </Text>
          {" · "}
          <Text color="secondary">{hint.hint}</Text>
        </Paragraph>
      ))}
    </VStack>
  );
}

/**
 * The draft drawn, or its text to edit, which takes images, with the empty sections' guidance; its
 * unsaved text restored, and Save, or Ctrl+Enter, with what it did.
 */
export function EditorText({ draft, editor }: { draft: Draft; editor: DraftEditorState }) {
  const hints = useProposalHints();
  const { field, images } = editor;
  // The title is the page's heading, or the pane's line, already.
  const ids = draft.document.blocks
    .filter(
      (block) => block.parent === undefined && !(block.kind === "heading" && block.level === 1),
    )
    .map((block) => block.id);
  return (
    <VStack gap={2}>
      {field.restored && (
        <RestoreNotice
          changed={EDITOR_CHANGED}
          onDiscard={field.discard}
          restored={field.restored}
        />
      )}
      {editor.drawn ? (
        <DropHint hint={images.hint}>
          <StoriesProvider folder={MAIN_CHECKOUT} stories={draft.stories}>
            <Blocks document={draft.document} ids={ids} />
          </StoriesProvider>
        </DropHint>
      ) : (
        <>
          <DropHint hint={images.hint}>
            <TextField
              isLabelHidden
              kind="editor"
              label="Text"
              onChange={field.change}
              onSubmit={editor.saveText}
              value={field.text}
              {...images.fieldProps}
            />
          </DropHint>
          <AttachStatus status={images.status} />
          <SectionHints draft={draft} hints={hints} />
        </>
      )}
      <HStack align="center" gap={2} wrap="wrap">
        <Button isDisabled={!field.dirty} label="Save" onClick={editor.saveText} />
        <SaveStatus dirty={field.dirty} state={editor.state} />
        <SaveKeys />
      </HStack>
    </VStack>
  );
}

/**
 * A draft's text in an entry's pane, to edit: its conflict, its text with Save, then Commit and
 * "Attach an image", as on the editor page. What Commit did shows with the pane's other results.
 */
export function DraftEditor({ draft, editor }: { draft: Draft; editor: DraftEditorState }) {
  const changes = draft.priorityChanges;
  return (
    <VStack gap={3}>
      <ConflictBanner editor={editor} />
      <EditorText draft={draft} editor={editor} />
      {changes > 0 && (
        <Text color="secondary" type="supporting">
          Your {changes} priority {changes === 1 ? "change is" : "changes are"} committed with it.
        </Text>
      )}
      <HStack gap={2} wrap="wrap">
        <AttachButton onFiles={(files) => void editor.images.addFiles(files)} />
        <Button
          clickAction={() => editor.actions.commit(false)}
          label="Commit"
          variant="secondary"
        />
      </HStack>
    </VStack>
  );
}
