import { AnnouncedBanner } from "./layout/AnnouncedBanner.tsx";
import { Button } from "@astryxdesign/core/Button";
import { Divider } from "@astryxdesign/core/Divider";
import { HStack } from "@astryxdesign/core/HStack";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import type { ReactNode } from "react";
import { AttachButton } from "./attach/AttachButton.tsx";
import { CommitActions } from "./CommitActions.tsx";
import { WriteButton } from "./writes/WriteButton.tsx";
import { useDraft } from "./data.ts";
import { useTextField } from "./fields/useTextField.ts";
import { Page } from "./layout/Page.tsx";
import { ConflictBanner, EditorText, PriorityChanges } from "./pane/DraftEditor.tsx";
import { useDraftEditor } from "./pane/useDraftEditor.ts";
import { useRestoreScroll } from "./routes.tsx";
import type { useEditorActions } from "./useEditorActions.ts";
import { SlugField } from "./SlugField.tsx";
import { Missing } from "./layout/Missing.tsx";
import { PageTitle } from "./layout/PageTitle.tsx";

const SECTIONS: Record<string, string> = {
  blocked: "Blocked",
  later: "Later",
  next: "Next",
  now: "Now",
};

/** A discovery effort as the control shows it: `medium` is Medium. */
function levelLabel(level: string) {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

type Draft = NonNullable<ReturnType<typeof useDraft>>;

/** The draft's file and what became of it, its title, and its line in the priorities. */
function EditorHeading({ draft, path }: { draft: Draft; path: string }) {
  return (
    <PageTitle
      above={
        <HStack gap={2} justify="between" wrap="wrap">
          <Text type="code">{path.replace(/^specs\//, "")}</Text>
          <Text color="secondary" type="supporting">
            {draft.committed ? "committed" : "not committed"}
          </Text>
        </HStack>
      }
      // Committed or not shows beside the file's name already.
      meta={
        draft.entry && {
          text: `In Priorities, ${SECTIONS[draft.entry.section] ?? draft.entry.section}`,
        }
      }
    >
      {draft.title}
    </PageTitle>
  );
}

/** The discovery effort of a proposal that has one, set in its frontmatter. */
function DiscoveryEffort({ draft, onChange }: { draft: Draft; onChange: (level: string) => void }) {
  if (draft.discovery == null) {
    return null;
  }
  return (
    <VStack gap={1}>
      <SegmentedControl label="Discovery effort" onChange={onChange} value={draft.discovery}>
        {draft.discoveryLevels.map((level) => (
          <SegmentedControlItem key={level} label={levelLabel(level)} value={level} />
        ))}
      </SegmentedControl>
      <Text color="secondary" type="supporting">
        How far the agent researches before asking: low reads the code and its docs, medium also
        compares a few alternatives online, high looks far and wide.
      </Text>
    </VStack>
  );
}

/** A draft's slug, and Start, which turns it into a feature. */
function StartDraft({
  slug,
  start,
}: {
  slug: ReturnType<typeof useTextField>;
  start: (continues: boolean) => Promise<boolean>;
}) {
  return (
    <>
      <Divider />
      <SlugField field={slug} />
      <CommitActions
        continueLabel="Start the feature and the agent"
        label="Start the feature"
        onCommit={start}
        onlyLabel="Start only"
        runningLabel="Starting the feature…"
      />
      <Text color="secondary" type="supporting">
        Creates its branch and worktree, and moves the line to Now.
      </Text>
    </>
  );
}

/** The editor's end: what Commit takes with it, Commit, a draft's Start, and what they did. */
function EditorEnd({
  actions,
  draft,
  leading,
  slug,
}: {
  actions: ReturnType<typeof useEditorActions>;
  draft: Draft;
  leading: ReactNode;
  slug: ReturnType<typeof useTextField>;
}) {
  const isDraft = draft.kind === "draft";
  const changes = draft.priorityChanges;
  return (
    <>
      {isDraft && <PriorityChanges changes={changes} />}
      {isDraft ? (
        <HStack gap={2} wrap="wrap">
          {leading}
          <WriteButton label="Commit" onClick={() => actions.commit(false)} variant="secondary" />
        </HStack>
      ) : (
        <CommitActions folder={draft.folder} label="Commit" onCommit={actions.commit}>
          {leading}
        </CommitActions>
      )}
      {isDraft && <StartDraft slug={slug} start={actions.start} />}
      {actions.message && (
        <AnnouncedBanner
          collapsible={false}
          status={actions.message.ok ? "success" : "error"}
          title={actions.message.text}
        />
      )}
    </>
  );
}

/**
 * A draft or a proposal: drawn once written, with Edit, or edited as text, with the template's
 * guidance for each empty section; saved with Save or Ctrl+Enter over the version it was read at,
 * its unsaved text kept until then, committed, and, for a draft, started as a feature.
 */
export function EditorPage({ path }: { path: string }) {
  const draft = useDraft(path);
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(true);
  const slug = useTextField(`${path}#slug`, draft?.slug ?? "");
  const editor = useDraftEditor({ draft, isDrawnFirst: true, path, slug });

  if (!draft) {
    return (
      <Page>
        <Missing title={`No draft ${path}.`} />
      </Page>
    );
  }
  return (
    <Page>
      <VStack gap={4}>
        <EditorHeading draft={draft} path={path} />
        <ConflictBanner editor={editor} />
        <DiscoveryEffort
          draft={draft}
          onChange={(level) => void editor.actions.setDiscovery(level)}
        />
        <EditorText draft={draft} editor={editor} />
        <EditorEnd
          actions={editor.actions}
          draft={draft}
          leading={
            <>
              <Button
                label={editor.drawn ? "Edit" : "Preview"}
                onClick={() => editor.setDrawn(!editor.drawn)}
              />
              <AttachButton onFiles={(files) => void editor.images.addFiles(files)} />
            </>
          }
          slug={slug}
        />
      </VStack>
    </Page>
  );
}
