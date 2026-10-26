import { VStack } from "@astryxdesign/core/VStack";
import { useLayoutEffect } from "react";
import { useWorkspace } from "./data.ts";
import { HomeHub } from "./home/HomeHub.tsx";
import { AnnouncedBanner } from "./layout/AnnouncedBanner.tsx";
import { Page } from "./layout/Page.tsx";
import { dismissNote, HOME_NOTES, useNotes } from "./offers.ts";
import { useHash, useRestoreScroll } from "./routes.tsx";
import { NoSpecs } from "./layout/Missing.tsx";
import { useNewKey } from "./useNewKey.ts";

/**
 * The home screen, centred in the page: its core, what stops the workflow, what waits on the human,
 * and what runs, then its overview, the priorities, the usage, the inbox, and what is done. Above
 * them, the lines a drop from a feature's page left, until dismissed.
 */
export function Home() {
  const notes = useNotes(HOME_NOTES);
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
  // `a` starts something: there is nothing to start in a repository with no specs.
  useNewKey(workspace ? !workspace.noSpecs : false);
  if (!workspace) {
    return null;
  }
  if (workspace.noSpecs) {
    return (
      <Page>
        <NoSpecs path={workspace.noSpecs} />
      </Page>
    );
  }
  return (
    <Page>
      <VStack gap={4}>
        {notes.map((note, index) => (
          <AnnouncedBanner
            collapsible={false}
            dismissLabel="Dismiss"
            isDismissable
            key={note.title}
            onDismiss={() => dismissNote(HOME_NOTES, index)}
            status={note.status}
            title={note.title}
          />
        ))}
        <HomeHub />
      </VStack>
    </Page>
  );
}
