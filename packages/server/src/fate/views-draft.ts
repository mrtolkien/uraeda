// The data views of a draft or a proposal in its editor: its text and what the core reads of it,
// the proposal template's guidance, and the slug the core proposes for a typed change.
import { dataView } from "@nkzw/fate/server";
import type { DraftView, ProposalHint } from "uraeda-binding";
import type { Record_ } from "./views.ts";

export type DraftRecord = Record_<DraftView> & { id: string };
/** The proposal template's guidance, by heading, which the editor shows in empty sections. */
export type ProposalHintsRecord = { hints: Array<Record_<ProposalHint>>; id: string };

/** The slug the core proposes for a typed change, whose text is its ID: "New change" shows it. */
export type SlugProposalRecord = { id: string; slug: string };

export const draftDataView = dataView<DraftRecord>("Draft")({
  committed: true,
  discovery: true,
  discoveryLevels: true,
  document: true,
  emptySections: true,
  entry: true,
  folder: true,
  hash: true,
  id: true,
  kind: true,
  mockups: true,
  path: true,
  priorityChanges: true,
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
  id: true,
  slug: true,
});
