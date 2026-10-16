import { Banner } from "@astryxdesign/core/Banner";
import { useLayoutEffect } from "react";
import { useWorkspace } from "./data.ts";
import { HomeHub } from "./home/HomeHub.tsx";
import { Page } from "./layout/Page.tsx";
import { useHash, useRestoreScroll } from "./routes.tsx";

/**
 * The home screen, a control hub: what waits on the human, what agents do, the priorities, the
 * inbox, what is done, and the way to the decisions.
 */
export function Home() {
  const workspace = useWorkspace();
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(true);
  const hash = useHash();
  // After the position: the sidebar's "…" opens the Recently done card.
  useLayoutEffect(() => {
    if (hash === "#done") {
      document.getElementById("done")?.scrollIntoView();
    }
  }, [hash]);
  if (!workspace) {
    return null;
  }
  if (workspace.noSpecs) {
    return (
      <Page>
        <Banner
          status="warning"
          title={`No specs/ folder in ${workspace.noSpecs}. Set Uraeda up with ura init.`}
        />
      </Page>
    );
  }
  return (
    <Page>
      <HomeHub />
    </Page>
  );
}
