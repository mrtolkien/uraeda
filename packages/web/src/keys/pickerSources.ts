// What the key picker lists: one source per kind of thing, each item with its address and its raw
// markdown preview. The picker reads only what its kind needs, in one request, once it is opened
// (never while closed, so no page waits on it); a feature's and a change's proposal comes in one
// more request after the list, as a batch of the files, and joins the previews when it arrives.
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useFateClient, useLiveView, view, type ViewRef } from "react-fate";
import type { WorkflowFile } from "uraeda-server/fate";
import { INBOX_ID, LEDGER_ID, PRIORITIES_ID, useWorkspace, WORKSPACE_ID } from "../data.ts";
import { jumpEntries, pickerItemOf } from "../decisions/jump.ts";
import { sessionIdPath } from "../routes.tsx";
import { SESSION_LIST_ID } from "../sessionData.ts";
import { InboxView, LedgerView, PrioritiesView, SessionListView, WorkspaceView } from "../views.ts";
import { type Row, sessionCard, toCard } from "../sidebar/cards.ts";
import type { CardItem } from "../sidebar/ItemCard.tsx";
import { KIND_ICONS } from "./kinds.ts";
import type { IconName } from "./store.ts";

export type PickerKind = "features" | "changes" | "sessions" | "decisions" | "notes" | "priorities";

export type PickerItem = {
  /**
   * A feature's, a change's, or a session's card, as the sidebar draws it: the row shows its icon,
   * its step's for a feature, and its status's mark, the agent's at work on it, as the card does.
   */
  card?: CardItem;
  /** The font its preview is written in, a font's in the font picker; the code's otherwise. */
  family?: string;
  icon: IconName;
  /** An address, which the kind's page is at: unique among the items. */
  id: string;
  kind: PickerKind;
  /** What the row shows in the place of its icon, as a principle's numeral. */
  mark?: string;
  /** Where Enter goes, from the repository's top level. */
  path: string;
  /** The raw markdown shown beside the list. */
  preview: string;
  /** A first sentence, which a search reads after the title. */
  summary?: string | null;
  title: string;
};

/** A proposal's text alone: the picker's previews do not need the rest of the file. */
const ProposalTextView = view<WorkflowFile>()({
  current: { text: true },
  id: true,
  missing: true,
});

const PROPOSAL = "proposal.md";

/** What a feature's or a change's preview says when its proposal could not be read. */
export const PROPOSAL_FAILED = "Could not load the proposal.";

/** The proposals read: by folder, and the folders whose proposal could not be read. */
type Proposals = { failed: ReadonlySet<string>; texts: ReadonlyMap<string, string> };

/** One proposal's folder and raw text, as read from its record. */
type ProposalText = { folder: string; text: string };

/**
 * Reads each ref, in turn, until `isCurrent` says nobody waits for them any more (then `null`).
 * A ref that cannot be read does not discard the others: the folders with no text at the end are
 * the `failed` ones, only when a read failed.
 */
export async function readProposals<Ref>(
  folders: ReadonlyArray<string>,
  refs: ReadonlyArray<Ref>,
  read: (ref: Ref) => Promise<ProposalText>,
  isCurrent: () => boolean,
): Promise<Proposals | null> {
  const texts = new Map<string, string>();
  let isFailed = false;
  for (const ref of refs) {
    if (!isCurrent()) {
      return null;
    }
    try {
      const { folder, text } = await read(ref);
      texts.set(folder, text);
    } catch {
      isFailed = true;
    }
  }
  const failed = isFailed ? folders.filter((folder) => !texts.has(folder)) : [];
  return { failed: new Set(failed), texts };
}

/**
 * The raw proposals of the folders, by folder, in one request once asked for and again when the
 * list changes; empty until they arrive, and `failed` where the request or a read failed.
 */
function useProposals(folders: ReadonlyArray<string>): Proposals {
  const fate = useFateClient();
  const [read, setRead] = useState<{ key: string } & Proposals>();
  const key = folders.join("\n");
  useEffect(() => {
    if (key === "") {
      return;
    }
    let current = true;
    const names = key.split("\n");
    const ids = names.map((folder) => `${folder}/${PROPOSAL}`);
    void (async () => {
      const { workflowFile } = await fate.request({
        workflowFile: { ids, view: ProposalTextView },
      });
      const result = await readProposals(
        names,
        workflowFile as ReadonlyArray<Parameters<typeof fate.readView>[1]>,
        async (ref) => {
          // fate types a root's records as any entity: the view gives the files' fields.
          const { data } = (await fate.readView(ProposalTextView, ref)) as unknown as {
            data: { current: { text: string } | null; id: string };
          };
          return {
            folder: data.id.slice(0, -`/${PROPOSAL}`.length),
            text: data.current?.text ?? "",
          };
        },
        () => current,
      );
      if (current && result !== null) {
        setRead({ key, ...result });
      }
    })().catch(() => {
      if (current) {
        setRead({ failed: new Set(names), key, texts: NO_TEXTS });
      }
    });
    return () => {
      current = false;
    };
  }, [fate, key]);
  return read?.key === key ? read : { failed: NO_FAILED, texts: NO_TEXTS };
}

const NO_TEXTS: ReadonlyMap<string, string> = new Map();
const NO_FAILED: ReadonlySet<string> = new Set();

type Workspace = NonNullable<ReturnType<typeof useWorkspace>>;
type Records = {
  inbox?: ViewRef<"Inbox">;
  ledger?: ViewRef<"Ledger">;
  priorities?: ViewRef<"Priorities">;
  sessionList?: ViewRef<"SessionList">;
  workspace?: ViewRef<"Workspace">;
};

/**
 * The features and changes, the kind asked for, each previewed as its proposal, with its card as
 * the sidebar draws it, the session at work on it from `rows`.
 */
function featureItems(
  workspace: Workspace | undefined,
  proposals: Proposals,
  rows: ReadonlyArray<Row>,
): Array<PickerItem> {
  return (workspace?.features ?? []).map((feature) => {
    const isChange = feature.kind === "change";
    return {
      card: toCard(
        feature,
        rows.find((row) => row.folder === feature.folder),
      ),
      icon: KIND_ICONS[isChange ? "changes" : "features"],
      id: `/f/${encodeURIComponent(feature.folder)}`,
      kind: isChange ? "changes" : "features",
      path: `/f/${encodeURIComponent(feature.folder)}`,
      preview:
        proposals.texts.get(feature.folder) ??
        (proposals.failed.has(feature.folder) ? PROPOSAL_FAILED : ""),
      title: feature.title,
    };
  });
}

/**
 * The sessions, the live ones first and the archived after them (the same row says which), each
 * previewed as its title, its state, and its branch, three plain lines.
 */
function sessionItems(
  rows: ReadonlyArray<Row>,
  workspace: Workspace | undefined,
): Array<PickerItem> {
  const branches = new Map(workspace?.features.map((feature) => [feature.folder, feature.branch]));
  return [...rows.filter((row) => !row.archived), ...rows.filter((row) => row.archived)].map(
    (row): PickerItem => {
      const branch = row.folder === null ? workspace?.currentBranch : branches.get(row.folder);
      const state = row.archived ? `Archived · ${row.statusLabel}` : row.statusLabel;
      return {
        card: sessionCard(row),
        icon: KIND_ICONS.sessions,
        id: sessionIdPath(row.id),
        kind: "sessions",
        path: sessionIdPath(row.id),
        preview: [row.title, state, branch ?? "no branch"].join("\n"),
        title: row.title,
      };
    },
  );
}

/** What `usePickerItems` gives back: the items, and how the read of them went. */
export type PickerRead = {
  /** The error the read failed with, if it did. */
  error: unknown;
  /** Whether the records are read: the items are all there are, not those so far. */
  isReady: boolean;
  items: ReadonlyArray<PickerItem>;
  /** Reads the records again, after a failure. */
  refetch: () => Promise<unknown>;
};

/**
 * The items of a kind, or of every kind, in the order the kinds are named, once `isEnabled`:
 * nothing is read before, and never by suspending, so the picker's dialog shows while the one
 * request, which holds what the kind needs and nothing else, is under way. Empty until it ends.
 */
export function usePickerItems(kind: PickerKind | "all", isEnabled: boolean): PickerRead {
  const is = (...kinds: Array<PickerKind>) => kind === "all" || kinds.includes(kind);
  const fate = useFateClient();
  // The request's state, observed outside Suspense: it starts as the first reader subscribes, and
  // ends as the last leaves. The request depends on `kind` alone, so the observer is kept per kind.
  const observer = useMemo(
    () =>
      fate.observeRequest(
        {
          ...(is("features", "changes", "sessions") && {
            workspace: { id: WORKSPACE_ID, view: WorkspaceView },
          }),
          // The sessions, and the ones at work on a feature or a change, whose card shows its agent.
          ...(is("features", "changes", "sessions") && {
            sessionList: { id: SESSION_LIST_ID, view: SessionListView },
          }),
          ...(is("decisions") && { ledger: { id: LEDGER_ID, view: LedgerView } }),
          ...(is("notes") && { inbox: { id: INBOX_ID, view: InboxView } }),
          ...(is("priorities") && { priorities: { id: PRIORITIES_ID, view: PrioritiesView } }),
        } as never,
        { enabled: isEnabled },
      ),
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- `is` reads `kind` only
    [fate, kind, isEnabled],
  );
  const state = useSyncExternalStore(observer.subscribe, observer.getSnapshot);
  const records = (state.data ?? {}) as unknown as Records;
  const workspace = useLiveView(WorkspaceView, records.workspace);
  const sessionList = useLiveView(SessionListView, records.sessionList);
  const ledger = useLiveView(LedgerView, records.ledger);
  const inbox = useLiveView(InboxView, records.inbox);
  const priorities = useLiveView(PrioritiesView, records.priorities);
  const folders = is("features", "changes")
    ? (workspace?.features ?? [])
        .filter((feature) => feature.files.some((file) => file.name === PROPOSAL))
        .map((feature) => feature.folder)
    : [];
  const proposals = useProposals(folders);
  const features = featureItems(workspace, proposals, sessionList?.rows ?? []);
  const items = [
    ...features.filter((item) => item.kind === "features" && is("features")),
    ...features.filter((item) => item.kind === "changes" && is("changes")),
    ...(is("sessions") ? sessionItems(sessionList?.rows ?? [], workspace) : []),
    ...(ledger ? jumpEntries(ledger, ledger.decisions).map(pickerItemOf) : []),
    ...(inbox?.categories ?? []).flatMap((category) =>
      category.notes.map((note): PickerItem => ({
        icon: KIND_ICONS.notes,
        id: `/inbox/${encodeURIComponent(note.key)}`,
        kind: "notes",
        path: `/inbox/${encodeURIComponent(note.key)}`,
        preview: note.text,
        title: note.text,
      })),
    ),
    ...(priorities?.sections ?? []).flatMap((section) =>
      section.proposals.map((proposal): PickerItem => ({
        icon: KIND_ICONS.priorities,
        id: `/priorities/${encodeURIComponent(proposal.key)}`,
        kind: "priorities",
        path: `/priorities/${encodeURIComponent(proposal.key)}`,
        preview: proposal.lines.join("\n"),
        title: proposal.text,
      })),
    ),
  ];
  return {
    error: state.error,
    isReady: state.status === "ready",
    items: state.status === "ready" ? items : [],
    refetch: state.refetch,
  };
}
