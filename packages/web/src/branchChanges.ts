// Every feature's branch changes, read in one request for the sidebar's cards, instead of one per
// card, and kept up to date with each feature's own.
import { useLiveView, useRequest } from "react-fate";
import { useSharedRefreshOnShow } from "./readAhead.ts";
import { AllBranchChangesView } from "./views.ts";

/** The id of the one record of every feature's branch changes, as the server names it. */
const ALL_BRANCH_CHANGES_ID = "all-branch-changes";

/** The one request every card makes: the same object, so the cards share its read. */
const REQUEST = { allBranchChanges: { id: ALL_BRANCH_CHANGES_ID, view: AllBranchChangesView } };

/**
 * The lines added and removed on the branch of the feature in `folder`, outside its folder: none
 * without a branch, or while the changes cannot be read.
 */
export function useCardChanges(folder: string) {
  const { allBranchChanges } = useRequest(REQUEST);
  useSharedRefreshOnShow(REQUEST);
  const live = useLiveView(AllBranchChangesView, allBranchChanges);
  return live?.features.find((feature) => feature.folder === folder);
}
