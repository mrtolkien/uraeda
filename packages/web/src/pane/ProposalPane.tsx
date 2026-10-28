import { AnnouncedBanner } from "../layout/AnnouncedBanner.tsx";
import { Button } from "@astryxdesign/core/Button";
import { Divider } from "@astryxdesign/core/Divider";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { VStack } from "@astryxdesign/core/VStack";
import { useState } from "react";
import type { Span } from "uraeda-binding";
import { useProposal } from "../data.ts";
import { stepTitle } from "../labels.ts";
import { Paragraph } from "../layout/Paragraph.tsx";
import { pathLink } from "../links.tsx";
import { TITLES } from "../QuickAdd.tsx";
import { navigate, redirect, useRepoPath, useRepository } from "../routes.tsx";
import { useLineSave } from "../useLineSave.ts";
import { EntryPane, EntryText, RunningPart, Steps } from "./EntryPane.tsx";
import { type Found, useProposalActions } from "./useProposalActions.ts";
import { Empty } from "../layout/Empty.tsx";

/** The file a proposal links, from the repository's top level, if any. */
function linkOf(spans: ReadonlyArray<Span>) {
  return spans.find((span) => span.link?.path)?.link?.path;
}

/**
 * What the proposal is past its text, as the core says: running, a linked file, or nothing yet. A
 * proposal with a file opens that file's page instead: its route never draws this pane. Start opens
 * the New page, its composer holding the proposal: nothing starts before the human sends it.
 */
function Kind({ expand, found }: { expand: () => Promise<void>; found: Found }) {
  const here = useRepoPath();
  const repo = useRepository();
  const { proposal } = found;
  if (proposal.running) {
    return (
      <RunningPart
        href={here(`/f/${proposal.running.folder}`)}
        step={stepTitle(proposal.running.step)}
      />
    );
  }
  const link = linkOf(proposal.spans);
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
      <Empty>No file yet.</Empty>
      {/* A long label takes its own line rather than being cut. */}
      <HStack gap={2} wrap="wrap">
        <Button clickAction={expand} label="Expand" variant="primary" />
        <Button
          label="Start"
          onClick={() => navigate(here("/new?kind=feature"), { insert: `line:${proposal.id}` })}
          variant="secondary"
        />
      </HStack>
    </VStack>
  );
}

/**
 * A found proposal's pane: its text, what it is, its section unless it runs, Delete, and its
 * neighbours.
 */
function ProposalBody({
  found,
  hash,
  onRenaming,
}: {
  found: Found;
  hash: string;
  onRenaming: (id: string | undefined) => void;
}) {
  const here = useRepoPath();
  const { index, proposal, section } = found;
  const actions = useProposalActions(found, hash, onRenaming);
  const line = useLineSave({
    field: `priorities#${proposal.key}`,
    onSave: actions.rename,
    stayOpen: false,
    value: proposal.text,
  });
  const proposals = section.proposals;
  return (
    <EntryPane
      isEditing={line.open}
      location={`${section.title} · ${index + 1} of ${proposals.length}`}
      onDelete={actions.remove}
      onEdit={line.openLine}
      steps={
        <Steps
          count={proposals.length}
          index={index}
          // The overlay shows another proposal in its own history entry.
          onStep={(to) => redirect(here(`/priorities/${proposals[to].key}`))}
        />
      }
      text={
        <EntryText
          label="Proposal"
          line={line}
          nested={proposal.nestedSpans}
          spans={proposal.spans}
        />
      }
    >
      <Divider />
      <Kind expand={actions.expand} found={found} />
      {/* A running proposal does not move its branch: it has no section to pick. */}
      {!proposal.running && (
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
 * A proposal of `PRIORITIES.md` in its overlay, by its key: read-only on arrival, Edit in its bar.
 * A proposal that is not there draws nothing: the route says it is gone.
 */
export function ProposalPane({ proposalKey }: { proposalKey: string }) {
  // The proposal's id while it is renamed: its key changes before its address does.
  const [renaming, setRenaming] = useState<string>();
  const { found, priorities } = useProposal(proposalKey, renaming);
  if (!priorities || !found) {
    return null;
  }
  return <ProposalBody found={found} hash={priorities.hash} onRenaming={setRenaming} />;
}
