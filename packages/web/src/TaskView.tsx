import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Divider } from "@astryxdesign/core/Divider";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
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
import {
  currentEntry,
  navigate,
  pathLink,
  redirect,
  useRepoPath,
  useRepository,
  useRestoreScroll,
} from "./routes.tsx";
import { plain } from "./Spans.tsx";
import { DraftView, FeatureView, PrioritiesView } from "./views.ts";
import { Paragraph } from "./layout/Paragraph.tsx";

/** Each section's title, in the order the page shows them: a map, which the lint does not sort. */
const SECTIONS = new Map([
  ["now", "Now"],
  ["next", "Next"],
  ["later", "Later"],
  ["blocked", "Blocked"],
]);

const styles = stylex.create({
  line: {
    // The line, the view's title.
    fontSize: typeScaleVars["--text-heading-2-size"],
    fontWeight: fontWeightVars["--font-weight-semibold"],
    lineHeight: typeScaleVars["--text-heading-2-leading"],
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

/**
 * The page a task view was opened from, within its repository, which it returns to once its line
 * is deleted.
 */
function origin() {
  return currentEntry().from === "/" ? "/" : "/priorities";
}

/** A line's draft, drawn, with Edit, and Start the feature under the slug the human chose. */
function DraftPart({ path }: { path: string }) {
  const fate = useFateClient();
  const draft = useDraft(path);
  const here = useRepoPath();
  const [message, setMessage] = useState<string>();
  const [slug, setSlug] = useState(draft?.slug ?? "");
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
    const result = await fate.mutations.feature.start({
      input: { draft: path, slug },
      view: FeatureView,
    });
    if (result.error) {
      setMessage(refusal(result.error).message);
    } else if (typeof result.result?.folder === "string") {
      navigate(here(`/f/${result.result.folder}`));
    }
  };
  return (
    <VStack gap={3}>
      <Text color="secondary" type="supporting">
        {path.replace(/^specs\//, "")} · {draft.committed ? "committed" : "not committed"}
      </Text>
      <Blocks document={draft.document} ids={ids} />
      <TextInput
        description="Two words at most: it names the folder and the branch."
        label="Slug"
        onChange={(value: string) => setSlug(value)}
        value={slug}
      />
      <HStack gap={2}>
        <Button label="Edit" onClick={() => navigate(here(`/edit/${path}`))} />
        <Button clickAction={start} label="Start the feature" variant="primary" />
      </HStack>
      {message && <Banner collapsible={false} status="error" title={message} />}
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
  const { found, priorities } = usePriority(entryKey, renaming);
  const toast = useUndoToast();
  const here = useRepoPath();
  const repo = useRepository();
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
          collapsible={false}
          description={
            <Link hasUnderline href={here("/priorities")}>
              Open the priorities
            </Link>
          }
          status="error"
          title="This line is no longer in PRIORITIES.md."
        />
      </Page>
    );
  }
  const { entry, index, section } = found;
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
      input: { entry: entry.id, hash, text: next },
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
      redirect(here(`/priorities/${key}`));
    }
    return undefined;
  };

  const move = (to: string) =>
    run(() =>
      fate.mutations.priorities.move({
        input: { entry: entry.id, hash, index: Number.MAX_SAFE_INTEGER, section: to },
        view: PrioritiesView,
      }),
    );

  const draft = async () => {
    const result = await run(() =>
      fate.mutations.draft.create({ input: { hash, line: entry.id }, view: DraftView }),
    );
    const path = (result as { result?: { path?: unknown } }).result?.path;
    if (!result.error && typeof path === "string") {
      navigate(here(`/edit/${path}`));
    }
  };

  const remove = async () => {
    // What Undo writes back: the line's lines, nested ones included, exactly as they were.
    const lines = entry.lines;
    const at = { index, section: section.section };
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
          input: { ...at, hash: now, lines },
          view: PrioritiesView,
        });
        return restored.error ? failed : undefined;
      } catch {
        return failed;
      }
    });
    redirect(here(origin()));
  };

  const step = (to: number) =>
    navigate(here(`/priorities/${entries[to].key}`), { from: currentEntry().from });

  return (
    <Page>
      <VStack gap={4}>
        <Text color="secondary" type="supporting">
          {section.title} · {index + 1} of {entries.length}
        </Text>
        <div {...stylex.props(styles.line)}>
          <EditableLine display={text} label="Line" onSave={rename} value={entry.text} />
        </div>
        <SegmentedControl
          label="Section"
          onChange={(to: string) => void move(to)}
          value={section.section}
        >
          {[...SECTIONS].map(([id, title]) => (
            <SegmentedControlItem key={id} label={title} value={id} />
          ))}
        </SegmentedControl>
        {message && <Banner collapsible={false} status="error" title={message} />}
        <Divider />
        {link && isDraft(link) ? (
          <Suspense fallback={<Spinner label="Loading the draft" />}>
            <DraftPart path={link} />
          </Suspense>
        ) : link ? (
          <Paragraph>
            <Link hasUnderline href={pathLink(link, repo).href}>
              Open {link.replace(/^specs\//, "")}
            </Link>
          </Paragraph>
        ) : (
          <VStack gap={2}>
            <Paragraph color="secondary">No draft yet.</Paragraph>
            <HStack gap={2}>
              <Button clickAction={draft} label="Draft" variant="primary" />
            </HStack>
          </VStack>
        )}
        <HStack gap={2}>
          <Button clickAction={remove} label="Delete" variant="destructive" />
        </HStack>
        <Divider />
        <HStack gap={2} justify="between">
          <Button isDisabled={index === 0} label="‹ Previous" onClick={() => step(index - 1)} />
          <Button
            isDisabled={index === entries.length - 1}
            label="Next ›"
            onClick={() => step(index + 1)}
          />
        </HStack>
      </VStack>
    </Page>
  );
}
