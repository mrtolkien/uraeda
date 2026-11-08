// The fate server module: fate's Vite plugin reads its exports to type the UI's client.
import { createFateServer, createLiveEventBus, type Entity, list } from "@nkzw/fate/server";
import type { Context as HonoContext } from "hono";
import type { Context } from "./fate/context.ts";
import { mutations } from "./fate/mutations.ts";
import { sources } from "./fate/sources.ts";
import type { Device } from "./sign-in/check.ts";
import {
  agentDataView,
  branchDecisionDataView,
  proposalFileDataView,
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
import { themesDataView } from "./fate/themes.ts";
import {
  extensionActionDataView,
  extensionRecordDataView,
  extensionsDataView,
} from "./fate/extensions.ts";
import { allBranchChangesDataView, branchChangesDataView } from "./fate/views-branch.ts";
import { continuedAllDataView } from "./fate/views-continued-all.ts";
import { droppedDataView } from "./fate/views-dropped.ts";
import { startPlanDataView } from "./fate/views-start-plan.ts";
import { undoDataView } from "./fate/views-undo.ts";
import { bufferDataView } from "./fate/views-buffer.ts";
import { historyDataView } from "./fate/views-history.ts";
import { ledgerDataView } from "./fate/views-ledger.ts";
import { folderSuggestionsDataView, repositoriesDataView } from "./fate/views-repositories.ts";
import { writeQueueDataView } from "./fate/write-queue.ts";
import {
  conflictFileDataView,
  gitCommitDataView,
  gitDiffDataView,
  gitHistoryPageDataView,
  gitPageDataView,
  gitSummaryDataView,
} from "./fate/views-git.ts";

export {
  agentDataView,
  allBranchChangesDataView,
  branchChangesDataView,
  branchDecisionDataView,
  bufferDataView,
  conflictFileDataView,
  continuedAllDataView,
  proposalFileDataView,
  droppedDataView,
  extensionActionDataView,
  extensionRecordDataView,
  extensionsDataView,
  featureDataView,
  fileDataView,
  folderSuggestionsDataView,
  gitCommitDataView,
  gitDiffDataView,
  gitHistoryPageDataView,
  gitPageDataView,
  gitSummaryDataView,
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
  startPlanDataView,
  storyDataView,
  storyHrefDataView,
  themesDataView,
  turnDataView,
  turnLogDataView,
  undoDataView,
  workflowMessageDataView,
  workspaceDataView,
  writeQueueDataView,
};
export {
  AGENT_ID,
  INBOX_ID,
  PRIORITIES_ID,
  PROPOSAL_HINTS_ID,
  SESSION_LIST_ID,
  WORKSPACE_ID,
} from "./fate/views.ts";
export { SETTINGS_ID } from "./fate/settings.ts";
export { THEMES_ID } from "./fate/themes.ts";
export { EXTENSIONS_ID } from "./fate/extensions.ts";
export { LEDGER_ID } from "./fate/views-ledger.ts";
export { ALL_BRANCH_CHANGES_ID } from "./fate/views-branch.ts";
export { REPOSITORIES_ID } from "./fate/views-repositories.ts";
export { WRITE_QUEUE_ID } from "./fate/write-queue.ts";
export { GIT_ID, gitDiffId } from "./fate/views-git.ts";

/** The types fate's generated client and the UI's views use, named after each view's type. */
export type Workspace = Entity<typeof workspaceDataView, "Workspace">;
export type Feature = Entity<typeof featureDataView, "Feature">;
export type BranchChanges = Entity<typeof branchChangesDataView, "BranchChanges">;
export type AllBranchChanges = Entity<typeof allBranchChangesDataView, "AllBranchChanges">;
export type History = Entity<typeof historyDataView, "History">;
/** A Markdown file under `specs/` in a buffer, by its path. */
export type Buffer = Entity<typeof bufferDataView, "Buffer">;
export type WorkflowFile = Entity<typeof fileDataView, "WorkflowFile">;
export type BranchDecision = Entity<typeof branchDecisionDataView, "BranchDecision">;
export type Priorities = Entity<typeof prioritiesDataView, "Priorities">;
/** A proposal of the priorities, as the record sends it. */
export type Proposal = Priorities["sections"][number]["proposals"][number];
export type Inbox = Entity<typeof inboxDataView, "Inbox">;
export type ProposalFile = Entity<typeof proposalFileDataView, "ProposalFile">;
export type Dropped = Entity<typeof droppedDataView, "Dropped">;
export type ContinuedAll = Entity<typeof continuedAllDataView, "ContinuedAll">;
export type StartPlan = Entity<typeof startPlanDataView, "StartPlan">;
/** An undo's or a redo's answer: see `undo-mutations.ts`. */
export type Undo = Entity<typeof undoDataView, "Undo">;
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
export type Themes = Entity<typeof themesDataView, "Themes">;
/** Every extension, built in or yours, with its state, settings, and problems. */
export type Extensions = Entity<typeof extensionsDataView, "Extensions">;
/** An extension's named record, `<extension>/<name>`, its value as JSON. */
export type ExtensionRecord = Entity<typeof extensionRecordDataView, "ExtensionRecord">;
/** An extension's action's answer, its output as JSON. */
export type ExtensionAction = Entity<typeof extensionActionDataView, "ExtensionAction">;
export type NeedsYouList = Entity<typeof needsYouListDataView, "NeedsYouList">;
export type WriteQueue = Entity<typeof writeQueueDataView, "WriteQueue">;
/** The Git page, read at once, with whether an agent works in each checkout. */
export type GitPage = Entity<typeof gitPageDataView, "GitPage">;
/** The sidebar's count: the main checkout's changes to commit, and the commits to pull. */
export type GitSummary = Entity<typeof gitSummaryDataView, "GitSummary">;
/** A file's diff, by `gitDiffId`. */
export type GitDiff = Entity<typeof gitDiffDataView, "GitDiff">;
export type GitCommit = Entity<typeof gitCommitDataView, "GitCommit">;
/** A page of the history, after the commit of its id. */
export type GitHistoryPage = Entity<typeof gitHistoryPageDataView, "GitHistoryPage">;
/** A conflicted text file of the main checkout, for the editor, by its path. */
export type ConflictFile = Entity<typeof conflictFileDataView, "ConflictFile">;
/** A write of the queue, and a step of a start's. */
export type { QueuedWrite, StartStep, WriteFailure } from "./writes/queue.ts";
export { NEEDS_YOU_ID } from "./fate/needs-you.ts";
/** What started a workflow turn, for `session.send`'s `workflow`. */
export type { Trigger } from "./runner/events.ts";
/** A turn's item, as a `TurnLog` page lists it. */
export type { Item } from "./runner/events.ts";
export type { Capabilities } from "./runner/adapter.ts";
/** An agent runtime, as the `Agent` record lists it, and one window of its usage. */
export type { RuntimeRecord } from "./runner/runtimes.ts";
export type { UsageWindow } from "./runner/events.ts";
export type { SessionStatus, StatusReason } from "./runner/status.ts";
/** A feature's status, as each `Workspace` feature and `Feature` record carries it. */
export type { FeatureStatus } from "./fate/feature-status.ts";
/** A chat image, as `POST /attach` answers it and `session.send` takes it. */
export type { ChatImage } from "./runner/images.ts";

/**
 * The variables of a request's Hono context: fate's context, and the signed-in device, set by the
 * session check when the app checks sessions.
 */
export type FateVariables = { device?: Device; fate: Context };

/**
 * The roots: the views', and the write queue's, Continue all's, and the Git page's, which live in
 * their own modules.
 */
export const Root = {
  ...Views,
  conflictFiles: list(conflictFileDataView),
  continuedAllList: list(continuedAllDataView),
  extensionActions: list(extensionActionDataView),
  extensionRecords: list(extensionRecordDataView),
  extensionsList: list(extensionsDataView),
  gitCommits: list(gitCommitDataView),
  gitDiffs: list(gitDiffDataView),
  gitHistoryPages: list(gitHistoryPageDataView),
  gitPages: list(gitPageDataView),
  gitSummaries: list(gitSummaryDataView),
  writeQueues: list(writeQueueDataView),
};

/** A live bus: the updates one fate server sends to the views subscribed to it. */
export type LiveBus = ReturnType<typeof createLiveEventBus>;

/** How long after a record's update a new subscription to it is still sent it. */
export const LIVE_REPLAY_MS = 2000;

/** A record's key in the live bus's times: its type and ID. */
const recordKey = (type: string, id: string | number) => `${type}\u0000${id}`;

/**
 * Live updates: the core's watcher marks what changed, and fate sends it to the views. A view reads
 * its data, then subscribes, a few milliseconds apart: a subscription to a record updated in the
 * last 2 seconds is sent it once, so a change made between the two is not missed until the next
 * one. A record that has not changed is not resolved again. `now` is the bus's clock, in ms. Each
 * update forgets the times past the window, so a record updated once is not remembered forever.
 */
export function liveBus(now: () => number = Date.now): LiveBus {
  const bus = createLiveEventBus();
  /** When each record, by its key, was last updated, the latest last. */
  const updated = new Map<string, number>();
  /** Whether the record changed within the replay window; a record's older time is forgotten. */
  const recent = (type: string, id: string | number) => {
    const at = updated.get(recordKey(type, id));
    if (at !== undefined && now() - at > LIVE_REPLAY_MS) {
      updated.delete(recordKey(type, id));
      return false;
    }
    return at !== undefined;
  };
  return {
    ...bus,
    listen(type, id, handler, options) {
      const stop = bus.listen!(type, id, handler, options);
      if (recent(type, id)) {
        setTimeout(() => {
          if (!options?.signal?.aborted) {
            handler({ id, type: "update" });
          }
        });
      }
      return stop;
    },
    update(type, id, options) {
      const at = now();
      // The times stay in the order they were set, the oldest first: those past the window go.
      for (const [key, time] of updated) {
        if (at - time <= LIVE_REPLAY_MS) {
          break;
        }
        updated.delete(key);
      }
      updated.delete(recordKey(type, id));
      updated.set(recordKey(type, id), at);
      bus.update(type, id, options);
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
