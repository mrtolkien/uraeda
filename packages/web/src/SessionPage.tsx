import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { Suspense, useEffect, useRef, useState } from "react";
import { useFateClient } from "react-fate";
import type { SessionStatus as Status, Trigger } from "uraeda-server/fate";
import { Composer } from "./Composer.tsx";
import { Crumbs } from "./Crumbs.tsx";
import { useAgent, useFeature, useSession, useWorkflowMessage } from "./data.ts";
import { EditableLine } from "./EditableLine.tsx";
import { refusal } from "./errors.ts";
import { Page } from "./layout/Page.tsx";
import { useWidthClass } from "./layout/useWidthClass.ts";
import { statusStyles } from "./Question.tsx";
import { navigate, redirect, useRepoPath, useRestoreScroll, useSearch } from "./routes.tsx";
import { sessionPath } from "./sessions.ts";
import { StatusMark } from "./StatusMark.tsx";
import { Transcript, useFollowEnd, useOpenAtEnd, useOpenGroups } from "./Transcript.tsx";
import { SessionView } from "./views.ts";

const styles = stylex.create({
  composer: {
    // The composer stays at the bottom of the pane or the window while the transcript scrolls.
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

/** A chat's title, renamed in place, and Archive, which hides it under "Archived" in the sidebar. */
type ChatControls = {
  archived: boolean;
  onArchive: () => Promise<void>;
  onRename: (title: string) => Promise<string | undefined>;
};

/**
 * A session's header: its title, then its status, agent, and place on one line. A chat's
 * title is renamed in place, and the chat archived or brought back.
 */
function Header({
  chat,
  place,
  status,
  title,
}: {
  chat?: ChatControls;
  place?: string;
  status?: { label: string; status: Status };
  title: string;
}) {
  const agent = useAgent();
  const wide = useWidthClass() === "wide";
  const meta = [agent?.name, place].filter((part): part is string => Boolean(part));
  return (
    <VStack gap={1}>
      {/* Beside the feature page on wide screens, whose title is the page's heading. */}
      <Heading level={wide ? 2 : 1}>
        {chat ? <EditableLine label="Title" onSave={chat.onRename} value={title} /> : title}
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
      </HStack>
    </VStack>
  );
}

/** The composer's text, kept by the view while its session is created under it. */
type Draft = [string, (update: string | ((now: string) => string)) => void];

/**
 * What a feature's session was opened for: the workflow's message, while the composer holds it,
 * and why it cannot go, when it cannot; and what follows a sent message.
 */
type Handing = {
  notice?: string;
  onSent?: (session: string) => void;
  workflow?: { file?: string; trigger: Trigger };
};

/** A session that exists: its header, its transcript, and its composer. */
// oxlint-disable-next-line max-lines-per-function -- over the limit before the code quality decision: the chat controls in a hook
function Session({
  blocked,
  crumbs,
  draft,
  handing = {},
  id,
}: {
  /** Why nothing can be sent to it, which disables the composer. */
  blocked?: string;
  crumbs?: string;
  draft: Draft;
  handing?: Handing;
  id: string;
}) {
  const fate = useFateClient();
  const here = useRepoPath();
  const session = useSession(id);
  const groups = useOpenGroups();
  const log = useRef<HTMLDivElement>(null);
  const [text, setText] = draft;
  const [error, setError] = useState<string>();
  const working = session?.status === "working";
  useOpenAtEnd(log);
  useFollowEnd(log, working);
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
      <Page>
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
      </Page>
    );
  }
  const chat: ChatControls | undefined =
    session.folder === null
      ? {
          archived: session.archived,
          onArchive: async () => {
            setError(undefined);
            const result = await fate.mutations.session.archive({
              input: { archived: !session.archived, session: id },
              view: SessionView,
            });
            if (result.error) {
              setError(refusal(result.error).message);
            }
          },
          onRename: async (title) => {
            const result = await fate.mutations.session.rename({
              input: { session: id, title },
              view: SessionView,
            });
            return result.error ? refusal(result.error).message : undefined;
          },
        }
      : undefined;
  const allow = async (turn: string, seq: number) => {
    setError(undefined);
    const result = await fate.mutations.session.allow({
      input: { seq, session: id, turn },
      view: SessionView,
    });
    if (result.error) {
      setError(refusal(result.error).message);
    }
  };
  return (
    <Page>
      {crumbs !== undefined && <Crumbs current="Session" folder={crumbs} />}
      <VStack gap={3}>
        <Header
          place={session.place}
          status={{ label: session.statusLabel, status: session.status }}
          title={session.title}
          {...(chat ? { chat } : {})}
        />
        <div ref={log}>
          <Transcript
            canAllow={!working}
            groups={groups}
            onAllow={allow}
            onTakenBack={(back) => setText((now) => (now.trim() ? `${back}\n${now}` : back))}
            session={session}
          />
        </div>
        {error && <span {...stylex.props(statusStyles.error)}>{error}</span>}
      </VStack>
      <div {...stylex.props(styles.composer)}>
        <Composer
          onChange={setText}
          session={id}
          value={text}
          working={working}
          {...handing}
          {...(blocked === undefined ? {} : { blocked })}
        />
      </div>
    </Page>
  );
}

/**
 * A session before its first message: a feature's, created by it, or a new chat, which opens at
 * its own address once sent.
 */
function NoSession({
  blocked,
  crumbs,
  draft: [text, setText],
  folder,
  handing = {},
  onSent,
  title,
}: {
  /** Why nothing can be sent to it, which disables the composer. */
  blocked?: string;
  crumbs?: string;
  draft: Draft;
  folder?: string;
  handing?: Handing;
  onSent: (session: string) => void;
  title: string;
}) {
  return (
    <Page>
      {crumbs !== undefined && <Crumbs current="Session" folder={crumbs} />}
      <VStack gap={3}>
        <Header title={title} />
        <Transcript session={{ id: "", turns: [] }} />
      </VStack>
      <div {...stylex.props(styles.composer)}>
        <Composer
          {...(folder === undefined ? {} : { folder })}
          onChange={setText}
          value={text}
          {...handing}
          {...(blocked === undefined ? {} : { blocked })}
          onSent={(session) => {
            onSent(session);
            handing.onSent?.(session);
          }}
        />
      </div>
    </Page>
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
  const wide = useWidthClass() === "wide";
  // A session created here shows before the feature's live update names it.
  const [created, setCreated] = useState<string>();
  const draft = useState("");
  const [, setText] = draft;
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
  const crumbs = wide ? undefined : folder;
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
      {id === undefined ? (
        <NoSession
          crumbs={crumbs}
          draft={draft}
          folder={folder}
          handing={handing}
          title={feature.title}
          {...(blocked === undefined ? {} : { blocked })}
          onSent={setCreated}
        />
      ) : (
        <Session
          crumbs={crumbs}
          draft={draft}
          handing={handing}
          id={id}
          {...(blocked === undefined ? {} : { blocked })}
        />
      )}
    </>
  );
}

/**
 * A session's view: a feature's, by its folder, beside its feature page on wide screens; a chat, by
 * its ID; or an empty chat, which its first message creates.
 */
export function SessionPage(props: { folder: string } | { id: string } | { newChat: true }) {
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(true);
  const here = useRepoPath();
  const draft = useState("");
  if ("folder" in props) {
    return <FeatureSession folder={props.folder} />;
  }
  if ("id" in props) {
    return <Session draft={draft} id={props.id} />;
  }
  return (
    <NoSession draft={draft} onSent={(id) => navigate(here(`/chats/${id}`))} title="New chat" />
  );
}
