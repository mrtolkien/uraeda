import { AnnouncedBanner } from "../layout/AnnouncedBanner.tsx";
import { Button } from "@astryxdesign/core/Button";
import { Divider } from "@astryxdesign/core/Divider";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { VStack } from "@astryxdesign/core/VStack";
import { useState } from "react";
import type { Span } from "uraeda-binding";
import { usePriority } from "../data.ts";
import { stepTitle } from "../labels.ts";
import { Paragraph } from "../layout/Paragraph.tsx";
import { pathLink } from "../links.tsx";
import { TITLES } from "../QuickAdd.tsx";
import { navigate, redirect, useRepoPath, useRepository } from "../routes.tsx";
import { useLineSave } from "../useLineSave.ts";
import { EntryPane, EntryText, RunningPart, Steps } from "./EntryPane.tsx";
import { type Found, usePriorityActions } from "./usePriorityActions.ts";
import { Empty } from "../layout/Empty.tsx";

/** The file a line links, from the repository's top level, if any. */
function linkOf(spans: ReadonlyArray<Span>) {
  return spans.find((span) => span.link?.path)?.link?.path;
}

/**
 * What the entry is past its text, as the core says: running, a linked file, or nothing yet. A
 * line with a draft opens that draft's page instead: its route never draws this pane. Start opens
 * the New page, its composer holding the line: nothing starts before the human sends it.
 */
function Kind({ draft, found }: { draft: () => Promise<void>; found: Found }) {
  const here = useRepoPath();
  const repo = useRepository();
  const { entry } = found;
  if (entry.running) {
    return (
      <RunningPart href={here(`/f/${entry.running.folder}`)} step={stepTitle(entry.running.step)} />
    );
  }
  const link = linkOf(entry.spans);
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
      <Empty>No draft yet.</Empty>
      {/* A long label takes its own line rather than being cut. */}
      <HStack gap={2} wrap="wrap">
        <Button clickAction={draft} label="Draft" variant="primary" />
        <Button
          label="Start"
          onClick={() => navigate(here("/new?kind=feature"), { insert: `line:${entry.id}` })}
          variant="secondary"
        />
      </HStack>
    </VStack>
  );
}

/**
 * A found line's pane: its text, what it is, its section unless it runs, Delete, and its
 * neighbours.
 */
function PriorityBody({
  found,
  hash,
  onRenaming,
}: {
  found: Found;
  hash: string;
  onRenaming: (id: string | undefined) => void;
}) {
  const here = useRepoPath();
  const { entry, index, section } = found;
  const actions = usePriorityActions(found, hash, onRenaming);
  const line = useLineSave({
    field: `priorities#${entry.key}`,
    onSave: actions.rename,
    stayOpen: false,
    value: entry.text,
  });
  const entries = section.entries;
  return (
    <EntryPane
      isEditing={line.open}
      location={`${section.title} · ${index + 1} of ${entries.length}`}
      onDelete={actions.remove}
      onEdit={line.openLine}
      steps={
        <Steps
          count={entries.length}
          index={index}
          // The overlay shows another line in its own history entry.
          onStep={(to) => redirect(here(`/priorities/${entries[to].key}`))}
        />
      }
      text={<EntryText label="Line" line={line} nested={entry.nestedSpans} spans={entry.spans} />}
    >
      <Divider />
      <Kind draft={actions.draft} found={found} />
      {/* A running entry's line does not move its branch: it has no section to pick. */}
      {!entry.running && (
        <>
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
        </>
      )}
      {actions.message && (
        <AnnouncedBanner collapsible={false} status="error" title={actions.message} />
      )}
    </EntryPane>
  );
}

/**
 * A line of `PRIORITIES.md` in its overlay, by its key: read-only on arrival, Edit in its bar. A
 * line that is not there draws nothing: the route says it is gone.
 */
export function PriorityPane({ entryKey }: { entryKey: string }) {
  // The line's id while it is renamed: its key changes before its address does.
  const [renaming, setRenaming] = useState<string>();
  const { found, priorities } = usePriority(entryKey, renaming);
  if (!priorities || !found) {
    return null;
  }
  return <PriorityBody found={found} hash={priorities.hash} onRenaming={setRenaming} />;
}
