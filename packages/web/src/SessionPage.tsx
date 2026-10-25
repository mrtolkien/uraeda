import { Suspense, useEffect, useState } from "react";
import { useFeature } from "./data.ts";
import { useSession } from "./sessionData.ts";
import { type Draft, featureDraftKey, useDraft } from "./useDraft.ts";
import type { SessionItem } from "./SessionActions.tsx";
import { type ReadMessage, useFreshRun, useHandOver, WorkflowMessage } from "./HandOver.tsx";
import { SessionAnnouncer, useCreatedHere } from "./SessionAnnouncer.tsx";
import { Page } from "./layout/Page.tsx";
import {
  redirect,
  sessionIdPath,
  useRepoPath,
  useRepositoryPath,
  useRestoreScroll,
  useSearch,
} from "./routes.tsx";
import { sessionPath } from "./sessions.ts";
import { type Handing, Missing, NO_BRANCH, SessionPane } from "./SessionView.tsx";

/**
 * A feature's session: created with its first message, which this view sends. Opened to hand the
 * feature over (`?continue=<trigger>&file=<file>`), its composer starts with the workflow's
 * message, before what the human already typed, and Send reads "Start the agent" until it is sent.
 * A hand-over refused, as when the feature waits on you, shows why and holds no workflow: what the
 * composer holds goes as a chat. Opened to ask about a block (`?ask=<quote>`), it starts with the
 * quote and an empty line. Otherwise, its composer offers the feature's recommended message.
 * Given the ID of one of its sessions, an earlier one, it draws that session, and its run goes
 * there; one whose change or feature is gone, as once dropped, draws as a session alone.
 */
function FeatureSession({ folder, id: given }: { folder: string; id?: string }) {
  const feature = useFeature(folder);
  const here = useRepoPath();
  // A session created here shows before the feature's live update names it.
  const [created, setCreated] = useState<string>();
  // The feature's latest session's draft, which the round's column holds too: moving between them
  // keeps it. An earlier session's goes with its page.
  const repo = useRepositoryPath();
  const draft = useDraft(given === undefined ? featureDraftKey(repo, folder) : undefined);
  const { ask: askInto, handOver, refused: refuse } = draft;
  const search = useSearch();
  const workflow = useHandOver(search);
  const ask = new URLSearchParams(search).get("ask") ?? undefined;
  // The refusal read for an address: shown only while the address asks for that message.
  const [refusal, setRefusal] = useState<{ search: string; text: string }>();
  const refused = refusal?.search === search ? refusal.text : undefined;
  const fresh = useFreshRun(search);
  // The draft takes the address's message once: coming back to the address keeps what it holds.
  useEffect(() => {
    if (workflow === undefined && ask !== undefined) {
      askInto(ask, search);
    }
  }, [workflow, ask, search, askInto]);
  if (!feature || feature.missing) {
    return given === undefined ? (
      <Page>
        <Missing title={`No feature ${folder}.`} />
      </Page>
    ) : (
      <SessionPane draft={draft} id={given} />
    );
  }
  // A feature whose proposal is not committed has no branch for the agent to work on: the server
  // refuses every message with the same words.
  const blocked = feature.branch ? undefined : NO_BRANCH;
  const id = given ?? feature.session ?? created;
  const item: SessionItem = {
    branch: feature.branch ?? null,
    folder,
    kind: feature.kind === "change" ? "change" : "feature",
    slug: feature.slug,
  };
  const read = (message: ReadMessage) => {
    setRefusal(message.refusal === null ? undefined : { search, text: message.refusal });
    fresh.read(message);
    if (message.refusal !== null) {
      refuse(search);
    } else if (workflow) {
      handOver(search, {
        ...workflow,
        text: message.text.trimEnd(),
        ...(message.step === undefined ? {} : { step: message.step }),
      });
    }
  };
  // Sent: the address no longer asks for the message, or the quote.
  const sent = () =>
    redirect(here(given === undefined ? sessionPath(folder) : sessionIdPath(given)));
  const handing: Handing = workflow
    ? refused === undefined
      ? { ...fresh.handing(workflow), onSent: sent }
      : { notice: refused, onSent: sent, recommended: true }
    : { recommended: true, ...(ask === undefined ? {} : { onSent: sent }) };
  return (
    <>
      {workflow && (
        <Suspense fallback={null}>
          <WorkflowMessage folder={folder} key={search} onRead={read} workflow={workflow} />
        </Suspense>
      )}
      <SessionPane
        crumbs={folder}
        draft={draft}
        folder={folder}
        handing={handing}
        item={item}
        title={feature.title}
        {...(id === undefined ? {} : { id })}
        {...(blocked === undefined ? {} : { blocked })}
        onSent={setCreated}
      />
      <SessionAnnouncer
        feature={folder}
        key={folder}
        {...(id === undefined ? {} : { session: id })}
      />
    </>
  );
}

/**
 * A session by its ID, with its announcer: a change's or a feature's draws as its session page,
 * with its crumbs, and a session without a workflow as its own page; each with the session's
 * column.
 */
function IdSession({ draft, id }: { draft: Draft; id: string }) {
  const created = useCreatedHere();
  const folder = useSession(id)?.folder;
  if (folder) {
    return <FeatureSession folder={folder} id={id} />;
  }
  return (
    <>
      <SessionPane draft={draft} id={id} />
      <SessionAnnouncer created={created} session={id} />
    </>
  );
}

/** A session's page: a feature's latest, by its folder, or any session, by its ID. */
export function SessionPage(props: { folder: string } | { id: string }) {
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(true);
  const draft = useDraft();
  if ("folder" in props) {
    return <FeatureSession folder={props.folder} />;
  }
  return <IdSession draft={draft} id={props.id} />;
}
