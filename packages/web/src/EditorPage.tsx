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
import { useEffect, useRef, useState } from "react";
import { useFateClient } from "react-fate";
import { Blocks } from "./Blocks.tsx";
import { CommitActions } from "./CommitActions.tsx";
import { useDraft, useProposalHints } from "./data.ts";
import { refusal } from "./errors.ts";
import { Page } from "./layout/Page.tsx";
import { navigate, useRestoreScroll } from "./routes.tsx";
import { handOver } from "./sessions.ts";
import { useSave } from "./useSave.ts";
import { DraftView, FeatureView } from "./views.ts";
import { Paragraph } from "./layout/Paragraph.tsx";

const SECTIONS: Record<string, string> = {
  now: "Now",
  next: "Next",
  later: "Later",
  blocked: "Blocked",
};

/** A discovery effort as the control shows it: `medium` is Medium. */
function levelLabel(level: string) {
  return level.charAt(0).toUpperCase() + level.slice(1);
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
  const [text, setText] = useState(draft?.text ?? "");
  const hints = useProposalHints();
  // A written proposal opens drawn; one that holds only its title and What opens to be written.
  const [drawn, setDrawn] = useState(() => draft?.written ?? false);
  const [conflict, setConflict] = useState<string>();
  const [message, setMessage] = useState<{ text: string; ok: boolean }>();
  const [slug, setSlug] = useState(draft?.slug ?? "");
  const save = useSave<string>(async (value, previous) => {
    const result = await fate.mutations.text.save({
      input: { path, text: value, hash: previous },
      view: DraftView,
    });
    if (result.error) {
      const failed = refusal(result.error);
      if (failed.kind === "conflict") {
        setConflict(failed.message);
      }
      return { ok: false, message: failed.message };
    }
    return { ok: true, saved: result.result?.hash ?? previous };
  }, draft?.hash ?? "");
  const { settle, idle, last } = save;
  const shown = useRef(text);
  shown.current = text;
  // A text changed elsewhere replaces this one when nothing of it waits to be saved.
  useEffect(() => {
    if (!draft) {
      return;
    }
    if (idle() && draft.text !== shown.current) {
      setText(draft.text);
    }
    settle(draft.hash);
  }, [draft, idle, settle]);

  if (!draft) {
    return (
      <Page>
        <Paragraph>No draft {path}.</Paragraph>
      </Page>
    );
  }
  const isDraft = draft.kind === "draft";
  const changes = draft.priorityChanges;
  const takesPriorities =
    isDraft && changes > 0
      ? `Your ${changes} priority ${changes === 1 ? "change is" : "changes are"} committed with it.`
      : undefined;

  const commit = async (continues: boolean) => {
    setMessage(undefined);
    if (!(await save.flush())) {
      setMessage({ text: "Your text is not saved: nothing was committed.", ok: false });
      return;
    }
    const result = await fate.mutations.text.commit({ input: { path }, view: DraftView });
    if (result.error) {
      setMessage({ text: refusal(result.error).message, ok: false });
      return;
    }
    const folder = draft.folder;
    if (continues && folder) {
      handOver(folder, "proposal", path.split("/").at(-1));
    } else {
      setMessage({ text: "Committed.", ok: true });
    }
  };
  const start = async (continues: boolean) => {
    setMessage(undefined);
    if (!(await save.flush())) {
      setMessage({ text: "Your text is not saved: the feature was not started.", ok: false });
      return;
    }
    const result = await fate.mutations.feature.start({
      input: { draft: path, slug },
      view: FeatureView,
    });
    if (result.error) {
      setMessage({ text: refusal(result.error).message, ok: false });
    } else if (typeof result.result?.folder === "string") {
      const folder = result.result.folder;
      if (continues) {
        handOver(folder, "start");
      } else {
        navigate(`/f/${folder}`);
      }
    }
  };
  /** Sets the discovery effort in the frontmatter, once the text shown is saved. */
  const setDiscovery = async (level: string) => {
    setMessage(undefined);
    if (!(await save.flush())) {
      setMessage({ text: "Your text is not saved: the discovery effort was not set.", ok: false });
      return;
    }
    const result = await fate.mutations.text.discovery({
      input: { path, level, hash: last() },
      view: DraftView,
    });
    if (result.error) {
      const failed = refusal(result.error);
      if (failed.kind === "conflict") {
        setConflict(failed.message);
      } else {
        setMessage({ text: failed.message, ok: false });
      }
      return;
    }
    if (result.result) {
      setText(result.result.text);
      settle(result.result.hash);
    }
  };
  /** Reads the file again, and puts its text in place of the one that was not saved. */
  const reload = async () => {
    setConflict(undefined);
    const { draft: ref } = await fate.request(
      { draft: { id: path, view: DraftView } },
      { mode: "network-only" },
    );
    if (ref) {
      // fate does not infer the view's type through `readView`: these are its fields.
      const fresh = (await fate.readView(DraftView, ref)) as unknown as {
        data: { text: string; hash: string };
      };
      setText(fresh.data.text);
      settle(fresh.data.hash);
    }
  };

  const status =
    save.state.kind === "saving"
      ? "saving…"
      : save.state.kind === "saved"
        ? "saved ✓"
        : draft.committed
          ? "committed"
          : "not committed";
  // The title is the page's heading already.
  const drawnIds = draft.document.blocks
    .filter(
      (block) => block.parent === undefined && !(block.kind === "heading" && block.level === 1),
    )
    .map((block) => block.id);
  const shownHints = hints.filter((hint) => draft.emptySections.includes(hint.heading));

  return (
    <Page>
      <VStack gap={4}>
        <HStack justify="between" gap={2} wrap="wrap">
          <Text type="code">{path.replace(/^specs\//, "")}</Text>
          <Text type="supporting" color="secondary">
            {status}
          </Text>
        </HStack>
        <Heading level={1}>{draft.title}</Heading>
        {draft.entry && (
          <Text type="supporting" color="secondary">
            {/* Committed or not shows beside the file's name already. */}
            In Priorities, {SECTIONS[draft.entry.section] ?? draft.entry.section}
          </Text>
        )}
        {conflict && (
          <Banner
            status="error"
            title={conflict}
            collapsible={false}
            description={
              <VStack gap={2}>
                <Button
                  label="Copy my text"
                  onClick={() => void navigator.clipboard?.writeText(text)}
                />
                <Button label="Load the new version" clickAction={reload} />
              </VStack>
            }
          />
        )}
        {draft.discovery != null && (
          <VStack gap={1}>
            <SegmentedControl
              label="Discovery effort"
              value={draft.discovery}
              onChange={(value: string) => void setDiscovery(value)}
            >
              {draft.discoveryLevels.map((level) => (
                <SegmentedControlItem key={level} value={level} label={levelLabel(level)} />
              ))}
            </SegmentedControl>
            <Text type="supporting" color="secondary">
              How far the agent researches before asking: low reads the code and its docs, medium
              also compares a few alternatives online, high looks far and wide.
            </Text>
          </VStack>
        )}
        {drawn ? (
          <Blocks document={draft.document} ids={drawnIds} />
        ) : (
          <VStack gap={2}>
            <TextArea
              label="Text"
              isLabelHidden
              value={text}
              rows={Math.max(16, text.split("\n").length + 2)}
              onChange={(value: string) => {
                setText(value);
                save.schedule(value);
              }}
            />
            {shownHints.length > 0 && (
              <VStack gap={1}>
                <Text type="supporting" color="secondary">
                  To write in the empty sections:
                </Text>
                {shownHints.map((hint) => (
                  <Paragraph key={hint.heading} color="secondary">
                    <Text weight="semibold" color="secondary">
                      {hint.heading}
                    </Text>
                    {" · "}
                    <Text color="secondary">{hint.hint}</Text>
                  </Paragraph>
                ))}
              </VStack>
            )}
          </VStack>
        )}
        {save.state.kind === "error" && !conflict && (
          <Banner status="error" title={`Not saved: ${save.state.message}`} collapsible={false} />
        )}
        {takesPriorities && (
          <Text type="supporting" color="secondary">
            {takesPriorities}
          </Text>
        )}
        {isDraft ? (
          <HStack gap={2}>
            <Button label={drawn ? "Edit" : "Preview"} onClick={() => setDrawn(!drawn)} />
            <Button variant="secondary" label="Commit" clickAction={() => commit(false)} />
          </HStack>
        ) : (
          <CommitActions label="Commit" onCommit={commit}>
            <Button label={drawn ? "Edit" : "Preview"} onClick={() => setDrawn(!drawn)} />
          </CommitActions>
        )}
        {isDraft && (
          <>
            <Divider />
            <TextInput label="Slug" value={slug} onChange={(value: string) => setSlug(value)} />
            <CommitActions
              label="Start the feature"
              continueLabel="Start the feature and the agent"
              onlyLabel="Start only"
              onCommit={start}
            />
            <Text type="supporting" color="secondary">
              Creates its branch and worktree, and moves the line to Now.
            </Text>
          </>
        )}
        {message && (
          <Banner
            status={message.ok ? "success" : "error"}
            title={message.text}
            collapsible={false}
          />
        )}
      </VStack>
    </Page>
  );
}
