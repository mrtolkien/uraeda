// The shell's cards: a feature's or a change's, which opens its page, its status what it asks, with
// Dismiss while a failed or stopped run asks; and a session's, which opens the session.
import { Suspense, use } from "react";
import { PickedCard } from "../layout/picked.ts";
import { useCardChanges } from "../branchChanges.ts";
import { navigate, sessionIdPath, useRepoPath } from "../routes.tsx";
import { isDismissable, useDismiss } from "../useDismiss.ts";
import { usePendingAction } from "../writes/store.ts";
import { type Feature, type Row, sessionCard, toCard } from "./cards.ts";
import { statusPath } from "./statusPath.ts";
import type { Entry } from "./entries.ts";
import { type CardItem, ItemCard } from "./ItemCard.tsx";
import { selects } from "./Row.tsx";

/**
 * A feature's or a change's card, with the lines its branch changed once read, and `detail` under
 * its name on home.
 */
export function FeatureCard({
  detail,
  feature,
  pathname,
  row,
}: {
  detail?: string | undefined;
  feature: Feature;
  pathname: string;
  row: Row | undefined;
}) {
  const here = useRepoPath();
  const to = `/f/${feature.folder}`;
  const isPicked = use(PickedCard) === here(to);
  const { dismiss, error } = useDismiss();
  const { session, turn } = feature.status;
  const onDismiss =
    isDismissable(feature.status) && session !== null && turn !== null
      ? () => void dismiss({ folder: feature.folder, session, turn })
      : undefined;
  const card = (item: CardItem) => (
    <ItemCard
      detail={detail}
      dismissError={error}
      href={here(to)}
      isPicked={isPicked}
      isSelected={selects(pathname, to)}
      item={item}
      // Gone while it runs: the card shows "Dismissing…" until the status follows.
      onDismiss={item.pending === undefined ? onDismiss : undefined}
      onOpen={() => navigate(here(to))}
      onStatus={() => navigate(here(statusPath(feature, item.status)))}
    />
  );
  const base = toCard(feature, row);
  // What a button just started for it, until the server's status for it changes.
  const pending = usePendingAction(feature.folder, `${base.status.status} ${base.status.label}`);
  const item = pending === undefined ? base : { ...base, pending };
  return (
    <Suspense fallback={card(item)}>
      <WithChanges folder={feature.folder} item={item} render={card} />
    </Suspense>
  );
}

/**
 * The card with its branch's lines added and removed, when it changed any, from the one record of
 * every feature's changes.
 */
function WithChanges({
  folder,
  item,
  render,
}: {
  folder: string;
  item: CardItem;
  render: (item: CardItem) => React.ReactNode;
}) {
  const changes = useCardChanges(folder);
  return render(
    changes && (changes.added > 0 || changes.removed > 0)
      ? { ...item, changes: { added: changes.added, removed: changes.removed } }
      : item,
  );
}

/** A session's card, which opens the session. */
export function SessionCard({ pathname, row }: { pathname: string; row: Row }) {
  const here = useRepoPath();
  const to = sessionIdPath(row.id);
  return (
    <ItemCard
      href={here(to)}
      isPicked={use(PickedCard) === here(to)}
      isSelected={selects(pathname, to)}
      item={sessionCard(row)}
      onOpen={() => navigate(here(to))}
    />
  );
}

/** An entry's card, by its kind. */
export function EntryCard({ entry, pathname }: { entry: Entry; pathname: string }) {
  return entry.kind === "feature" ? (
    <FeatureCard feature={entry.feature} pathname={pathname} row={entry.row} />
  ) : (
    <SessionCard pathname={pathname} row={entry.row} />
  );
}
