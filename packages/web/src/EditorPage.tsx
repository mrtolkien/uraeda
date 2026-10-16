import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Divider } from "@astryxdesign/core/Divider";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { type ReactNode, useState } from "react";
import { useFateClient } from "react-fate";
import { AttachButton } from "./attach/AttachButton.tsx";
import { AttachStatus } from "./attach/AttachStatus.tsx";
import { DropHint } from "./attach/DropHint.tsx";
import { asTyped, readDraft, useEditorImages, useMovedText } from "./attach/useEditorImages.ts";
import { Blocks } from "./Blocks.tsx";
import { StoriesProvider } from "./stories.tsx";
import { CommitActions } from "./CommitActions.tsx";
import { WriteButton } from "./writes/WriteButton.tsx";
import { MAIN_CHECKOUT, useDraft, useProposalHints } from "./data.ts";
import { refusal } from "./errors.ts";
import { RestoreNotice } from "./fields/RestoreNotice.tsx";
import { SaveStatus } from "./fields/SaveStatus.tsx";
import { SaveKeys } from "./fields/SaveKeys.tsx";
import { TextField } from "./fields/TextField.tsx";
import { useTextField } from "./fields/useTextField.ts";
import { Page } from "./layout/Page.tsx";
import { useRestoreScroll } from "./routes.tsx";
import { useEditorActions } from "./useEditorActions.ts";
import { SlugField } from "./SlugField.tsx";
import { type SaveState, useSave } from "./useSave.ts";
import { DraftView } from "./views.ts";
import { Paragraph } from "./layout/Paragraph.tsx";

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
type Hints = ReturnType<typeof useProposalHints>;

/** The draft's file and what became of it, its title, and its line in the priorities. */
function EditorHeading({ draft, path }: { draft: Draft; path: string }) {
  return (
    <>
      <HStack gap={2} justify="between" wrap="wrap">
        <Text type="code">{path.replace(/^specs\//, "")}</Text>
        <Text color="secondary" type="supporting">
          {draft.committed ? "committed" : "not committed"}
        </Text>
      </HStack>
      <Heading level={1}>{draft.title}</Heading>
      {draft.entry && (
        <Text color="secondary" type="supporting">
          {/* Committed or not shows beside the file's name already. */}
          In Priorities, {SECTIONS[draft.entry.section] ?? draft.entry.section}
        </Text>
      )}
    </>
  );
}

/** A save refused as the file changed elsewhere: the text to copy, or the new version to load. */
function ConflictBanner({
  conflict,
  onReload,
  text,
}: {
  conflict: string;
  onReload: () => Promise<void>;
  text: string;
}) {
  return (
    <Banner
      collapsible={false}
      description={
        <VStack gap={2}>
          <Button label="Copy my text" onClick={() => void navigator.clipboard?.writeText(text)} />
          <Button clickAction={onReload} label="Load the new version" />
        </VStack>
      }
      status="error"
      title={conflict}
    />
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

/** What the notice says when the file changed since its unsaved text was typed. */
const EDITOR_CHANGED = "The file changed since: saving replaces it.";

/**
 * The draft drawn, or its text to edit, which takes images, with the empty sections' guidance; its
 * unsaved text restored, and Save, or Ctrl+Enter, with what it did.
 */
function EditorText({
  draft,
  drawn,
  field,
  hints,
  images,
  onSave,
  state,
}: {
  draft: Draft;
  drawn: boolean;
  field: ReturnType<typeof useTextField>;
  hints: Hints;
  images: ReturnType<typeof useEditorImages>;
  onSave: () => void;
  state: SaveState;
}) {
  // The title is the page's heading already.
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
      {drawn ? (
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
              onSubmit={onSave}
              value={field.text}
              {...images.fieldProps}
            />
          </DropHint>
          <AttachStatus status={images.status} />
          <SectionHints draft={draft} hints={hints} />
        </>
      )}
      <HStack align="center" gap={2} wrap="wrap">
        <Button isDisabled={!field.dirty} label="Save" onClick={onSave} />
        <SaveStatus dirty={field.dirty} state={state} />
        <SaveKeys />
      </HStack>
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
      {isDraft && changes > 0 && (
        <Text color="secondary" type="supporting">
          Your {changes} priority {changes === 1 ? "change is" : "changes are"} committed with it.
        </Text>
      )}
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
        <Banner
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
  const fate = useFateClient();
  const draft = useDraft(path);
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(true);
  const moved = useMovedText(path);
  const hints = useProposalHints();
  const field = useTextField(`${path}#editor`, asTyped(draft?.text ?? ""));
  const slug = useTextField(`${path}#slug`, draft?.slug ?? "");
  // A written proposal opens drawn, unless it holds unsaved text; one that holds only its title and
  // What opens to be written.
  const [drawn, setDrawn] = useState(() => !moved && !field.entry && (draft?.written ?? false));
  const [conflict, setConflict] = useState<string>();
  const save = useSave<string>(async (value, previous) => {
    const result = await fate.mutations.text.save({
      input: { hash: previous, path, text: value },
      view: DraftView,
    });
    if (result.error) {
      const failed = refusal(result.error);
      if (failed.kind === "conflict") {
        setConflict(failed.message);
      }
      return { message: failed.message, ok: false };
    }
    field.saved(value);
    return { ok: true, saved: result.result?.hash ?? previous };
  }, draft?.hash ?? "");
  const images = useEditorImages({ draft, field, moved, path, save, setDrawn });
  const actions = useEditorActions({ draft, field, path, save, setConflict, slug });

  if (!draft) {
    return (
      <Page>
        <Paragraph>No draft {path}.</Paragraph>
      </Page>
    );
  }
  /** Reads the file again, and shows its text in place of the one that was not saved. */
  const reload = async () => {
    setConflict(undefined);
    const fresh = await readDraft(fate, path);
    if (fresh) {
      field.discard();
      save.settle(fresh.hash, true);
    }
  };
  // A conflict says why the save was refused already.
  const state: SaveState = images.busy
    ? { kind: "saving" }
    : conflict && save.state.kind === "error"
      ? { kind: "idle" }
      : save.state;

  return (
    <Page>
      <VStack gap={4}>
        <EditorHeading draft={draft} path={path} />
        {conflict && <ConflictBanner conflict={conflict} onReload={reload} text={field.text} />}
        <DiscoveryEffort draft={draft} onChange={(level) => void actions.setDiscovery(level)} />
        <EditorText
          draft={draft}
          drawn={drawn}
          field={field}
          hints={hints}
          images={images}
          onSave={() => {
            if (field.dirty) {
              void save.save(field.text);
            }
          }}
          state={state}
        />
        <EditorEnd
          actions={actions}
          draft={draft}
          leading={
            <>
              <Button label={drawn ? "Edit" : "Preview"} onClick={() => setDrawn(!drawn)} />
              <AttachButton onFiles={(files) => void images.addFiles(files)} />
            </>
          }
          slug={slug}
        />
      </VStack>
    </Page>
  );
}
