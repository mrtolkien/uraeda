// A session's actions, in the "…" beside its composer's Send, where they stay in reach however long
// the session: making it a change, or its change a feature, renaming it, archiving a session
// without a workflow, and dropping a change or a feature, behind a confirmation.

import { useEffect, useRef } from "react";
import { type SessionItem, useDropItem } from "./dropItem.ts";
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
import { ActionsMenu } from "./layout/ActionsMenu.tsx";

/**
 * Drops the session's change or feature once confirmed, then marks it dropped and leaves the notes
 * of what stayed on the session's page.
 */
function useDrop(session: string, item: SessionItem | undefined, fail: (error: string) => void) {
  const dropItem = useDropItem();
  return async () => {
    if (!item) {
      return;
    }
    const result = await dropItem(item);
    if (result.kind === "refused") {
      fail(result.message);
    } else if (result.kind === "dropped") {
      markDropped(session);
      addNote(session, ...result.notes);
    }
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
    <ActionsMenu isMenuOpen={isMenuOpen} items={items} label="Session actions" ref={trigger} />
  );
}
