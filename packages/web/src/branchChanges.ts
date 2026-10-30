// Every feature's branch changes, read in one request for the sidebar's cards, instead of one per
// card, and kept up to date with each feature's own.
import { useEffect } from "react";
import { useFateClient, useLiveView, useRequest } from "react-fate";
import { show } from "./readAhead.ts";
import { AllBranchChangesView } from "./views.ts";

/** The id of the one record of every feature's branch changes, as the server names it. */
const ALL_BRANCH_CHANGES_ID = "all-branch-changes";

/** The one request every card makes: the same object, so the cards share its read. */
const REQUEST = { allBranchChanges: { id: ALL_BRANCH_CHANGES_ID, view: AllBranchChangesView } };

/** The read the tab's return started, which every card's listener shares until it ends. */
let reading: Promise<unknown> | undefined;

/**
 * Keeps the record, as `useRefreshOnShow` keeps a page's, and reads it again once when the tab
 * comes back to the foreground, however many cards listen.
 */
function useRefreshOnce() {
  const fate = useFateClient();
  useEffect(() => {
    const hide = show(fate, REQUEST);
    const refresh = () => {
      if (document.visibilityState === "visible" && reading === undefined) {
        reading = fate
          .request(REQUEST as never, { mode: "network-only" })
          .catch(() => {})
          .finally(() => {
            reading = undefined;
          });
      }
    };
    document.addEventListener("visibilitychange", refresh);
    return () => {
      hide();
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [fate]);
}

/**
 * The lines added and removed on the branch of the feature in `folder`, outside its folder: none
 * without a branch, or while the changes cannot be read.
 */
export function useCardChanges(folder: string) {
  const { allBranchChanges } = useRequest(REQUEST);
  useRefreshOnce();
  const live = useLiveView(AllBranchChangesView, allBranchChanges);
  return live?.features.find((feature) => feature.folder === folder);
}
