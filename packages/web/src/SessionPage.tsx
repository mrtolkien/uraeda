import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFateClient, useView } from "react-fate";
import type { Session, SessionStatus as Status, StatusReason, Trigger } from "uraeda-server/fate";
import { Composer } from "./Composer.tsx";
import { Crumbs } from "./Crumbs.tsx";
import { useAgent, useFeature, useSession, useWorkflowMessage } from "./data.ts";
import { composerDraft, type Draft, takeBackInto, useDraft } from "./useDraft.ts";
import { EditableLine } from "./EditableLine.tsx";
import { JumpToLatest } from "./JumpToLatest.tsx";
import { useFollowEnd, useOpenAtEnd } from "./following.ts";
import { type AsideShown, AsideToggle, useAsideShown, WithAside } from "./SessionAside.tsx";
import { SessionAnnouncer, useCreatedHere } from "./SessionAnnouncer.tsx";
import { Page } from "./layout/Page.tsx";
import { ProgressLine } from "./ProgressLine.tsx";
import { statusStyles } from "./Question.tsx";
import { navigate, redirect, useRepoPath, useRestoreScroll, useSearch } from "./routes.tsx";
import { sessionPath } from "./sessions.ts";
import { type ChatControls, useSessionControls } from "./useSessionControls.ts";
import { StatusMark } from "./StatusMark.tsx";
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

/** A session's status: its dot, and its label. */
export function SessionStatus({ label, status }: { label: string; status: Status }) {
  return (
    <HStack align="center" gap={2}>
      <StatusMark label={label} status={status} />
      <Text weight="semibold">{label}</Text>
    </HStack>
  );
}

/**
 * A session's header: its title, then its status, agent, and place on one line. A chat's
 * title is renamed in place, and the chat archived or brought back. A feature's folds its column.
 */
function Header({
  aside,
  chat,
  place,
  status,
  title,
}: {
  aside?: AsideShown | undefined;
  chat?: ChatControls;
  place?: string;
  status?: { label: string; status: Status };
  title: string;
}) {
  const agent = useAgent();
  const meta = [agent?.name, place].filter((part): part is string => Boolean(part));
  return (
    <VStack gap={1}>
      <Heading level={1}>
        {chat ? (
          <EditableLine field={chat.field} label="Title" onSave={chat.onRename} value={title} />
        ) : (
          title
        )}
      </Heading>
      <HStack align="center" gap={2} wrap="wrap">
        {status && <SessionStatus label={status.label} status={status.status} />}
        <Text color="secondary" type="supporting">
          {meta.join(" · ")}
        </Text>
        {chat && (
          <Button
            clickAction={chat.onArchive}
            label={chat.archived ? "Unarchive" : "Archive"}
            size="sm"
            variant="secondary"
          />
        )}
        {aside && <AsideToggle aside={aside} />}
      </HStack>
    </VStack>
  );
}

/**
 * What a feature's session was opened for: the workflow's message, while the composer holds it,
 * and why it cannot go, when it cannot; and what follows a sent message.
 */
type Handing = {
  notice?: string;
  onSent?: (session: string) => void;
  workflow?: { file?: string; trigger: Trigger };
};

/** What a session that needs attention tells the human, by why it needs it. */
const ATTENTION: Partial<
  Record<StatusReason, { status: "error" | "warning"; text: string; title: string }>
> = {
  failed: {
    status: "error",
    text: "Read how it ended, then tell the agent how to go on.",
    title: "The agent's run failed.",
  },
  halted: {
    status: "warning",
    text: "The feature still waits on the agent. Read its last message, then tell it how to go on.",
    title: "The agent stopped before a human gate.",
  },
  stopped: {
    status: "warning",
    text: "Tell the agent how to go on when you are ready.",
    title: "You stopped the agent.",
  },
};

/**
 * A session's header, transcript, and errors, or why there is no session `id`. While the human
 * reads above its end, it gives the pane the jump back to the latest.
 */
function SessionLog({
  aside,
  crumbs,
  draft,
  id,
  onJump,
}: {
  /** A feature's column, shown or not. */
  aside?: AsideShown | undefined;
  crumbs?: string | undefined;
  draft: Draft;
  id: string;
  /** Called with the jump to the latest while the page does not follow the end, or `undefined`. */
  onJump?: (jump: (() => void) | undefined) => void;
}) {
  const fate = useFateClient();
  const here = useRepoPath();
  const session = useSession(id);
  const { allow, chat, error } = useSessionControls(id, session);
  const groups = useOpenKeys();
  const log = useRef<HTMLDivElement>(null);
  const working = session?.status === "working";
  useOpenAtEnd(log);
  const { following, jumpToLatest } = useFollowEnd(log, working);
  useKeepPlace(log);
  useEffect(() => {
    onJump?.(following ? undefined : jumpToLatest);
    // Once per change of following: `onJump` is a new function at each draw.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
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
    return (
      <Banner
        collapsible={false}
        description={
          <Link hasUnderline href={here("/")}>
            Open home
          </Link>
        }
        status="error"
        title={`No session ${id}.`}
      />
    );
  }
  const attention =
    session.status === "attention" && session.statusReason
      ? ATTENTION[session.statusReason]
      : undefined;
  return (
    <VStack gap={3}>
      <Header
        aside={aside}
        place={session.place}
        status={{ label: session.statusLabel, status: session.status }}
        title={session.title}
        {...(chat ? { chat } : {})}
      />
      {crumbs !== undefined && <ProgressLine folder={crumbs} session={id} />}
      <div ref={log}>
        <Transcript
          canAllow={!working}
          groups={groups}
          onAllow={allow}
          onTakenBack={takeBackInto(draft)}
          session={session}
        />
      </div>
      {attention && (
        <Banner
          collapsible={false}
          description={attention.text}
          status={attention.status}
          title={attention.title}
        />
      )}
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
  /** Called with the session a message created, before it exists. */
  onSent?: (session: string) => void;
  /** The title before the session exists. */
  title?: string;
}) {
  const session = useSessionRecord(id);
  const composer = useRef<HTMLDivElement>(null);
  const [jump, setJump] = useState<() => void>();
  if (session === null) {
    return (
      <Page>
        <SessionLog draft={draft} id={id!} />
      </Page>
    );
  }
  return (
    <WithAside aside={aside} folder={crumbs} {...(id === undefined ? {} : { session: id })}>
      <Page>
        {crumbs !== undefined && <Crumbs folder={crumbs} session />}
        {id === undefined ? (
          <VStack gap={3}>
            <Header aside={aside} title={title ?? ""} />
            {crumbs !== undefined && <ProgressLine folder={crumbs} />}
            <Transcript session={{ id: "", turns: [] }} />
          </VStack>
        ) : (
          // Read once the first message created the session: its title stays, and the composer, as
          // it is read. The transcript waits for it: a page shows one log.
          <Suspense fallback={title === undefined ? null : <Header aside={aside} title={title} />}>
            <SessionLog
              aside={aside}
              crumbs={crumbs}
              draft={draft}
              id={id}
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
const NO_BRANCH = "This feature has no branch yet: commit its proposal first.";

/** The workflow's message an address asks for: `?continue=<trigger>&file=<file>`. */
function useHandOver(search: string): { file?: string; trigger: Trigger } | undefined {
  const params = new URLSearchParams(search);
  const trigger = params.get("continue");
  const file = params.get("file");
  return trigger ? { trigger: trigger as Trigger, ...(file ? { file } : {}) } : undefined;
}

/** Reads the workflow's message for a feature, and gives it, or its refusal, to the page. */
function WorkflowMessage({
  folder,
  onRead,
  workflow,
}: {
  folder: string;
  onRead: (message: { refusal: string | null; text: string }) => void;
  workflow: { file?: string; trigger: Trigger };
}) {
  const message = useWorkflowMessage(folder, workflow.trigger, workflow.file);
  const text = message?.text;
  const refusal = message?.refusal;
  useEffect(() => {
    if (text !== undefined && refusal !== undefined) {
      onRead({ refusal, text });
    }
    // Once per message read: `onRead` is a new function at each draw.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [text, refusal]);
  return null;
}

/**
 * A feature's session: created with its first message, which this view sends. Opened to hand the
 * feature over (`?continue=<trigger>&file=<file>`), its composer starts with the workflow's
 * message, before what the human already typed, and Send reads "Start the agent" until it is sent.
 * Opened to ask about a block (`?ask=<quote>`), it starts with the quote and an empty line.
 */
function FeatureSession({ folder }: { folder: string }) {
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
    return (
      <Page>
        <Banner
          collapsible={false}
          description={
            <Link hasUnderline href={here("/")}>
              Open home
            </Link>
          }
          status="error"
          title={`No feature ${folder}.`}
        />
      </Page>
    );
  }
  // A feature whose proposal is not committed has no branch for the agent to work on: the server
  // refuses every message with the same words.
  const blocked = feature.branch ? undefined : NO_BRANCH;
  const id = feature.session ?? created;
  const read = (message: { refusal: string | null; text: string }) => {
    setRefusal(message.refusal === null ? undefined : { search, text: message.refusal });
    if (message.refusal === null && filled.current !== search) {
      filled.current = search;
      const text = message.text.trimEnd();
      setText((now) => (now.trim() ? `${text}\n${now}` : text));
    }
  };
  // Sent: the address no longer asks for the message, or the quote.
  const sent = () => redirect(here(sessionPath(folder)));
  const handing: Handing = workflow
    ? { workflow, ...(refused === undefined ? {} : { notice: refused }), onSent: sent }
    : ask !== undefined
      ? { onSent: sent }
      : {};
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

/** A chat, with its announcer. */
function ChatSession({ draft, id }: { draft: Draft; id: string }) {
  const created = useCreatedHere();
  return (
    <>
      <SessionPane draft={draft} id={id} />
      <SessionAnnouncer created={created} session={id} />
    </>
  );
}

/**
 * A session's page: a feature's, by its folder; a chat, by its ID; or an empty chat, which its
 * first message creates.
 */
export function SessionPage(props: { folder: string } | { id: string } | { newChat: true }) {
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(true);
  const here = useRepoPath();
  const draft = useDraft();
  if ("folder" in props) {
    return <FeatureSession folder={props.folder} />;
  }
  if ("id" in props) {
    return <ChatSession draft={draft} id={props.id} />;
  }
  return (
    <SessionPane
      draft={draft}
      onSent={(id) => navigate(here(`/chats/${id}`), { created: true })}
      title="New chat"
    />
  );
}
