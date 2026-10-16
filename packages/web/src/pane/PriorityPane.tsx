import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Divider } from "@astryxdesign/core/Divider";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Spinner } from "@astryxdesign/core/Spinner";
import { VStack } from "@astryxdesign/core/VStack";
import { Suspense, useEffect } from "react";
import type { Span } from "uraeda-binding";
import { usePriority, useWorkspace } from "../data.ts";
import { stepLabel, waiting } from "../labels.ts";
import { Paragraph } from "../layout/Paragraph.tsx";
import { TITLES } from "../QuickAdd.tsx";
import { currentEntry, navigate, pathLink, useRepoPath, useRepository } from "../routes.tsx";
import { useLineSave } from "../useLineSave.ts";
import { EntryPane, EntryText, RunningPart, Steps } from "./EntryPane.tsx";
import { PaneDraft } from "./PaneDraft.tsx";
import { type Found, usePriorityActions } from "./usePriorityActions.ts";

/** The file a line links, from the repository's top level, if any. */
function linkOf(spans: ReadonlyArray<Span>) {
  return spans.find((span) => span.link?.path)?.link?.path;
}

/** Whether a path is a draft, or a postponed proposal, which the editor opens. */
function isDraft(path: string) {
  return /^specs\/(drafts|backlog)\/.+\.md$/.test(path);
}

/** The started feature a line links, by its proposal's folder: `specs/<folder>/proposal.md`. */
function useRunning(link: string | undefined) {
  const workspace = useWorkspace();
  const folder = link?.match(/^specs\/(?:changes\/)?([^/]+)\/proposal\.md$/)?.[1];
  return folder ? workspace?.features.find((feature) => feature.folder === folder) : undefined;
}

/**
 * The line's field, open from the start with `editing` typed in it when given: the Editing story's
 * state. Its text is forgotten as the story leaves, so the reading one never finds it restored.
 */
function useStoryEditing(line: ReturnType<typeof useLineSave>, editing: string | undefined) {
  // As the story draws: the line it opens is the one it leaves.
  useEffect(() => {
    if (editing === undefined) {
      return undefined;
    }
    line.openLine();
    line.change(editing);
    return () => line.drop();
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- once, on the first drawing only
  }, []);
}

/** What the entry is past its text: running, drafted, a linked file, or nothing yet. */
function Kind({ draft, found }: { draft: () => Promise<void>; found: Found }) {
  const here = useRepoPath();
  const repo = useRepository();
  const link = linkOf(found.entry.spans);
  const running = useRunning(link);
  if (running) {
    // At a human gate, what the gate asks, like "Review the spec"; else the agent's step.
    const step =
      running.step.waitsOn === "human" ? waiting(running).title : stepLabel(running.step.name);
    return <RunningPart href={here(`/f/${running.folder}`)} step={step} />;
  }
  if (link && isDraft(link)) {
    return (
      <Suspense fallback={<Spinner label="Loading the draft" />}>
        <PaneDraft path={link} />
      </Suspense>
    );
  }
  if (link) {
    return (
      <Paragraph>
        <Link hasUnderline href={pathLink(link, repo).href}>
          Open {link.replace(/^specs\//, "")}
        </Link>
      </Paragraph>
    );
  }
  return (
    <VStack gap={2}>
      <Paragraph color="secondary">No draft yet.</Paragraph>
      <HStack gap={2}>
        <Button clickAction={draft} label="Draft" variant="primary" />
      </HStack>
    </VStack>
  );
}

/** A found line's pane: its text, what it is, its section, Delete, and its neighbours. */
function PriorityBody({
  editing,
  found,
  hash,
  onClose,
}: {
  editing?: string;
  found: Found;
  hash: string;
  onClose?: () => void;
}) {
  const here = useRepoPath();
  const { entry, index, section } = found;
  const actions = usePriorityActions(found, hash);
  const line = useLineSave({
    field: editing === undefined ? `priorities#${entry.key}` : `story-editing#${entry.key}`,
    onSave: actions.rename,
    stayOpen: false,
    value: entry.text,
  });
  useStoryEditing(line, editing);
  const link = linkOf(entry.spans);
  const entries = section.entries;
  return (
    <EntryPane
      draftHref={link && isDraft(link) ? here(`/edit/${link}`) : undefined}
      line={line}
      location={`${section.title} · ${index + 1} of ${entries.length}`}
      onClose={onClose}
      onDelete={actions.remove}
      steps={
        <Steps
          count={entries.length}
          index={index}
          onStep={(to) =>
            navigate(here(`/priorities/${entries[to].key}`), { from: currentEntry().from })
          }
        />
      }
      text={<EntryText label="Line" line={line} nested={entry.nestedSpans} spans={entry.spans} />}
    >
      <Divider />
      <Kind draft={actions.draft} found={found} />
      <Divider />
      <SegmentedControl
        label="Section"
        onChange={(to: string) => void actions.move(to)}
        value={section.section}
      >
        {[...TITLES].map(([id, title]) => (
          <SegmentedControlItem key={id} label={title} value={id} />
        ))}
      </SegmentedControl>
      {actions.message && <Banner collapsible={false} status="error" title={actions.message} />}
    </EntryPane>
  );
}

/**
 * A line of `PRIORITIES.md` in the pane, by its key: read-only on arrival, Edit in its bar.
 * `editing`, for the stories, opens it with that text typed.
 */
export function PriorityPane({
  editing,
  entryKey,
  onClose,
}: {
  editing?: string;
  entryKey: string;
  onClose?: () => void;
}) {
  const { found, priorities } = usePriority(entryKey);
  const here = useRepoPath();
  if (!priorities) {
    return null;
  }
  if (!found) {
    return (
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
    );
  }
  return <PriorityBody editing={editing} found={found} hash={priorities.hash} onClose={onClose} />;
}
