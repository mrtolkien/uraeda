import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Divider } from "@astryxdesign/core/Divider";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { type ReactNode, useState } from "react";
import { useFateClient } from "react-fate";
import { AttachButton } from "./attach/AttachButton.tsx";
import { AttachStatus } from "./attach/AttachStatus.tsx";
import { DropHint } from "./attach/DropHint.tsx";
import { asTyped, readDraft, useEditorImages, useMovedText } from "./attach/useEditorImages.ts";
import { Blocks } from "./Blocks.tsx";
import { CommitActions } from "./CommitActions.tsx";
import { useDraft, useProposalHints } from "./data.ts";
import { refusal } from "./errors.ts";
import { Page } from "./layout/Page.tsx";
import { useRestoreScroll } from "./routes.tsx";
import { useEditorActions } from "./useEditorActions.ts";
import { useSave } from "./useSave.ts";
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
function EditorHeading({ draft, path, status }: { draft: Draft; path: string; status: string }) {
  return (
    <>
      <HStack gap={2} justify="between" wrap="wrap">
        <Text type="code">{path.replace(/^specs\//, "")}</Text>
        <Text color="secondary" type="supporting">
          {status}
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

/** The draft drawn, or its text to edit, which takes images, with the empty sections' guidance. */
function EditorText({
  draft,
  drawn,
  hints,
  images,
  onChange,
  text,
}: {
  draft: Draft;
  drawn: boolean;
  hints: Hints;
  images: ReturnType<typeof useEditorImages>["images"];
  onChange: (text: string) => void;
  text: string;
}) {
  if (drawn) {
    // The title is the page's heading already.
    const ids = draft.document.blocks
      .filter(
        (block) => block.parent === undefined && !(block.kind === "heading" && block.level === 1),
      )
      .map((block) => block.id);
    return (
      <DropHint hint={images.hint}>
        <Blocks document={draft.document} ids={ids} />
      </DropHint>
    );
  }
  return (
    <VStack gap={2}>
      <DropHint hint={images.hint}>
        <TextArea
          isLabelHidden
          label="Text"
          onChange={onChange}
          rows={Math.max(16, text.split("\n").length + 2)}
          value={text}
          {...images.fieldProps}
        />
      </DropHint>
      <AttachStatus status={images.status} />
      <SectionHints draft={draft} hints={hints} />
    </VStack>
  );
}

/** A draft's slug, and Start, which turns it into a feature. */
function StartDraft({
  onSlug,
  slug,
  start,
}: {
  onSlug: (slug: string) => void;
  slug: string;
  start: (continues: boolean) => Promise<void>;
}) {
  return (
    <>
      <Divider />
      <TextInput
        description="Two words at most: it names the folder and the branch."
        label="Slug"
        onChange={onSlug}
        value={slug}
      />
      <CommitActions
        continueLabel="Start the feature and the agent"
        label="Start the feature"
        onCommit={start}
        onlyLabel="Start only"
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
  onSlug,
  slug,
}: {
  actions: ReturnType<typeof useEditorActions>;
  draft: Draft;
  leading: ReactNode;
  onSlug: (slug: string) => void;
  slug: string;
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
          <Button clickAction={() => actions.commit(false)} label="Commit" variant="secondary" />
        </HStack>
      ) : (
        <CommitActions label="Commit" onCommit={actions.commit}>
          {leading}
        </CommitActions>
      )}
      {isDraft && <StartDraft onSlug={onSlug} slug={slug} start={actions.start} />}
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
 * guidance for each empty section; saved as typed over the version it was read at, committed, and,
 * for a draft, started as a feature.
 */
export function EditorPage({ path }: { path: string }) {
  const fate = useFateClient();
  const draft = useDraft(path);
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(true);
  const moved = useMovedText(path);
  const hints = useProposalHints();
  const [text, setText] = useState(moved?.text ?? asTyped(draft?.text ?? ""));
  // A written proposal opens drawn; one that holds only its title and What opens to be written.
  const [drawn, setDrawn] = useState(() => !moved && (draft?.written ?? false));
  const [conflict, setConflict] = useState<string>();
  const [slug, setSlug] = useState(draft?.slug ?? "");
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
    return { ok: true, saved: result.result?.hash ?? previous };
  }, draft?.hash ?? "");
  const { holding, images } = useEditorImages({
    draft,
    moved,
    path,
    save,
    setDrawn,
    setText,
    text,
  });
  const actions = useEditorActions({ draft, path, save, setConflict, setText, slug });

  if (!draft) {
    return (
      <Page>
        <Paragraph>No draft {path}.</Paragraph>
      </Page>
    );
  }
  /** Reads the file again, and puts its text in place of the one that was not saved. */
  const reload = async () => {
    setConflict(undefined);
    const fresh = await readDraft(fate, path);
    if (fresh) {
      setText(asTyped(fresh.text));
      save.settle(fresh.hash, true);
    }
  };
  const status =
    save.state.kind === "saving" || images.busy
      ? "saving…"
      : save.state.kind === "saved"
        ? "saved ✓"
        : draft.committed
          ? "committed"
          : "not committed";

  return (
    <Page>
      <VStack gap={4}>
        <EditorHeading draft={draft} path={path} status={status} />
        {conflict && <ConflictBanner conflict={conflict} onReload={reload} text={text} />}
        <DiscoveryEffort draft={draft} onChange={(level) => void actions.setDiscovery(level)} />
        <EditorText
          draft={draft}
          drawn={drawn}
          hints={hints}
          images={images}
          onChange={(value) => {
            setText(value);
            if (!holding.current) {
              save.schedule(value);
            }
          }}
          text={text}
        />
        {save.state.kind === "error" && !conflict && (
          <Banner collapsible={false} status="error" title={`Not saved: ${save.state.message}`} />
        )}
        <EditorEnd
          actions={actions}
          draft={draft}
          leading={
            <>
              <Button label={drawn ? "Edit" : "Preview"} onClick={() => setDrawn(!drawn)} />
              <AttachButton onFiles={(files) => void images.addFiles(files)} />
            </>
          }
          onSlug={setSlug}
          slug={slug}
        />
      </VStack>
    </Page>
  );
}
