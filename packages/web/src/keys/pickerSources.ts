// What the key picker lists: one source per kind of thing, each item with its address and its
// preview, drawn as the app draws that content (`PickerPreview.tsx`). The picker reads only what its kind needs, in one request, once it is opened
// (never while closed, so no page waits on it); a feature's and a change's proposal comes in one
// more request after the list, as a batch of the files, and joins the previews when it arrives.
import { use, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useFateClient, useLiveView, view, type ViewRef } from "react-fate";
import type { Span } from "uraeda-binding";
import type { WorkflowFile } from "uraeda-server/fate";
import { INBOX_ID, LEDGER_ID, PRIORITIES_ID, useWorkspace, WORKSPACE_ID } from "../data.ts";
import { isPending } from "../lists/outline.ts";
import { lookOf, sectionTone } from "../lists/PrioritiesList.tsx";
import type { Tone } from "../lists/workSection.ts";
import { titleOf } from "../QuickAdd.tsx";
import { plain } from "../Spans.tsx";
import { jumpEntries, pickerItemOf } from "../decisions/jump.ts";
import { sessionIdPath } from "../routes.tsx";
import { SESSION_LIST_ID } from "../sessionData.ts";
import { InboxView, LedgerView, PrioritiesView, SessionListView, WorkspaceView } from "../views.ts";
import { needsYou, type Row, rowOf, sessionCard, toCard } from "../sidebar/cards.ts";
import { statusLabel } from "../wait.ts";
import type { CardItem } from "../sidebar/ItemCard.tsx";
import { IsOnContext } from "../extensions/useContributions.ts";
import { KIND_ICONS } from "./kinds.ts";
import type { IconName } from "./store.ts";

export type PickerKind = "features" | "changes" | "sessions" | "decisions" | "notes" | "priorities";

export type PickerItem = {
  /** Small text at the row's end, in the supporting style, as a theme's mode and "in use". */
  aside?: string;
  /**
   * A feature's, a change's, or a session's card, as the sidebar draws it: the row shows its icon,
   * its step's for a feature, and its status's mark, the agent's at work on it, as the card does.
   */
  card?: CardItem;
  icon: IconName;
  /** An address, which the kind's page is at: unique among the items. */
  id: string;
  kind: PickerKind;
  /** What the row shows in the place of its icon, as a principle's numeral. */
  mark?: string;
  /** Where Enter goes, from the repository's top level. */
  path: string;
  /** What shows beside the list, drawn as the app draws it (`PickerPreview.tsx`). */
  preview: PickerPreview;
  /** A first sentence, which a search reads after the title. */
  summary?: string | null;
  title: string;
};

/**
 * A row of an outline's preview, as a list of the priorities or the inbox draws it: its text, its
 * depth under its line (0 for a line), the icon in the place of its bullet, whether its text is a
 * link, as a proposal's file, and whether it is where a pick lands, highlighted.
 */
export type PreviewRow = {
  depth: number;
  icon?: IconName;
  isHere?: boolean;
  isLinked?: boolean;
  /** Small text after its own, as "Merged". */
  marks?: string;
  text: string;
};

/**
 * What a picker's item previews, beside the list on wide screens, drawn by one renderer:
 * - `markdown`: a document, rendered as a page draws it, its frontmatter left out; its parts are
 *   drawn one after the other, a part `isHere` highlighted, as where a pick lands in a file;
 * - `outline`: a section of a list, as its page draws it, its pane titled, its rows bulleted;
 * - `text`: plain lines in the UI's font, or in `family`, as a font's sample.
 */
export type PickerPreview =
  | { kind: "markdown"; parts: ReadonlyArray<{ isHere?: boolean; text: string }> }
  | {
      kind: "outline";
      rows: ReadonlyArray<PreviewRow>;
      title: string;
      /** The colour of its pane's title, as its page's. */
      tone?: Tone;
    }
  | { family?: string; kind: "text"; lines: ReadonlyArray<string> };

/** A document's preview, as one part. */
export const markdownPreview = (text: string): PickerPreview => ({
  kind: "markdown",
  parts: [{ text }],
});

/** A preview of plain lines. */
export const textPreview = (...lines: ReadonlyArray<string>): PickerPreview => ({
  kind: "text",
  lines,
});

/** An item of a list with its nested items: a note of the inbox, a proposal of the priorities. */
type Nesting = {
  children: ReadonlyArray<{ depth: number; spans: ReadonlyArray<Span> }>;
  spans: ReadonlyArray<Span>;
};

/**
 * An item and its nested items as the preview's rows, as its list draws them: its words, its links'
 * text without their targets. `look` is what its row draws besides, as a proposal's file's icon;
 * `depth` sets the whole item in, as a note promoted under a proposal.
 */
export function itemRows(
  item: Nesting,
  {
    depth = 0,
    isHere = false,
    look = {},
  }: {
    depth?: number;
    isHere?: boolean;
    look?: Pick<PreviewRow, "icon" | "isLinked" | "marks">;
  } = {},
): Array<PreviewRow> {
  return [
    { depth, text: plain(item.spans), ...look, ...(isHere ? { isHere } : {}) },
    ...item.children.map((child) => ({ depth: depth + child.depth, text: plain(child.spans) })),
  ];
}

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
      card: toCard(feature, rowOf(feature, rows)),
      icon: KIND_ICONS[isChange ? "changes" : "features"],
      id: `/f/${encodeURIComponent(feature.folder)}`,
      kind: isChange ? "changes" : "features",
      path: `/f/${encodeURIComponent(feature.folder)}`,
      preview: previewOfProposal(proposals, feature.folder),
      title: feature.title,
    };
  });
}

/** A feature's or a change's preview: its proposal, rendered, once read. */
function previewOfProposal(proposals: Proposals, folder: string): PickerPreview {
  const text = proposals.texts.get(folder);
  if (text !== undefined) {
    return markdownPreview(text);
  }
  return proposals.failed.has(folder) ? textPreview(PROPOSAL_FAILED) : textPreview();
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
      const label = statusLabel({ label: row.statusLabel, wait: row.wait });
      const state = row.archived ? `Archived · ${label}` : label;
      return {
        card: sessionCard(row),
        icon: KIND_ICONS.sessions,
        id: sessionIdPath(row.id),
        kind: "sessions",
        path: sessionIdPath(row.id),
        preview: textPreview(row.title, state, branch ?? "no branch"),
        title: row.title,
      };
    },
  );
}

/**
 * The items with what needs the human first, then what an agent is at work on, each kind's order
 * kept within them and for the rest: the cards a glance looks for come up before any search.
 */
export function activeFirst(items: ReadonlyArray<PickerItem>): Array<PickerItem> {
  const rank = ({ card }: PickerItem) =>
    card === undefined ? 2 : needsYou(card.status) ? 0 : card.status.status === "working" ? 1 : 2;
  return items.toSorted((a, b) => rank(a) - rank(b));
}

/** The kinds a built-in extension owns, by its name: off, it finds none. */
const KINDS_OWNED: ReadonlyArray<readonly [PickerKind, string]> = [
  ["decisions", "decisions"],
  ["notes", "inbox"],
  ["priorities", "priorities"],
];

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
 * The items of a kind, or of every kind, in the order the kinds are named, what needs the human
 * and what is at work first (`activeFirst`), once `isEnabled`:
 * nothing is read before, and never by suspending, so the picker's dialog shows while the one
 * request, which holds what the kind needs and nothing else, is under way. Empty until it ends.
 */
export function usePickerItems(kind: PickerKind | "all", isEnabled: boolean): PickerRead {
  // A kind whose built-in is off here is not found, even over every kind.
  const isOn = use(IsOnContext);
  const off = KINDS_OWNED.filter(([, owner]) => !isOn(owner))
    .map(([owned]) => owned)
    .join(" ");
  const is = (...kinds: Array<PickerKind>) =>
    kinds.some((one) => (kind === "all" || kind === one) && !off.split(" ").includes(one));
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
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- `is` reads `kind` and `off` only
    [fate, kind, off, isEnabled],
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
  const items = activeFirst([
    ...features.filter((item) => item.kind === "features" && is("features")),
    ...features.filter((item) => item.kind === "changes" && is("changes")),
    ...(is("sessions") ? sessionItems(sessionList?.rows ?? [], workspace) : []),
    ...(ledger && is("decisions") ? jumpEntries(ledger, ledger.decisions).map(pickerItemOf) : []),
    // A row not written yet has no page: it is offered once written.
    ...(is("notes") ? (inbox?.categories ?? []) : []).flatMap((category) =>
      category.notes
        .filter((note) => !isPending(note.key))
        .map((note): PickerItem => ({
          icon: KIND_ICONS.notes,
          id: `/inbox/${encodeURIComponent(note.key)}`,
          kind: "notes",
          path: `/inbox/${encodeURIComponent(note.key)}`,
          preview: {
            kind: "outline",
            rows: itemRows(note),
            title: category.name ?? "No category",
          },
          title: note.text,
        })),
    ),
    ...(is("priorities") ? (priorities?.sections ?? []) : []).flatMap((section) =>
      section.proposals
        .filter((proposal) => !isPending(proposal.key))
        .map((proposal): PickerItem => ({
          icon: KIND_ICONS.priorities,
          id: `/priorities/${encodeURIComponent(proposal.key)}`,
          kind: "priorities",
          path: `/priorities/${encodeURIComponent(proposal.key)}`,
          preview: {
            kind: "outline",
            rows: itemRows(proposal, { look: lookOf(proposal) }),
            title: titleOf(section.section),
            tone: sectionTone(section.section),
          },
          title: proposal.text,
        })),
    ),
  ]);
  return {
    error: state.error,
    isReady: state.status === "ready",
    items: state.status === "ready" ? items : [],
    refetch: state.refetch,
  };
}
