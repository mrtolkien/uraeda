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
import { navigate, useRepoPath, useRestoreScroll } from "./routes.tsx";
import { handOver } from "./sessions.ts";
import { useSave } from "./useSave.ts";
import { DraftView, FeatureView } from "./views.ts";
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

/**
 * A draft or a proposal: drawn once written, with Edit, or edited as text, with the template's
 * guidance for each empty section; saved as typed over the version it was read at, committed, and,
 * for a draft, started as a feature.
 */
// oxlint-disable-next-line max-lines-per-function -- over the limit before the code quality decision: the commit, start, and discovery actions in a hook, and the form in components
export function EditorPage({ path }: { path: string }) {
  const fate = useFateClient();
  const here = useRepoPath();
  const draft = useDraft(path);
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(true);
  const [text, setText] = useState(draft?.text ?? "");
  const hints = useProposalHints();
  // A written proposal opens drawn; one that holds only its title and What opens to be written.
  const [drawn, setDrawn] = useState(() => draft?.written ?? false);
  const [conflict, setConflict] = useState<string>();
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
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
  const { idle, settle } = save;
  const shown = useRef(text);
  // oxlint-disable-next-line react/refs -- before the code quality decision: the shown text, kept for the effects to read
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
      setMessage({ ok: false, text: "Your text is not saved: nothing was committed." });
      return;
    }
    const result = await fate.mutations.text.commit({ input: { path }, view: DraftView });
    if (result.error) {
      setMessage({ ok: false, text: refusal(result.error).message });
      return;
    }
    const folder = draft.folder;
    if (continues && folder) {
      handOver(folder, "proposal", path.split("/").at(-1));
    } else {
      setMessage({ ok: true, text: "Committed." });
    }
  };
  const start = async (continues: boolean) => {
    setMessage(undefined);
    if (!(await save.flush())) {
      setMessage({ ok: false, text: "Your text is not saved: the feature was not started." });
      return;
    }
    const result = await fate.mutations.feature.start({
      input: { draft: path, slug },
      view: FeatureView,
    });
    if (result.error) {
      setMessage({ ok: false, text: refusal(result.error).message });
    } else if (typeof result.result?.folder === "string") {
      const folder = result.result.folder;
      if (continues) {
        handOver(folder, "start");
      } else {
        navigate(here(`/f/${folder}`));
      }
    }
  };
  /**
   * Sets the discovery effort in the frontmatter, in the save queue: after the text shown is saved,
   * and before a later save, commit, or start.
   */
  const setDiscovery = async (level: string) => {
    setMessage(undefined);
    let refused: string | undefined;
    const wrote = await save.write(async (previous) => {
      const result = await fate.mutations.text.discovery({
        input: { hash: previous, level, path },
        view: DraftView,
      });
      if (result.error) {
        const failed = refusal(result.error);
        if (failed.kind === "conflict") {
          setConflict(failed.message);
        } else {
          refused = failed.message;
        }
        return { message: failed.message, ok: false };
      }
      if (result.result) {
        setText(result.result.text);
        return { ok: true, saved: result.result.hash };
      }
      return { ok: true, saved: previous };
    });
    if (!wrote) {
      setMessage({
        ok: false,
        text: refused ?? "Your text is not saved: the discovery effort was not set.",
      });
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
        data: { hash: string; text: string };
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
        {conflict && (
          <Banner
            collapsible={false}
            description={
              <VStack gap={2}>
                <Button
                  label="Copy my text"
                  onClick={() => void navigator.clipboard?.writeText(text)}
                />
                <Button clickAction={reload} label="Load the new version" />
              </VStack>
            }
            status="error"
            title={conflict}
          />
        )}
        {draft.discovery != null && (
          <VStack gap={1}>
            <SegmentedControl
              label="Discovery effort"
              onChange={(value: string) => void setDiscovery(value)}
              value={draft.discovery}
            >
              {draft.discoveryLevels.map((level) => (
                <SegmentedControlItem key={level} label={levelLabel(level)} value={level} />
              ))}
            </SegmentedControl>
            <Text color="secondary" type="supporting">
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
              isLabelHidden
              label="Text"
              onChange={(value: string) => {
                setText(value);
                save.schedule(value);
              }}
              rows={Math.max(16, text.split("\n").length + 2)}
              value={text}
            />
            {shownHints.length > 0 && (
              <VStack gap={1}>
                <Text color="secondary" type="supporting">
                  To write in the empty sections:
                </Text>
                {shownHints.map((hint) => (
                  <Paragraph color="secondary" key={hint.heading}>
                    <Text color="secondary" weight="semibold">
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
          <Banner collapsible={false} status="error" title={`Not saved: ${save.state.message}`} />
        )}
        {takesPriorities && (
          <Text color="secondary" type="supporting">
            {takesPriorities}
          </Text>
        )}
        {isDraft ? (
          <HStack gap={2}>
            <Button label={drawn ? "Edit" : "Preview"} onClick={() => setDrawn(!drawn)} />
            <Button clickAction={() => commit(false)} label="Commit" variant="secondary" />
          </HStack>
        ) : (
          <CommitActions label="Commit" onCommit={commit}>
            <Button label={drawn ? "Edit" : "Preview"} onClick={() => setDrawn(!drawn)} />
          </CommitActions>
        )}
        {isDraft && (
          <>
            <Divider />
            <TextInput
              description="Two words at most: it names the folder and the branch."
              label="Slug"
              onChange={(value: string) => setSlug(value)}
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
        )}
        {message && (
          <Banner
            collapsible={false}
            status={message.ok ? "success" : "error"}
            title={message.text}
          />
        )}
      </VStack>
    </Page>
  );
}
