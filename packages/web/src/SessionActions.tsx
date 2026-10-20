// A session's actions, in the "…" beside its composer's Send, where they stay in reach however long
// the session: making it a change, or its change a feature, renaming it, archiving a session
// without a workflow, and dropping a change or a feature, behind a confirmation.
import { MoreMenu } from "@astryxdesign/core/MoreMenu";
import { useEffect, useRef } from "react";
import { useFateClient } from "react-fate";
import { refusal } from "./errors.ts";
import { useConfirm } from "./fields/Confirm.tsx";
import {
  addNote,
  markDropped,
  openOffer,
  returnFocus,
  useDropped,
  useFocusBack,
} from "./offers.ts";
import { useOpenRename } from "./sidebar/RenameSession.tsx";
import type { Controls } from "./useSessionControls.ts";
import { DroppedView } from "./views.ts";
import { runWrite } from "./writes/store.ts";

/** The change or the feature a session belongs to, as its page reads it. */
export type SessionItem = {
  branch: string | null;
  folder: string;
  kind: "change" | "feature";
  slug: string;
};

/** What a drop asks first: what goes, and what stays, with the command that deletes the branch. */
export function dropQuestion({ kind, slug }: SessionItem, branch: string) {
  return {
    body: `Its entry leaves Now, its worktree is removed, and its sessions are archived. Its branch stays, so nothing is lost: git branch -D ${branch} deletes it.`,
    cancel: `Keep the ${kind}`,
    confirm: `Drop the ${kind}`,
    destructive: true,
    title: `Drop the ${kind} ${slug}?`,
  };
}

/**
 * Why a drop's priorities stay uncommitted: they held the human's own edits, a hook refused the
 * commit, or Now did not list the item, so nothing was removed.
 */
const UNCOMMITTED =
  "The priorities were not committed: if Now listed it, its entry’s removal waits in specs/PRIORITIES.md.";

/**
 * Drops the session's change or feature once confirmed: its entry leaves **Now**, its worktree is
 * removed unless it holds uncommitted changes, and its sessions are archived. The page says what
 * stayed, with the branch the server kept, and when the priorities were left uncommitted.
 */
function useDrop(session: string, item: SessionItem | undefined, fail: (error: string) => void) {
  const fate = useFateClient();
  const confirm = useConfirm();
  return async () => {
    if (!item) {
      return;
    }
    const branch = item.branch ?? (item.kind === "change" ? `change/${item.folder}` : item.folder);
    if (!(await confirm(dropQuestion(item, branch)))) {
      return;
    }
    const result = await runWrite({ folder: item.folder, label: "Dropping…" }, () =>
      fate.mutations.feature.drop({ input: { folder: item.folder }, view: DroppedView }),
    );
    if (result.error) {
      fail(refusal(result.error).message);
      return;
    }
    markDropped(session);
    const dropped = result.result as
      | { branch?: string; committed?: boolean; worktreeLeft?: string | null }
      | undefined;
    addNote(
      session,
      {
        status: "info",
        title: `Dropped the ${item.kind} ${item.slug}: its branch ${dropped?.branch ?? branch} stays.`,
      },
      ...(dropped?.worktreeLeft
        ? [{ status: "warning" as const, title: dropped.worktreeLeft }]
        : []),
      ...(dropped?.committed === false ? [{ status: "warning" as const, title: UNCOMMITTED }] : []),
    );
  };
}

/**
 * The session's "…", "Session actions": for a session without a workflow, Make it a change,
 * Rename, and Archive; for a change, Make it a feature, Rename, and "Drop the change…"; for a
 * feature, Rename and "Drop the feature…". Making it a change or a feature opens its card at the
 * session's end. Once its change or feature is dropped, which archives the session, only Rename
 * stays. `isMenuOpen` opens it from the start, as its story shows it.
 */
export function SessionActions({
  controls,
  isMenuOpen,
  item,
  session,
}: {
  controls: Controls;
  isMenuOpen?: boolean;
  item?: SessionItem | undefined;
  session: { archived?: boolean; folder: string | null; id: string; title: string };
}) {
  const rename = useOpenRename();
  const drop = useDrop(session.id, item, controls.fail);
  // The focus comes back here once a card it opened, or Rename, closes.
  const trigger = useRef<HTMLButtonElement>(null);
  const { back, took } = useFocusBack(session.id);
  useEffect(() => {
    if (back) {
      trigger.current?.focus();
      took();
    }
  }, [back, took]);
  const dropped = useDropped(session.id);
  const { archive } = controls;
  // A dropped change or feature archived its sessions: they move it no more.
  const live =
    item && !dropped && !(session.folder !== null && session.archived) ? item : undefined;
  const items = [
    ...(session.folder === null
      ? [{ label: "Make it a change", onClick: () => openOffer(session.id, "change") }]
      : live?.kind === "change"
        ? [{ label: "Make it a feature", onClick: () => openOffer(session.id, "feature") }]
        : []),
    { label: "Rename", onClick: () => rename(session, () => returnFocus(session.id)) },
    ...(archive
      ? [
          {
            label: archive.archived ? "Unarchive" : "Archive",
            onClick: () => void archive.onArchive(),
          },
        ]
      : []),
    ...(live ? [{ label: `Drop the ${live.kind}…`, onClick: () => void drop() }] : []),
  ];
  return (
    <MoreMenu
      isMenuOpen={isMenuOpen}
      items={items}
      label="Session actions"
      ref={trigger}
      size="sm"
    />
  );
}
