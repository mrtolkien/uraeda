// The feature's "…" beside its title: Rename, which opens the shell card's settings; Postpone, which
// sends the agent its message; and Drop, behind its confirmation, as the session's "…" has it. A
// dropped item leaves its page for Home, where what stayed is said, once the priorities commit
// succeeded.
import { useRef } from "react";
import { useFateClient } from "react-fate";
import { postponeMessage } from "uraeda-server/round-messages";
import { type SessionItem, UNCOMMITTED, useDropItem } from "../dropItem.ts";
import { addNote, HOME_NOTES } from "../offers.ts";
import { sessionIdPath } from "../routeTable.ts";
import { navigate, useRepoPath } from "../routes.tsx";
import { sendMessage } from "../sessions.ts";
import { useOpenSettings } from "../sidebar/FeatureSettingsDialog.tsx";
import { ActionsMenu } from "../layout/ActionsMenu.tsx";

/**
 * "Postpone the feature", or the change: sends the postpone message at once to its latest session,
 * made when it has none, then opens that session, where the agent writes the proposal it leaves
 * behind and asks before anything it cannot settle. A message the server refuses, as without an
 * agent, is told to `onRefused`. A second pick before the first is answered sends nothing.
 */
function usePostpone(item: SessionItem, path: string, onRefused: (message: string) => void) {
  const fate = useFateClient();
  const here = useRepoPath();
  const sending = useRef(false);
  return async () => {
    if (!item.branch || sending.current) {
      return;
    }
    sending.current = true;
    const sent = await sendMessage(fate, {
      folder: item.folder,
      text: postponeMessage({ branch: item.branch, kind: item.kind, path }),
    }).finally(() => {
      sending.current = false;
    });
    if (sent.ok) {
      navigate(here(sessionIdPath(sent.session)));
    } else {
      onRefused(sent.message);
    }
  };
}

/**
 * "Feature actions", or "Change actions": "Rename", "Postpone the feature" or "Postpone the change",
 * while it has a branch for the agent to close, and "Drop the feature…" or "Drop the change…". A
 * drop or a postpone the server refuses, or a drop whose priorities commit failed, is told to
 * `onRefused`, which shows it under the name; a drop the human keeps changes nothing.
 */
export function FeatureMenu({
  feature,
  item,
  onRefused,
}: {
  feature: { folder: string; label: string | null; path: string; slug: string };
  item: SessionItem;
  onRefused: (message: string) => void;
}) {
  const here = useRepoPath();
  const settings = useOpenSettings();
  const dropItem = useDropItem();
  const postpone = usePostpone(item, feature.path, onRefused);
  const drop = async () => {
    const result = await dropItem(item);
    if (result.kind === "refused") {
      onRefused(result.message);
    } else if (result.kind === "dropped" && !result.committed) {
      // The spec's edge case: a refused commit keeps the page, with the refusal under the name.
      onRefused(UNCOMMITTED);
    } else if (result.kind === "dropped") {
      addNote(HOME_NOTES, ...result.notes);
      navigate(here("/"));
    }
  };
  const name = item.kind === "change" ? "Change" : "Feature";
  return (
    <ActionsMenu
      items={[
        { label: "Rename", onClick: () => settings(feature) },
        ...(item.branch
          ? [{ label: `Postpone the ${item.kind}`, onClick: () => void postpone() }]
          : []),
        { label: `Drop the ${item.kind}…`, onClick: () => void drop() },
      ]}
      label={`${name} actions`}
    />
  );
}
