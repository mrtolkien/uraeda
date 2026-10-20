// A session's actions, in the "…" beside its composer's Send, where they stay in reach however long
// the session: making it a change, or its change a feature, renaming it, archiving a session
// without a workflow, and dropping a change or a feature, behind a confirmation.
import { MoreMenu } from "@astryxdesign/core/MoreMenu";
import { useFateClient } from "react-fate";
import { refusal } from "./errors.ts";
import { useConfirm } from "./fields/Confirm.tsx";
import { addNote, openOffer } from "./offers.ts";
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
 * Drops the session's change or feature once confirmed: its entry leaves **Now**, its worktree is
 * removed unless it holds uncommitted changes, and its sessions are archived. The page says what
 * stayed.
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
    const dropped = result.result as { worktreeLeft?: string | null } | undefined;
    addNote(
      session,
      {
        status: "info",
        title: `Dropped the ${item.kind} ${item.slug}: its branch ${branch} stays.`,
      },
      ...(dropped?.worktreeLeft
        ? [{ status: "warning" as const, title: dropped.worktreeLeft }]
        : []),
    );
  };
}

/**
 * The session's "…", "Session actions": for a session without a workflow, Make it a change,
 * Rename, and Archive; for a change, Make it a feature, Rename, and "Drop the change…"; for a
 * feature, Rename and "Drop the feature…". Making it a change or a feature opens its card at the
 * session's end. `isMenuOpen` opens it from the start, as its story shows it.
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
  session: { folder: string | null; id: string; title: string };
}) {
  const rename = useOpenRename();
  const drop = useDrop(session.id, item, controls.fail);
  const { archive } = controls;
  const items = [
    ...(session.folder === null
      ? [{ label: "Make it a change", onClick: () => openOffer(session.id, "change") }]
      : item?.kind === "change"
        ? [{ label: "Make it a feature", onClick: () => openOffer(session.id, "feature") }]
        : []),
    { label: "Rename", onClick: () => rename(session) },
    ...(archive
      ? [
          {
            label: archive.archived ? "Unarchive" : "Archive",
            onClick: () => void archive.onArchive(),
          },
        ]
      : []),
    ...(item ? [{ label: `Drop the ${item.kind}…`, onClick: () => void drop() }] : []),
  ];
  return <MoreMenu isMenuOpen={isMenuOpen} items={items} label="Session actions" size="sm" />;
}
