import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Divider } from "@astryxdesign/core/Divider";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { fontWeightVars, typeScaleVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { Suspense, useState } from "react";
import { useFateClient } from "react-fate";
import type { Span } from "uraeda-binding";
import { Blocks } from "./Blocks.tsx";
import { readPrioritiesHash, useDraft, usePriority } from "./data.ts";
import { EditableLine } from "./EditableLine.tsx";
import { refusal } from "./errors.ts";
import { Page } from "./layout/Page.tsx";
import { useUndoToast } from "./layout/useUndoToast.ts";
import { currentEntry, navigate, pathLink, redirect, useRestoreScroll } from "./routes.tsx";
import { plain } from "./Spans.tsx";
import { DraftView, FeatureView, PrioritiesView } from "./views.ts";
import { Paragraph } from "./layout/Paragraph.tsx";

const SECTIONS: Record<string, string> = {
  now: "Now",
  next: "Next",
  later: "Later",
  blocked: "Blocked",
};

const styles = stylex.create({
  // The line, the view's title.
  line: {
    fontSize: typeScaleVars["--text-heading-2-size"],
    lineHeight: typeScaleVars["--text-heading-2-leading"],
    fontWeight: fontWeightVars["--font-weight-semibold"],
  },
});

/** The file a line links, from the repository's top level, if any. */
function linkOf(spans: ReadonlyArray<Span>) {
  return spans.find((span) => span.link?.path)?.link?.path;
}

/** Whether a path is a draft, or a postponed proposal, which the editor opens. */
function isDraft(path: string) {
  return /^specs\/(drafts|backlog)\/.+\.md$/.test(path);
}

/** The page a task view was opened from, which it returns to once its line is deleted. */
function origin() {
  return currentEntry().from === "/" ? "/" : "/priorities";
}

/** A line's draft, drawn, with Edit and Start the feature. */
function DraftPart({ path }: { path: string }) {
  const fate = useFateClient();
  const draft = useDraft(path);
  const [message, setMessage] = useState<string>();
  if (!draft) {
    return <Paragraph>No draft {path}.</Paragraph>;
  }
  // The draft's title is the line, shown above it already.
  const ids = draft.document.blocks
    .filter(
      (block) => block.parent === undefined && !(block.kind === "heading" && block.level === 1),
    )
    .map((block) => block.id);
  const start = async () => {
    setMessage(undefined);
    const slug = (path.split("/").at(-1) ?? "").replace(/\.md$/, "");
    const result = await fate.mutations.feature.start({
      input: { draft: path, slug },
      view: FeatureView,
    });
    if (result.error) {
      setMessage(refusal(result.error).message);
    } else if (typeof result.result?.folder === "string") {
      navigate(`/f/${result.result.folder}`);
    }
  };
  return (
    <VStack gap={3}>
      <Text type="supporting" color="secondary">
        {path.replace(/^specs\//, "")} · {draft.committed ? "committed" : "not committed"}
      </Text>
      <Blocks document={draft.document} ids={ids} />
      <HStack gap={2}>
        <Button label="Edit" onClick={() => navigate(`/edit/${path}`)} />
        <Button variant="primary" label="Start the feature" clickAction={start} />
      </HStack>
      {message && <Banner status="error" title={message} collapsible={false} />}
    </VStack>
  );
}

/**
 * One line of `PRIORITIES.md`, by its key: its text edited in place, its section, its draft drawn
 * or a Draft button, Delete with Undo, and the lines before and after it in its section.
 */
export function TaskView({ entryKey }: { entryKey: string }) {
  const fate = useFateClient();
  // The line's place while it is renamed: its key changes before its address does.
  const [renaming, setRenaming] = useState<string>();
  const { priorities, found } = usePriority(entryKey, renaming);
  const toast = useUndoToast();
  const [message, setMessage] = useState<string>();
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(true);
  if (!priorities) {
    return null;
  }
  if (!found) {
    return (
      <Page>
        <Banner
          status="error"
          title="This line is no longer in PRIORITIES.md."
          collapsible={false}
          description={
            <Link href="/priorities" hasUnderline>
              Open the priorities
            </Link>
          }
        />
      </Page>
    );
  }
  const { entry, section, index } = found;
  const hash = priorities.hash;
  const text = plain(entry.spans);
  const link = linkOf(entry.spans);
  const entries = section.entries;

  /** Runs a change of the line: a refusal shows under it, and a conflict reloads the list. */
  const run = async (call: () => Promise<{ error?: unknown }>) => {
    setMessage(undefined);
    const result = await call();
    if (result.error) {
      const failed = refusal(result.error);
      setMessage(failed.message);
      if (failed.kind === "conflict") {
        void fate.request(
          { priorities: { id: "priorities", view: PrioritiesView } },
          { mode: "network-only" },
        );
      }
    }
    return result;
  };

  const rename = async (next: string) => {
    setRenaming(entry.id);
    const result = await fate.mutations.priorities.edit({
      input: { entry: entry.id, text: next, hash },
      view: PrioritiesView,
    });
    if (result.error) {
      setRenaming(undefined);
      return refusal(result.error).message;
    }
    const key = result.result?.sections
      .flatMap((s) => s.entries)
      .find((e) => e.id === entry.id)?.key;
    if (key && key !== entryKey) {
      redirect(`/priorities/${key}`);
    }
    return undefined;
  };

  const move = (to: string) =>
    run(() =>
      fate.mutations.priorities.move({
        input: { entry: entry.id, section: to, index: Number.MAX_SAFE_INTEGER, hash },
        view: PrioritiesView,
      }),
    );

  const draft = async () => {
    const result = await run(() =>
      fate.mutations.draft.create({ input: { line: entry.id, hash }, view: DraftView }),
    );
    const path = (result as { result?: { path?: unknown } }).result?.path;
    if (!result.error && typeof path === "string") {
      navigate(`/edit/${path}`);
    }
  };

  const remove = async () => {
    // What Undo writes back: the line, then its nested lines, as they were.
    const lines = [`- ${entry.text}`, ...entry.nested];
    const at = { section: section.section, index };
    const result = await run(() =>
      fate.mutations.priorities.remove({ input: { entry: entry.id, hash }, view: PrioritiesView }),
    );
    if (result.error) {
      return;
    }
    const failed = `Could not restore "${text}": PRIORITIES.md changed on disk.`;
    toast(`Deleted "${text}"`, async () => {
      try {
        // Over the file as it is now: the line goes back to its place, or its section's end.
        const now = await readPrioritiesHash(fate);
        const restored = await fate.mutations.priorities.insert({
          input: { ...at, lines, hash: now },
          view: PrioritiesView,
        });
        return restored.error ? failed : undefined;
      } catch {
        return failed;
      }
    });
    redirect(origin());
  };

  const step = (to: number) =>
    navigate(`/priorities/${entries[to].key}`, { from: currentEntry().from });

  return (
    <Page>
      <VStack gap={4}>
        <Text type="supporting" color="secondary">
          {section.title} · {index + 1} of {entries.length}
        </Text>
        <div {...stylex.props(styles.line)}>
          <EditableLine value={entry.text} label="Line" onSave={rename} display={text} />
        </div>
        <SegmentedControl
          label="Section"
          value={section.section}
          onChange={(to: string) => void move(to)}
        >
          {Object.entries(SECTIONS).map(([id, title]) => (
            <SegmentedControlItem key={id} value={id} label={title} />
          ))}
        </SegmentedControl>
        {message && <Banner status="error" title={message} collapsible={false} />}
        <Divider />
        {link && isDraft(link) ? (
          <Suspense fallback={<Spinner label="Loading the draft" />}>
            <DraftPart path={link} />
          </Suspense>
        ) : link ? (
          <Paragraph>
            <Link href={pathLink(link).href} hasUnderline>
              Open {link.replace(/^specs\//, "")}
            </Link>
          </Paragraph>
        ) : (
          <VStack gap={2}>
            <Paragraph color="secondary">No draft yet.</Paragraph>
            <HStack gap={2}>
              <Button variant="primary" label="Draft" clickAction={draft} />
            </HStack>
          </VStack>
        )}
        <HStack gap={2}>
          <Button variant="destructive" label="Delete" clickAction={remove} />
        </HStack>
        <Divider />
        <HStack justify="between" gap={2}>
          <Button label="‹ Previous" isDisabled={index === 0} onClick={() => step(index - 1)} />
          <Button
            label="Next ›"
            isDisabled={index === entries.length - 1}
            onClick={() => step(index + 1)}
          />
        </HStack>
      </VStack>
    </Page>
  );
}
