import { Banner } from "@astryxdesign/core/Banner";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { Blocks } from "../Blocks.tsx";
import { MAIN_CHECKOUT, useDraft } from "../data.ts";
import { useTextField } from "../fields/useTextField.ts";
import { Paragraph } from "../layout/Paragraph.tsx";
import { SlugField } from "../SlugField.tsx";
import { StoriesProvider } from "../stories.tsx";
import { DraftEditor } from "./DraftEditor.tsx";
import { useDraftEditor } from "./useDraftEditor.ts";
import { WriteButton } from "../writes/WriteButton.tsx";

/**
 * An entry's draft: drawn to read, or, while the entry is edited (`isEditing`) or its text holds
 * unsaved changes, its text in the editor of drafts, with Save and Commit (C2); then its slug and
 * Start the feature, which saves the text typed first, as the editor page does.
 */
export function PaneDraft({ isEditing, path }: { isEditing: boolean; path: string }) {
  const draft = useDraft(path);
  const slug = useTextField(`${path}#slug`, draft?.slug ?? "");
  const editor = useDraftEditor({ draft, isDrawnFirst: false, path, slug });
  if (!draft) {
    return <Paragraph>No draft {path}.</Paragraph>;
  }
  // The draft's title is the entry's text, shown above it already.
  const ids = draft.document.blocks
    .filter(
      (block) => block.parent === undefined && !(block.kind === "heading" && block.level === 1),
    )
    .map((block) => block.id);
  const { message } = editor.actions;
  return (
    <VStack gap={3}>
      <Text color="secondary" type="supporting">
        {path.replace(/^specs\//, "")} · {draft.committed ? "committed" : "not committed"}
      </Text>
      {isEditing || editor.field.entry ? (
        <DraftEditor draft={draft} editor={editor} />
      ) : (
        <StoriesProvider folder={MAIN_CHECKOUT} stories={draft.stories}>
          <Blocks document={draft.document} ids={ids} />
        </StoriesProvider>
      )}
      <SlugField field={slug} />
      <HStack gap={2}>
        <WriteButton
          label="Start the feature"
          onClick={() => editor.actions.start(false)}
          runningLabel="Starting the feature…"
          variant="primary"
        />
      </HStack>
      {message && (
        <Banner
          collapsible={false}
          status={message.ok ? "success" : "error"}
          title={message.text}
        />
      )}
    </VStack>
  );
}
