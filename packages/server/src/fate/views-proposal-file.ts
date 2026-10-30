// The data views of a proposal file or a started proposal in its editor: its text and what the core
// reads of it, the proposal template's guidance, and the slug the core proposes for a typed change.
import { dataView } from "@nkzw/fate/server";
import type { ProposalFileView, ProposalHint } from "uraeda-binding";
import type { Record_ } from "./views.ts";

export type ProposalFileRecord = Record_<ProposalFileView> & { id: string };

/**
 * A proposal file as sent: the fields the core leaves out when it has none are sent as null, as
 * `sentFile` does for a workflow file, since fate counts a field left out as missing and reads the
 * record again, as the editor did after every draft.
 */
export function sentProposalFile(record: ProposalFileRecord): ProposalFileRecord {
  const proposal = record.proposal && { feature: null, file: null, link: null, ...record.proposal };
  const cleared = { discovery: null, folder: null, proposal: null, slug: null };
  return {
    ...cleared,
    ...record,
    ...(proposal ? { proposal } : {}),
  } as unknown as ProposalFileRecord;
}
/** The proposal template's guidance, by heading, which the editor shows in empty sections. */
export type ProposalHintsRecord = { hints: Array<Record_<ProposalHint>>; id: string };

/**
 * The slug the core proposes for a typed start, whose text is its ID, and the research efforts a
 * feature may ask for: the New page's start dialog shows them.
 */
export type SlugProposalRecord = { discoveryLevels: Array<string>; id: string; slug: string };

export const proposalFileDataView = dataView<ProposalFileRecord>("ProposalFile")({
  committed: true,
  discovery: true,
  discoveryLevels: true,
  document: true,
  emptySections: true,
  folder: true,
  hash: true,
  id: true,
  kind: true,
  mockups: true,
  path: true,
  priorityChanges: true,
  proposal: true,
  slug: true,
  stories: true,
  text: true,
  title: true,
  written: true,
});

export const proposalHintsDataView = dataView<ProposalHintsRecord>("ProposalHints")({
  hints: true,
  id: true,
});

export const slugProposalDataView = dataView<SlugProposalRecord>("SlugProposal")({
  discoveryLevels: true,
  id: true,
  slug: true,
});
