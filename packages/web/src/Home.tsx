import { VStack } from "@astryxdesign/core/VStack";
import { useLayoutEffect, useState } from "react";
import type { SetupItem } from "uraeda-binding";
import { SET_UP_PROJECT } from "uraeda-server/round-messages";
import { useAgent, useWorkspace } from "./data.ts";
import { HomeHub } from "./home/HomeHub.tsx";
import { SetupAnnouncer, SetupPane } from "./home/Setup.tsx";
import { AnnouncedBanner } from "./layout/AnnouncedBanner.tsx";
import { Page } from "./layout/Page.tsx";
import { Room } from "./layout/Room.tsx";
import { dismissNote, HOME_NOTES, useNotes } from "./offers.ts";
import { navigate, useHash, useRepoPath, useRestoreScroll } from "./routes.tsx";
import { useNewKey } from "./useNewKey.ts";

/**
 * The Setup pane on Home: "Set up with the agent" opens a new session, its composer filled with the
 * setup's message, unsent (see `NewPage.tsx`).
 */
function HomeSetup({ items }: { items: Array<SetupItem> }) {
  const here = useRepoPath();
  const hasAgent = useAgent()?.available === true;
  return (
    <SetupPane
      hasAgent={hasAgent}
      items={items}
      message={SET_UP_PROJECT}
      onSetUp={() => navigate(here("/new?kind=session"), { insert: "setup" })}
    />
  );
}

/**
 * The Setup pane's room on Home, first on the page while `items`, the core's setup, holds any. Once
 * the core gives none, the project set up, the pane closes rather than vanish, so the panes under
 * it glide up: it shows its last items meanwhile, each required one written, as the empty list
 * means, which also announces the last file written.
 */
function SetupRoom({ items }: { items: Array<SetupItem> }) {
  // The last items it was given, as React keeps a value from an earlier render, until it has
  // closed.
  const [last, setLast] = useState(items);
  if (items.length > 0 && items !== last) {
    setLast(items);
  }
  const isOpen = items.length > 0;
  const drawn = isOpen
    ? items
    : last.map((item) => (item.required ? { ...item, state: "written" } : item));
  return (
    <>
      {last.length > 0 && (
        <Room gap={4} isOpen={isOpen} onClosed={() => setLast([])}>
          <HomeSetup items={drawn} />
        </Room>
      )}
      <SetupAnnouncer items={drawn} />
    </>
  );
}

/**
 * The home screen, centred in the page: its core, what stops the workflow, what waits on the human,
 * and what runs, then its overview, the priorities, the usage, the inbox, and what is done. Above
 * them, the lines a drop from a feature's page left, until dismissed. First of all, while the
 * project is not set up, the Setup pane, the page's only content in a repository without `specs/`.
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
  // The pane at the same place with or without `specs/`, so its announcements carry on as the folder
  // appears, and its item leaves the list.
  return (
    <Page>
      <VStack gap={0}>
        <SetupRoom items={workspace.setup} />
        {!workspace.noSpecs && (
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
        )}
      </VStack>
    </Page>
  );
}
