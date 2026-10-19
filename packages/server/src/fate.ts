// The fate server module: fate's Vite plugin reads its exports to type the UI's client.
import { createFateServer, createLiveEventBus, type Entity } from "@nkzw/fate/server";
import type { Context as HonoContext } from "hono";
import type { Context } from "./fate/context.ts";
import { mutations } from "./fate/mutations.ts";
import { sources } from "./fate/sources.ts";
import type { Device } from "./sign-in/check.ts";
import {
  agentDataView,
  branchDecisionDataView,
  draftDataView,
  featureDataView,
  fileDataView,
  inboxDataView,
  prioritiesDataView,
  proposalHintsDataView,
  Root as Views,
  sessionDataView,
  sessionListDataView,
  sessionSearchDataView,
  slugProposalDataView,
  turnDataView,
  turnLogDataView,
  workflowMessageDataView,
  workspaceDataView,
} from "./fate/views.ts";
import { needsYouListDataView } from "./fate/needs-you.ts";
import { previewDataView, storyDataView, storyHrefDataView } from "./fate/preview.ts";
import { recommendedDataView } from "./fate/recommended.ts";
import { settingsDataView } from "./fate/settings.ts";
import { branchChangesDataView } from "./fate/views-branch.ts";
import { historyDataView } from "./fate/views-history.ts";
import { ledgerDataView } from "./fate/views-ledger.ts";
import { folderSuggestionsDataView, repositoriesDataView } from "./fate/views-repositories.ts";

export {
  agentDataView,
  branchChangesDataView,
  branchDecisionDataView,
  draftDataView,
  featureDataView,
  fileDataView,
  folderSuggestionsDataView,
  historyDataView,
  inboxDataView,
  ledgerDataView,
  needsYouListDataView,
  previewDataView,
  prioritiesDataView,
  proposalHintsDataView,
  recommendedDataView,
  repositoriesDataView,
  sessionDataView,
  sessionListDataView,
  sessionSearchDataView,
  settingsDataView,
  slugProposalDataView,
  storyDataView,
  storyHrefDataView,
  turnDataView,
  turnLogDataView,
  workflowMessageDataView,
  workspaceDataView,
};
export {
  AGENT_ID,
  INBOX_ID,
  PRIORITIES_ID,
  PROPOSAL_HINTS_ID,
  SESSION_LIST_ID,
  DECISIONS_CHECK_ID,
  DEFAULT_ROUND_FILES,
  DEFAULT_ROUND_IDS,
  TRIAGE_ID,
  WORKSPACE_ID,
} from "./fate/views.ts";
export { SETTINGS_ID } from "./fate/settings.ts";
export { LEDGER_ID } from "./fate/views-ledger.ts";
export { REPOSITORIES_ID } from "./fate/views-repositories.ts";

/** The types fate's generated client and the UI's views use, named after each view's type. */
export type Workspace = Entity<typeof workspaceDataView, "Workspace">;
export type Feature = Entity<typeof featureDataView, "Feature">;
export type BranchChanges = Entity<typeof branchChangesDataView, "BranchChanges">;
export type History = Entity<typeof historyDataView, "History">;
export type WorkflowFile = Entity<typeof fileDataView, "WorkflowFile">;
export type BranchDecision = Entity<typeof branchDecisionDataView, "BranchDecision">;
export type Priorities = Entity<typeof prioritiesDataView, "Priorities">;
/** An entry of the priorities, as the record sends it. */
export type PriorityEntry = Priorities["sections"][number]["entries"][number];
export type Inbox = Entity<typeof inboxDataView, "Inbox">;
export type Draft = Entity<typeof draftDataView, "Draft">;
export type Ledger = Entity<typeof ledgerDataView, "Ledger">;
export type ProposalHints = Entity<typeof proposalHintsDataView, "ProposalHints">;
export type Agent = Entity<typeof agentDataView, "Agent">;
export type Session = Entity<typeof sessionDataView, "Session">;
export type Turn = Entity<typeof turnDataView, "Turn">;
export type TurnLog = Entity<typeof turnLogDataView, "TurnLog">;
export type SessionList = Entity<typeof sessionListDataView, "SessionList">;
export type SessionSearch = Entity<typeof sessionSearchDataView, "SessionSearch">;
export type WorkflowMessage = Entity<typeof workflowMessageDataView, "WorkflowMessage">;
export type RecommendedMessage = Entity<typeof recommendedDataView, "RecommendedMessage">;
export type Repositories = Entity<typeof repositoriesDataView, "Repositories">;
export type SlugProposal = Entity<typeof slugProposalDataView, "SlugProposal">;
export type FolderSuggestions = Entity<typeof folderSuggestionsDataView, "FolderSuggestions">;
export type Story = Entity<typeof storyDataView, "Story">;
export type Preview = Entity<typeof previewDataView, "Preview">;
export type StoryHref = Entity<typeof storyHrefDataView, "StoryHref">;
export type Settings = Entity<typeof settingsDataView, "Settings">;
export type NeedsYouList = Entity<typeof needsYouListDataView, "NeedsYouList">;
export { NEEDS_YOU_ID } from "./fate/needs-you.ts";
/** What started a workflow turn, for `session.send`'s `workflow`. */
export type { Trigger } from "./runner/events.ts";
/** A turn's item, as a `TurnLog` page lists it. */
export type { Item } from "./runner/events.ts";
export type { Capabilities } from "./runner/adapter.ts";
export type { SessionStatus, StatusReason } from "./runner/status.ts";
/** A chat image, as `POST /attach` answers it and `session.send` takes it. */
export type { ChatImage } from "./runner/images.ts";

/**
 * The variables of a request's Hono context: fate's context, and the signed-in device, set by the
 * session check when the app checks sessions.
 */
export type FateVariables = { device?: Device; fate: Context };

export const Root = Views;

/** A live bus: the updates one fate server sends to the views subscribed to it. */
export type LiveBus = ReturnType<typeof createLiveEventBus>;

/**
 * Live updates: the core's watcher marks what changed, and fate sends it to the views. A view reads
 * its data, then subscribes: each subscription is sent the current data once, so a change made
 * between the two is not missed until the next one.
 */
function liveBus(): LiveBus {
  const bus = createLiveEventBus();
  return {
    ...bus,
    listen(type, id, handler, options) {
      const stop = bus.listen!(type, id, handler, options);
      setTimeout(() => {
        if (!options?.signal?.aborted) {
          handler({ id, type: "update" });
        }
      });
      return stop;
    },
  };
}

/**
 * A fate server with its own live bus: one per repository, so a change in one repository sends no
 * update to the views of another. Each request brings its context, set by `createApp`.
 */
export function createFate() {
  const live = liveBus();
  const fateServer = createFateServer({
    context: ({ adapterContext }: { adapterContext?: HonoContext<{ Variables: FateVariables }> }) =>
      adapterContext!.get("fate"),
    live,
    mutations,
    roots: Root,
    sources,
  });
  return { fateServer, live };
}

export type FateServer = ReturnType<typeof createFate>["fateServer"];

const global = createFate();

/** The global endpoint's live bus, `/fate/live`. */
export const live: LiveBus = global.live;

/** The global endpoint's fate server, `/fate`, whose type fate's Vite plugin reads for the UI. */
export const fateServer = global.fateServer;
