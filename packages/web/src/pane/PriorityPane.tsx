import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Divider } from "@astryxdesign/core/Divider";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Spinner } from "@astryxdesign/core/Spinner";
import { VStack } from "@astryxdesign/core/VStack";
import { Suspense, useState } from "react";
import type { Span } from "uraeda-binding";
import { usePriority } from "../data.ts";
import { stepTitle } from "../labels.ts";
import { Page } from "../layout/Page.tsx";
import { Paragraph } from "../layout/Paragraph.tsx";
import { pathLink } from "../links.tsx";
import { TITLES } from "../QuickAdd.tsx";
import {
  currentEntry,
  navigate,
  useRepoPath,
  useRepository,
  useRestoreScroll,
} from "../routes.tsx";
import { useLineSave } from "../useLineSave.ts";
import { EntryPane, EntryText, RunningPart, Steps } from "./EntryPane.tsx";
import { PaneDraft } from "./PaneDraft.tsx";
import { type Found, usePriorityActions } from "./usePriorityActions.ts";

/** The file a line links, from the repository's top level, if any. */
function linkOf(spans: ReadonlyArray<Span>) {
  return spans.find((span) => span.link?.path)?.link?.path;
}

/**
 * What the entry is past its text, as the core says: running, drafted, a linked file, or nothing
 * yet. A draft shows its text to edit while the entry is edited (`isEditing`).
 */
function Kind({
  draft,
  found,
  isEditing,
}: {
  draft: () => Promise<void>;
  found: Found;
  isEditing: boolean;
}) {
  const here = useRepoPath();
  const repo = useRepository();
  const { entry } = found;
  if (entry.running) {
    return (
      <RunningPart href={here(`/f/${entry.running.folder}`)} step={stepTitle(entry.running.step)} />
    );
  }
  if (entry.draft) {
    return (
      <Suspense fallback={<Spinner label="Loading the draft" />}>
        <PaneDraft isEditing={isEditing} path={entry.draft.path} />
      </Suspense>
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
      <Paragraph color="secondary">No draft yet.</Paragraph>
      <HStack gap={2}>
        <Button clickAction={draft} label="Draft" variant="primary" />
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
  onClose,
  onRenaming,
}: {
  found: Found;
  hash: string;
  onClose?: () => void;
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
      draftHref={entry.draft ? here(`/edit/${entry.draft.path}`) : undefined}
      isEditing={line.open}
      location={`${section.title} · ${index + 1} of ${entries.length}`}
      onClose={onClose}
      onDelete={actions.remove}
      onEdit={line.openLine}
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
      <Kind draft={actions.draft} found={found} isEditing={line.open} />
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
      {actions.message && <Banner collapsible={false} status="error" title={actions.message} />}
    </EntryPane>
  );
}

/**
 * A line of `PRIORITIES.md` in the pane, by its key: read-only on arrival, Edit in its bar. On
 * narrow screens, the page itself.
 */
export function PriorityPane({ entryKey, onClose }: { entryKey: string; onClose?: () => void }) {
  // The line's id while it is renamed: its key changes before its address does.
  const [renaming, setRenaming] = useState<string>();
  const { found, priorities } = usePriority(entryKey, renaming);
  const here = useRepoPath();
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
  return (
    <PriorityBody found={found} hash={priorities.hash} onClose={onClose} onRenaming={setRenaming} />
  );
}
