// A session's view: its header, transcript, and composer, drawn by the session's page and by a
// round's Session column, where it scrolls in the column's box.
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
import { MAIN_CHECKOUT } from "./data.ts";
import { useSession } from "./sessionData.ts";
import { composerDraft, type Draft, storyCommentsInto, takeBackInto } from "./useDraft.ts";
import type { SessionItem } from "./dropItem.ts";
import { SessionActions } from "./SessionActions.tsx";
import { SessionHeader } from "./SessionHeader.tsx";
import { OffersProvider, SessionEnd } from "./SessionOffers.tsx";
import { JumpToLatest } from "./JumpToLatest.tsx";
import { type ScrolledAway, useFollowEnd, useOpenAtEnd, useScrolledAway } from "./following.ts";
import { Attention } from "./SessionAttention.tsx";
import { Page } from "./layout/Page.tsx";
import { SessionColumn } from "./session/SessionColumn.tsx";
import { StatusText } from "./fields/StatusText.tsx";
import { useRepoPath } from "./routes.tsx";
import { stretchAddress } from "./session/stretches.ts";
import { sessionPath } from "./sessions.ts";
import { type Controls, useSessionControls } from "./useSessionControls.ts";
import { StoriesProvider } from "./stories.tsx";
import { Transcript } from "./Transcript.tsx";
import { useKeepPlace } from "./useKeepPlace.ts";
import { SessionView } from "./views.ts";
import { Missing } from "./layout/Missing.tsx";

const styles = stylex.create({
  box: {
    // The box's inset, which the transcript takes back to reach its edges, as on a page.
    "--page-bleed": `calc(-1 * ${spacingVars["--spacing-4"]})`,
  },
  boxedComposer: {
    // In a box, at its foot: over its padding there, which the transcript's end scrolls into.
    bottom: 0,
    marginBlockEnd: `calc(-1 * ${spacingVars["--spacing-4"]})`,
  },
  composer: {
    // The composer stays at the bottom of the window while the transcript scrolls, above the
    // shell's status line, fixed at the window's bottom.
    backgroundColor: colorVars["--color-background-surface"],
    bottom: "var(--size-status-line, 0px)",
    paddingBlock: spacingVars["--spacing-3"],
    position: "sticky",
  },
});

/**
 * What a feature's session was opened for: the workflow's message, while the composer holds it,
 * and why it cannot go, when it cannot; and what follows a sent message.
 */
export type Handing = {
  notice?: string;
  onSent?: (session: string) => void;
  /** The controls of the workflow's run, like building in a fresh session. */
  options?: ReactNode;
  /** Whether the composer offers the feature's recommended message. */
  recommended?: boolean;
  workflow?: { file?: string; fresh?: boolean; trigger: Trigger };
};

/** Why a feature's session takes no message before its proposal is committed. */
export const NO_BRANCH = "This feature has no branch left: it is merged.";

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
  stretchHref,
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
  /** The address of the session's Activity at a stretch, which a recap line opens. */
  stretchHref?: (key?: string) => string;
}) {
  const fate = useFateClient();
  const session = useSession(id);
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
        agent={session.agent}
        place={session.place}
        status={{ label: session.statusLabel, status: session.status }}
        // Its own name once renamed, else its change's or feature's title.
        title={session.name ?? session.title}
        {...(rename ? { rename } : {})}
      />
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
              onAllow={allow}
              onTakenBack={takeBackInto(draft)}
              session={session}
              stretchHref={stretchHref}
            />
            <SessionEnd id={id} turns={session.turns} />
          </OffersProvider>
        </StoriesProvider>
      </div>
      <Attention folder={crumbs} session={session} />
      {error && <StatusText tone="error">{error}</StatusText>}
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
 * The address of the session's Activity at a stretch, which a recap line opens: on the session's
 * page, its own address; boxed in a document's column, the page of the session of `boxedIn`, the
 * feature's folder.
 */
function useStretchHref(boxedIn: string | undefined) {
  const here = useRepoPath();
  return (key?: string) =>
    stretchAddress(
      boxedIn === undefined ? window.location.pathname : here(sessionPath(boxedIn)),
      key,
    );
}

/**
 * What a session's pane is drawn in: a page, with its crumbs and the session's column, or,
 * `isBoxed`, the box it is in alone. A session that does not exist has no column.
 */
function Framed({
  children,
  crumbs,
  isBoxed,
  isMissing = false,
  session,
}: {
  children: ReactNode;
  crumbs?: string | undefined;
  isBoxed: boolean;
  isMissing?: boolean;
  session?: string | undefined;
}) {
  if (isBoxed) {
    return <div {...stylex.props(styles.box)}>{children}</div>;
  }
  const page = (
    <Page isSession isSnug>
      {crumbs !== undefined && <Crumbs folder={crumbs} session />}
      {children}
    </Page>
  );
  return isMissing ? page : <SessionColumn content={page} folder={crumbs} session={session} />;
}

/**
 * A session's pane: its header, transcript, and composer, and the session's column, or, before its
 * first message creates it, the title and the composer alone. A feature's or a new chat's first
 * message creates the session under the same composer, which keeps the field typed in, its focus,
 * and its text. `isBoxed`, it is drawn in the box that scrolls it, as a page's column, without its
 * crumbs and column: its transcript follows its end in that box, and its composer stays at the
 * box's foot.
 */
export function SessionPane({
  blocked,
  crumbs,
  draft,
  folder,
  handing = {},
  id,
  isBoxed = false,
  isNewSession = false,
  item,
  onSent,
  title,
}: {
  /** Why nothing can be sent to it, which disables the composer. */
  blocked?: string;
  crumbs?: string;
  draft: Draft;
  folder?: string;
  handing?: Handing;
  /** The session, once it exists. */
  id?: string;
  /** Drawn in the box that scrolls it, not as a page. */
  isBoxed?: boolean;
  /**
   * A new session of the feature in `folder`, which its first message creates: until then there
   * is none, and leaving makes none.
   */
  isNewSession?: boolean;
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
  const stretchHref = useStretchHref(isBoxed ? folder : undefined);
  if (session === null) {
    return (
      <Framed isBoxed={isBoxed} isMissing>
        <SessionLog controls={controls} draft={draft} id={id!} />
      </Framed>
    );
  }
  return (
    <Framed crumbs={crumbs} isBoxed={isBoxed} session={id}>
      {id === undefined ? (
        <VStack gap={3}>
          <SessionHeader title={title ?? ""} />
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
            stretchHref={stretchHref}
          />
        </Suspense>
      )}
      <div ref={composer} {...stylex.props(styles.composer, isBoxed && styles.boxedComposer)}>
        {jump && <JumpToLatest composer={composer} onJump={jump} />}
        <Composer
          {...(folder === undefined ? {} : { folder })}
          {...composerDraft(draft)}
          {...(id === undefined ? { isNewSession } : { session: id })}
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
    </Framed>
  );
}
