import { Banner } from "@astryxdesign/core/Banner";
import { useLayoutEffect } from "react";
import { useWorkspace } from "./data.ts";
import { HomeHub } from "./home/HomeHub.tsx";
import { Page } from "./layout/Page.tsx";
import { useHash, useRestoreScroll } from "./routes.tsx";

/**
 * The home screen, centred in the page: its core, what stops the workflow, what waits on the human,
 * and what runs, then its overview, the priorities, the usage, the inbox, and what is done.
 */
export function Home() {
  const workspace = useWorkspace();
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(true);
  const hash = useHash();
  // After the position: the column's Done "…" opens the Recent pane.
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
