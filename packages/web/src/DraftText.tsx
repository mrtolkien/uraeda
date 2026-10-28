// The editor page's text pane: the draft drawn, or its text to edit, in one pane named by its file.
// A click on the drawn text edits it, `i` too, and Escape leaves the field for the page's keys.
// Under it, one row: Save while there is something to save, what it did, and a proposal's Commit.
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { VStack } from "@astryxdesign/core/VStack";
import { spacingVars, typographyVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { KeyboardEvent, MouseEvent, RefObject } from "react";
import { AttachButton } from "./attach/AttachButton.tsx";
import { AttachStatus } from "./attach/AttachStatus.tsx";
import { DropHint } from "./attach/DropHint.tsx";
import { Blocks } from "./Blocks.tsx";
import { CommitActions } from "./CommitActions.tsx";
import { MAIN_CHECKOUT, type useDraft } from "./data.ts";
import { RestoreNotice } from "./fields/RestoreNotice.tsx";
import { SaveKeys } from "./fields/SaveKeys.tsx";
import { SaveStatus } from "./fields/SaveStatus.tsx";
import { TextField } from "./fields/TextField.tsx";
import { Pane } from "./layout/Pane.tsx";
import type { DraftEditorState } from "./pane/useDraftEditor.ts";
import { StoriesProvider } from "./stories.tsx";

const styles = stylex.create({
  // Room under the last row, which the pane's border would otherwise touch.
  body: { paddingBlockEnd: spacingVars["--spacing-3"] },
  // The words say they can be edited: the pointer is the text's, and its font the editor's, so that
  // the preview reads as the text does.
  drawn: {
    "--font-family-reading": typographyVars["--font-family-code"],
    cursor: "text",
  },
});

type Draft = NonNullable<ReturnType<typeof useDraft>>;

/** What the notice says when the file changed since its unsaved text was typed. */
const EDITOR_CHANGED = "The file changed since: saving replaces it.";

/** The text drawn, which a click edits unless it selects words or hits a link or a control. */
function Drawn({
  draft,
  editor,
  onEdit,
}: {
  draft: Draft;
  editor: DraftEditorState;
  onEdit: () => void;
}) {
  // The title is the page's heading already.
  const ids = draft.document.blocks
    .filter(
      (block) => block.parent === undefined && !(block.kind === "heading" && block.level === 1),
    )
    .map((block) => block.id);
  const click = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (window.getSelection()?.isCollapsed === false || target.closest("a, button, input")) {
      return;
    }
    onEdit();
  };
  return (
    <div onClick={click} {...stylex.props(styles.drawn)}>
      <DropHint hint={editor.images.hint}>
        <StoriesProvider folder={MAIN_CHECKOUT} mockups={draft.mockups} stories={draft.stories}>
          <Blocks document={draft.document} ids={ids} />
        </StoriesProvider>
      </DropHint>
    </div>
  );
}

/**
 * The pane: `boxRef` holds its text field, which `i` brings the focus to. `onSubmit` is its
 * Ctrl+Enter: a draft's starts it, a proposal's saves it. A draft has no Commit, as its start
 * commits it; a proposal commits with "Commit and start the agent", as in its feature.
 */
export function DraftText({
  boxRef,
  draft,
  editor,
  onEdit,
  onSubmit,
  path,
}: {
  boxRef: RefObject<HTMLDivElement | null>;
  draft: Draft;
  editor: DraftEditorState;
  onEdit: () => void;
  onSubmit: () => void;
  path: string;
}) {
  const { field, images } = editor;
  const isDraft = draft.kind === "draft";
  return (
    <Pane
      actions={
        <HStack align="center" gap={1}>
          <Button
            label={editor.drawn ? "Edit" : "Preview"}
            onClick={() => (editor.drawn ? onEdit() : editor.setDrawn(true))}
            size="sm"
            variant="ghost"
          />
          <AttachButton isIconOnly onFiles={(files) => void images.addFiles(files)} />
        </HStack>
      }
      icon="uraeda:file-text"
      title={path.split("/").pop() ?? path}
    >
      <VStack gap={3} xstyle={styles.body}>
        {field.restored && (
          <RestoreNotice
            changed={EDITOR_CHANGED}
            onDiscard={field.discard}
            restored={field.restored}
          />
        )}
        <div ref={boxRef}>
          {editor.drawn ? (
            <Drawn draft={draft} editor={editor} onEdit={onEdit} />
          ) : (
            <VStack gap={2}>
              <DropHint hint={images.hint}>
                <TextField
                  isLabelHidden
                  kind="editor"
                  label="Text"
                  onChange={field.change}
                  onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
                    // Escape leaves the field for the page's keys, as it does a terminal's editor.
                    if (event.key === "Escape") {
                      event.preventDefault();
                      event.currentTarget.blur();
                    }
                  }}
                  onSubmit={onSubmit}
                  value={field.text}
                  {...images.fieldProps}
                />
              </DropHint>
              <AttachStatus status={images.status} />
            </VStack>
          )}
        </div>
        <HStack align="center" gap={2} justify="between" wrap="wrap">
          <HStack align="center" gap={2} wrap="wrap">
            {field.dirty && <Button label="Save" onClick={editor.saveText} />}
            <SaveStatus dirty={field.dirty} state={editor.state} />
            {/* A draft's Ctrl+Enter starts it, so it does not save. */}
            {field.dirty && !isDraft && <SaveKeys />}
          </HStack>
          {!isDraft && (
            <CommitActions folder={draft.folder} label="Commit" onCommit={editor.actions.commit} />
          )}
        </HStack>
      </VStack>
    </Pane>
  );
}
