// What the key picker lists: one source per kind of thing, each item with its address and its raw
// markdown preview. The picker reads only what its kind needs, in one request, once it is opened
// (never while closed, so no page waits on it); a feature's and a change's proposal comes in one
// more request after the list, as a batch of the files, and joins the previews when it arrives.
import { useEffect, useState } from "react";
import { useFateClient, useLiveView, useRequest, view, type ViewRef } from "react-fate";
import type { WorkflowFile } from "uraeda-server/fate";
import { INBOX_ID, LEDGER_ID, PRIORITIES_ID, useWorkspace, WORKSPACE_ID } from "../data.ts";
import { DESTINATIONS } from "../destinations.ts";
import { jumpEntries, pickerItemOf } from "../decisions/jump.ts";
import { sessionIdPath } from "../routes.tsx";
import { SESSION_LIST_ID } from "../sessionData.ts";
import { InboxView, LedgerView, PrioritiesView, SessionListView, WorkspaceView } from "../views.ts";
import type { IconName } from "./store.ts";

export type PickerKind = "features" | "changes" | "sessions" | "decisions" | "notes" | "priorities";

export type PickerItem = {
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

/** The name of each kind, in the rows of a picker over several. */
export const KIND_LABELS: Record<PickerKind, string> = {
  changes: "Change",
  decisions: "Decision",
  features: "Feature",
  notes: "Note",
  priorities: "Priority",
  sessions: "Session",
};

/** A proposal's text alone: the picker's previews do not need the rest of the file. */
const ProposalTextView = view<WorkflowFile>()({
  current: { text: true },
  id: true,
  missing: true,
});

const PROPOSAL = "proposal.md";

/**
 * The raw proposals of the folders, by folder, in one request once asked for and again when the
 * list changes; empty until they arrive.
 */
function useProposals(folders: ReadonlyArray<string>): ReadonlyMap<string, string> {
  const fate = useFateClient();
  const [read, setRead] = useState<{ key: string; texts: ReadonlyMap<string, string> }>();
  const key = folders.join("\n");
  useEffect(() => {
    if (key === "") {
      return;
    }
    let current = true;
    const ids = key.split("\n").map((folder) => `${folder}/${PROPOSAL}`);
    void (async () => {
      const { workflowFile } = await fate.request({
        workflowFile: { ids, view: ProposalTextView },
      });
      const texts = new Map<string, string>();
      for (const ref of workflowFile as ReadonlyArray<Parameters<typeof fate.readView>[1]>) {
        // fate types a root's records as any entity: the view gives the files' fields.
        const { data } = (await fate.readView(ProposalTextView, ref)) as unknown as {
          data: { current: { text: string } | null; id: string };
        };
        texts.set(data.id.slice(0, -`/${PROPOSAL}`.length), data.current?.text ?? "");
      }
      if (current) {
        setRead({ key, texts });
      }
    })().catch(() => {});
    return () => {
      current = false;
    };
  }, [fate, key]);
  return read?.key === key ? read.texts : NO_TEXTS;
}

const NO_TEXTS: ReadonlyMap<string, string> = new Map();

type Workspace = NonNullable<ReturnType<typeof useWorkspace>>;
type Records = {
  inbox?: ViewRef<"Inbox">;
  ledger?: ViewRef<"Ledger">;
  priorities?: ViewRef<"Priorities">;
  sessionList?: ViewRef<"SessionList">;
  workspace?: ViewRef<"Workspace">;
};

/** The features and changes, the kind asked for, each previewed as its proposal. */
function featureItems(
  workspace: Workspace | undefined,
  proposals: ReadonlyMap<string, string>,
): Array<PickerItem> {
  return (workspace?.features ?? []).map((feature) => {
    const isChange = feature.kind === "change";
    return {
      icon: isChange ? "wrench" : "uraeda:step-proposal",
      id: `/f/${encodeURIComponent(feature.folder)}`,
      kind: isChange ? "changes" : "features",
      path: `/f/${encodeURIComponent(feature.folder)}`,
      preview: proposals.get(feature.folder) ?? "",
      title: feature.title,
    };
  });
}

/** The sessions, each previewed as its title, its state, and its branch, three plain lines. */
function sessionItems(
  rows: ReadonlyArray<{
    archived: boolean;
    folder: string | null;
    id: string;
    statusLabel: string;
    title: string;
  }>,
  workspace: Workspace | undefined,
): Array<PickerItem> {
  const branches = new Map(workspace?.features.map((feature) => [feature.folder, feature.branch]));
  return rows
    .filter((row) => !row.archived)
    .map((row) => {
      const branch = row.folder === null ? workspace?.currentBranch : branches.get(row.folder);
      return {
        icon: DESTINATIONS.sessions.icon,
        id: sessionIdPath(row.id),
        kind: "sessions",
        path: sessionIdPath(row.id),
        preview: [row.title, row.statusLabel, branch ?? "no branch"].join("\n"),
        title: row.title,
      };
    });
}

/**
 * The items of a kind, or of every kind, in the order the kinds are named. Suspends while the
 * records load: the one request holds what the kind needs, and nothing else.
 */
export function usePickerItems(kind: PickerKind | "all"): ReadonlyArray<PickerItem> {
  const is = (...kinds: Array<PickerKind>) => kind === "all" || kinds.includes(kind);
  const records = useRequest({
    ...(is("features", "changes", "sessions") && {
      workspace: { id: WORKSPACE_ID, view: WorkspaceView },
    }),
    ...(is("sessions") && { sessionList: { id: SESSION_LIST_ID, view: SessionListView } }),
    ...(is("decisions") && { ledger: { id: LEDGER_ID, view: LedgerView } }),
    ...(is("notes") && { inbox: { id: INBOX_ID, view: InboxView } }),
    ...(is("priorities") && { priorities: { id: PRIORITIES_ID, view: PrioritiesView } }),
  } as never) as unknown as Records;
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
  const features = featureItems(workspace, proposals);
  return [
    ...features.filter((item) => item.kind === "features" && is("features")),
    ...features.filter((item) => item.kind === "changes" && is("changes")),
    ...(is("sessions") ? sessionItems(sessionList?.rows ?? [], workspace) : []),
    ...(ledger ? jumpEntries(ledger, ledger.decisions).map(pickerItemOf) : []),
    ...(inbox?.categories ?? []).flatMap((category) =>
      category.notes.map((note): PickerItem => ({
        icon: DESTINATIONS.inbox.icon,
        id: `/inbox/${encodeURIComponent(note.key)}`,
        kind: "notes",
        path: `/inbox/${encodeURIComponent(note.key)}`,
        preview: note.text,
        title: note.text,
      })),
    ),
    ...(priorities?.sections ?? []).flatMap((section) =>
      section.entries.map((entry): PickerItem => ({
        icon: DESTINATIONS.priorities.icon,
        id: `/priorities/${encodeURIComponent(entry.key)}`,
        kind: "priorities",
        path: `/priorities/${encodeURIComponent(entry.key)}`,
        preview: entry.lines.join("\n"),
        title: entry.text,
      })),
    ),
  ];
}
