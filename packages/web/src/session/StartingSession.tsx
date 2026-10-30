// A feature's session page while its start is in the server's write queue, or refused there: the
// feature cannot be read yet, so the page draws from the queue's record and from the plan this
// document made, the steps where the transcript will be and the plan's message in the composer. A
// message sent meanwhile waits for the steps; a refusal puts it back (US4).
import { useEffect } from "react";
import { useFateClient } from "react-fate";
import { useHandOver } from "../HandOver.tsx";
import { navigateHere, redirect, useRepoPath, useRepositoryPath, useSearch } from "../routes.tsx";
import { sessionPath } from "../sessions.ts";
import { SessionPane } from "../SessionView.tsx";
import { featureDraftKey, useDraft } from "../useDraft.ts";
import type { usePlannedStart } from "../useStart.ts";
import { FeatureView } from "../views.ts";
import { REFUSED_ID, useWriteQueue, type Write } from "../writes/useWriteQueue.ts";
import { StartStepsView } from "./StartSteps.tsx";

/** Why the composer of a refused start sends nothing: there is no feature to send to. */
const NOT_STARTED = "Nothing started: start the proposal again from its file.";

/** The same, for a feature typed on the New page, whose composer still holds its text. */
const NOT_STARTED_TYPED = "Nothing started: your text is still on the New page.";

/** The start of `folder` in the repository's write queue, landing, waiting, or refused. */
export function useStartWrite(folder: string): Write | undefined {
  return useWriteQueue().findLast((write) => write.steps !== undefined && write.folder === folder);
}

/** Whether the feature in `folder` can be read now, read again from the server. */
async function isReadable(fate: ReturnType<typeof useFateClient>, folder: string) {
  const { feature } = await fate.request(
    { feature: { id: folder, view: FeatureView } },
    { mode: "network-only" },
  );
  const { data } = await fate.readView(FeatureView, feature);
  // fate types the request's root as any entity: the view gives the feature's fields.
  return !(data as { missing?: boolean | null }).missing;
}

/**
 * Forgets the plan once its start landed: its write showed in the queue and left it, or, never seen
 * there, the feature can be read. The feature is read again first, so its page draws it at once.
 */
function useLanded(
  folder: string,
  planned: ReturnType<typeof usePlannedStart>,
  write: Write | undefined,
) {
  const fate = useFateClient();
  const writes = useWriteQueue();
  const { forget, seen, start } = planned;
  const isQueued = write !== undefined;
  const wasSeen = start?.seen === true;
  useEffect(() => {
    if (isQueued) {
      seen();
    } else if (start !== undefined) {
      void isReadable(fate, folder)
        .then((readable) => {
          // Only a start that landed: one refused and dismissed leaves the text it was typed from.
          if (readable) {
            start.landed?.();
          }
          if (readable || wasSeen) {
            forget();
          }
        })
        .catch(() => {});
    }
    // Once per change of the queue too: a start that landed before the page read it never shows.
  }, [fate, folder, forget, isQueued, seen, start, wasSeen, writes]);
}

/**
 * The session page of `folder` while its start runs: `write`, the start's in the queue, once the
 * page read it, and `planned`, the plan this document made, if it did. The address's
 * `?continue=start` puts the plan's message in the composer, once; Send keeps it in the server
 * until the steps end. A refusal puts the message kept back in the composer, which then sends
 * nothing.
 */
export function StartingSession({
  folder,
  planned,
  write,
}: {
  folder: string;
  planned: ReturnType<typeof usePlannedStart>;
  write: Write | undefined;
}) {
  const here = useRepoPath();
  const search = useSearch();
  const draft = useDraft(featureDraftKey(useRepositoryPath(), folder));
  const { handOver } = draft;
  const { start } = planned;
  useLanded(folder, planned, write);
  const asks = useHandOver(search)?.trigger === "start";
  const message = start?.message;
  useEffect(() => {
    if (asks && message) {
      handOver(search, { text: message, trigger: "start" });
    }
  }, [asks, handOver, message, search]);
  const refused = write?.state === "refused" ? write : undefined;
  const queued = refused?.queued;
  useEffect(() => {
    if (refused && queued) {
      handOver(`refused:${refused.id}`, { text: queued, trigger: "start" });
    }
  }, [handOver, queued, refused]);
  const title = write?.label ?? (start ? `Starting the ${start.kind} ${start.title}` : folder);
  const proposal =
    write?.href ||
    (start?.proposal === undefined ? "/new?kind=feature" : `/edit/${start.proposal}`);
  return (
    <SessionPane
      draft={draft}
      folder={folder}
      handing={{ onSent: () => redirect(here(sessionPath(folder))) }}
      starting={
        // The toast's Open of a refused start comes here.
        <div {...(refused === undefined ? {} : { id: REFUSED_ID })}>
          <StartStepsView
            onProposal={() => navigateHere(proposal)}
            queued={write?.queued}
            steps={write?.steps ?? []}
            title={title}
          />
        </div>
      }
      title={start?.title ?? folder}
      {...(refused === undefined
        ? {}
        : {
            blocked:
              start !== undefined && start.proposal === undefined ? NOT_STARTED_TYPED : NOT_STARTED,
          })}
    />
  );
}
