import { AnnouncedBanner } from "./layout/AnnouncedBanner.tsx";
import { Link } from "@astryxdesign/core/Link";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import {
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useFateClient, useView } from "react-fate";
import type { Session, Trigger } from "uraeda-server/fate";
import { Composer } from "./Composer.tsx";
import { Crumbs } from "./Crumbs.tsx";
import { MAIN_CHECKOUT, useFeature } from "./data.ts";
import { useSession } from "./sessionData.ts";
import {
  composerDraft,
  type Draft,
  storyCommentsInto,
  takeBackInto,
  useDraft,
} from "./useDraft.ts";
import { SessionActions, type SessionItem } from "./SessionActions.tsx";
import { SessionHeader } from "./SessionHeader.tsx";
import { OffersProvider, SessionEnd } from "./SessionOffers.tsx";
import { type ReadMessage, useFreshRun, useHandOver, WorkflowMessage } from "./HandOver.tsx";
import { JumpToLatest } from "./JumpToLatest.tsx";
import { type ScrolledAway, useFollowEnd, useOpenAtEnd, useScrolledAway } from "./following.ts";
import { type AsideShown, useAsideShown, WithAside } from "./SessionAside.tsx";
import { SessionAnnouncer, useCreatedHere } from "./SessionAnnouncer.tsx";
import { Attention } from "./SessionAttention.tsx";
import { Page } from "./layout/Page.tsx";
import { ProgressLine } from "./ProgressLine.tsx";
import { statusStyles } from "./Question.tsx";
import { redirect, sessionIdPath, useRepoPath, useRestoreScroll, useSearch } from "./routes.tsx";
import { sessionPath } from "./sessions.ts";
import { type Controls, useSessionControls } from "./useSessionControls.ts";
import { StoriesProvider } from "./stories.tsx";
import { Transcript } from "./Transcript.tsx";
import { useKeepPlace } from "./useKeepPlace.ts";
import { useOpenKeys } from "./useOpenKeys.ts";
import { SessionView } from "./views.ts";

const styles = stylex.create({
  composer: {
    // The composer stays at the bottom of the window while the transcript scrolls.
    backgroundColor: colorVars["--color-background-surface"],
    bottom: 0,
    paddingBlock: spacingVars["--spacing-3"],
    position: "sticky",
  },
});

/**
 * What a feature's session was opened for: the workflow's message, while the composer holds it,
 * and why it cannot go, when it cannot; and what follows a sent message.
 */
type Handing = {
  notice?: string;
  onSent?: (session: string) => void;
  /** The controls of the workflow's run, like building in a fresh session. */
  options?: ReactNode;
  /** Whether the composer offers the feature's recommended message. */
  recommended?: boolean;
  workflow?: { file?: string; fresh?: boolean; trigger: Trigger };
};

/** What a page cannot find, with the way home. */
function Missing({ title }: { title: string }) {
  const here = useRepoPath();
  return (
    <AnnouncedBanner
      collapsible={false}
      description={
        <Link hasUnderline href={here("/")}>
          Open home
        </Link>
      }
      status="error"
      title={title}
    />
  );
}

/**
 * A session's header, transcript, and errors, or why there is no session `id`. While the human
 * reads above its end, it gives the pane the jump back to the latest.
 */
function SessionLog({
  away,
  controls: { allow, error, rename },
  crumbs,
  draft,
  id,
  item,
  onJump,
}: {
  /** Whether the human scrolled away from the end before the transcript drew. */
  away?: ScrolledAway;
  /** What the pane's controls hold: the composer shares them. */
  controls: Controls;
  crumbs?: string | undefined;
  draft: Draft;
  id: string;
  /** The change or the feature the session belongs to. */
  item?: SessionItem | undefined;
  /** Called with the jump to the latest while the page does not follow the end, or `undefined`. */
  onJump?: (jump: (() => void) | undefined) => void;
}) {
  const fate = useFateClient();
  const session = useSession(id);
  const groups = useOpenKeys();
  const log = useRef<HTMLDivElement>(null);
  const working = session?.status === "working";
  useOpenAtEnd(log, away);
  // Drawn: the log's following says where the human is from now on.
  useLayoutEffect(() => away?.settle(), [away]);
  const { following, isFollowing, jumpToLatest } = useFollowEnd(log, working);
  // As the tail first draws: away if the human scrolled away before the log drew, or since.
  const awayAtTail = useCallback(
    () => (away?.isAway() ?? false) || !isFollowing(),
    [away, isFollowing],
  );
  useKeepPlace(log);
  useEffect(() => {
    onJump?.(following ? undefined : jumpToLatest);
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- once per change of following: `onJump` is a new function at each draw
  }, [following, jumpToLatest]);
  // Shown with its latest turn ended: the human saw the reply, whatever the status shows, as "Needs
  // you" at a gate.
  const unseen = session?.unseen === true;
  useEffect(() => {
    if (unseen) {
      void fate.mutations.session.seen({ input: { session: id }, view: SessionView });
    }
  }, [fate, id, unseen]);
  if (!session) {
    return <Missing title={`No session ${id}.`} />;
  }
  // A session whose change or feature is gone offers nothing.
  const kind = session.folder === null ? "session" : (item?.kind ?? "feature");
  const offering = { ...(item ? { folder: item.folder } : {}), id, working };
  return (
    <VStack gap={3}>
      <SessionHeader
        place={session.place}
        status={{ label: session.statusLabel, status: session.status }}
        // Its own name once renamed, else its change's or feature's title.
        title={session.name ?? session.title}
        {...(rename ? { rename } : {})}
      />
      {crumbs !== undefined && <ProgressLine folder={crumbs} session={id} />}
      <div ref={log}>
        <StoriesProvider
          comment={storyCommentsInto(draft, `session:${id}`)}
          folder={crumbs ?? MAIN_CHECKOUT}
          stories={[]}
        >
          <OffersProvider kind={kind} session={offering} turns={session.turns}>
            <Transcript
              away={awayAtTail}
              canAllow={!working}
              groups={groups}
              onAllow={allow}
              onTakenBack={takeBackInto(draft)}
              session={session}
            />
            <SessionEnd id={id} turns={session.turns} />
          </OffersProvider>
        </StoriesProvider>
      </div>
      <Attention folder={crumbs} session={session} />
      {error && <span {...stylex.props(statusStyles.error)}>{error}</span>}
    </VStack>
  );
}

/**
 * The session `id` names, as read by its view, or `undefined` before it exists, or `null` when
 * there is none.
 */
function useSessionRecord(id: string | undefined) {
  const fate = useFateClient();
  // The reference's identity is the view's subscription: one per session.
  const ref = useMemo(
    () => (id === undefined ? undefined : fate.ref<Session>("Session", id, SessionView)),
    [fate, id],
  );
  return useView(SessionView, ref);
}

/**
 * A session's pane: its header, transcript, and composer, and a feature's column, or, before its
 * first message creates it, the title and the composer alone. A feature's or a new chat's first
 * message creates the session under the same composer, which keeps the field typed in, its focus,
 * and its text.
 */
function SessionPane({
  aside,
  blocked,
  crumbs,
  draft,
  folder,
  handing = {},
  id,
  item,
  onSent,
  title,
}: {
  /** A feature's column, shown or not. */
  aside?: AsideShown;
  /** Why nothing can be sent to it, which disables the composer. */
  blocked?: string;
  crumbs?: string;
  draft: Draft;
  folder?: string;
  handing?: Handing;
  /** The session, once it exists. */
  id?: string;
  /** The change or the feature the session belongs to, once read. */
  item?: SessionItem;
  /** Called with the session a message created, before it exists. */
  onSent?: (session: string) => void;
  /** The title before the session exists. */
  title?: string;
}) {
  const session = useSessionRecord(id);
  const controls = useSessionControls(id, session);
  const composer = useRef<HTMLDivElement>(null);
  // Kept by the pane, which the transcript's data does not wait for.
  const away = useScrolledAway(composer, id);
  const [jump, setJump] = useState<() => void>();
  if (session === null) {
    return (
      <Page isSession isSnug>
        <SessionLog controls={controls} draft={draft} id={id!} />
      </Page>
    );
  }
  return (
    <WithAside aside={aside} folder={crumbs} {...(id === undefined ? {} : { session: id })}>
      <Page isSession isSnug>
        {crumbs !== undefined && <Crumbs folder={crumbs} session />}
        {id === undefined ? (
          <VStack gap={3}>
            <SessionHeader title={title ?? ""} />
            {crumbs !== undefined && <ProgressLine folder={crumbs} />}
            <Transcript session={{ id: "", turns: [] }} />
          </VStack>
        ) : (
          // Read once the first message created the session: its title stays, and the composer, as
          // it is read. The transcript waits for it: a page shows one log.
          <Suspense fallback={title === undefined ? null : <SessionHeader title={title} />}>
            <SessionLog
              away={away}
              controls={controls}
              crumbs={crumbs}
              draft={draft}
              id={id}
              item={item}
              onJump={(next) => setJump(() => next)}
            />
          </Suspense>
        )}
        <div ref={composer} {...stylex.props(styles.composer)}>
          {jump && <JumpToLatest composer={composer} onJump={jump} />}
          <Composer
            {...(folder === undefined ? {} : { folder })}
            {...composerDraft(draft)}
            {...(id === undefined ? {} : { session: id })}
            working={session?.status === "working"}
            {...(session && id !== undefined
              ? {
                  actions: (
                    <SessionActions
                      controls={controls}
                      item={item}
                      session={{ ...session, title: session.name ?? session.title }}
                    />
                  ),
                  allow: { count: session.allowable, onAllowAll: controls.allowAll },
                }
              : {})}
            {...handing}
            {...(blocked === undefined ? {} : { blocked })}
            onSent={(created) => {
              onSent?.(created);
              handing.onSent?.(created);
            }}
          />
        </div>
      </Page>
    </WithAside>
  );
}

/** Why a feature's session takes no message before its proposal is committed. */
const NO_BRANCH = "This feature has no branch left: it is merged.";

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
  const aside = useAsideShown();
  // A session created here shows before the feature's live update names it.
  const [created, setCreated] = useState<string>();
  const draft = useDraft();
  const { setText } = draft;
  const search = useSearch();
  const workflow = useHandOver(search);
  const ask = new URLSearchParams(search).get("ask") ?? undefined;
  // The refusal read for an address: shown only while the address asks for that message.
  const [refusal, setRefusal] = useState<{ search: string; text: string }>();
  const refused = refusal?.search === search ? refusal.text : undefined;
  const fresh = useFreshRun(search);
  // The address whose message the composer took: each is put in once.
  const filled = useRef<string>(undefined);
  const handingOver = workflow !== undefined || ask !== undefined;
  useEffect(() => {
    if (!handingOver) {
      filled.current = undefined;
    }
  }, [handingOver]);
  useEffect(() => {
    if (workflow === undefined && ask !== undefined && filled.current !== search) {
      filled.current = search;
      setText((now) => `${ask}\n\n${now.trim() ? now : ""}`);
    }
  }, [workflow, ask, search, setText]);
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
    if (message.refusal === null && filled.current !== search) {
      filled.current = search;
      const text = message.text.trimEnd();
      setText((now) => (now.trim() ? `${text}\n${now}` : text));
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
        aside={aside}
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
 * its crumbs and column, and a session without a workflow alone.
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
