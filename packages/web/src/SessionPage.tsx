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
import { navigate, redirect, useRestoreScroll, useSearch } from "./routes.tsx";
import { sessionPath } from "./sessions.ts";
import { StatusMark } from "./StatusMark.tsx";
import { Transcript, useFollowEnd, useOpenAtEnd, useOpenGroups } from "./Transcript.tsx";
import { SessionView } from "./views.ts";

const styles = stylex.create({
  // The composer stays at the bottom of the pane or the window while the transcript scrolls.
  composer: {
    position: "sticky",
    bottom: 0,
    paddingBlock: spacingVars["--spacing-3"],
    backgroundColor: colorVars["--color-background-surface"],
  },
});

/** The session's cost, as the agent's latest result gave it. */
export function costText(costUsd: number) {
  return `$${costUsd.toFixed(2)} this session`;
}

/** A session's status: its dot, and its label. */
export function SessionStatus({ status, label }: { status: Status; label: string }) {
  return (
    <HStack gap={2} align="center">
      <StatusMark status={status} label={label} />
      <Text weight="semibold">{label}</Text>
    </HStack>
  );
}

/** A chat's title, renamed in place, and Archive, which hides it under "Archived" in the sidebar. */
type ChatControls = {
  onRename: (title: string) => Promise<string | undefined>;
  archived: boolean;
  onArchive: () => Promise<void>;
};

/**
 * A session's header: its title, then its status, agent, place, and cost on one line. A chat's
 * title is renamed in place, and the chat archived or brought back.
 */
function Header({
  title,
  status,
  place,
  costUsd,
  chat,
}: {
  title: string;
  status?: { status: Status; label: string };
  place?: string;
  costUsd?: number | null;
  chat?: ChatControls;
}) {
  const agent = useAgent();
  const wide = useWidthClass() === "wide";
  const meta = [agent?.name, place, costUsd == null ? undefined : costText(costUsd)].filter(
    (part): part is string => Boolean(part),
  );
  return (
    <VStack gap={1}>
      {/* Beside the feature page on wide screens, whose title is the page's heading. */}
      <Heading level={wide ? 2 : 1}>
        {chat ? <EditableLine value={title} label="Title" onSave={chat.onRename} /> : title}
      </Heading>
      <HStack gap={2} align="center" wrap="wrap">
        {status && <SessionStatus status={status.status} label={status.label} />}
        <Text type="supporting" color="secondary">
          {meta.join(" · ")}
        </Text>
        {chat && (
          <Button
            variant="secondary"
            size="sm"
            label={chat.archived ? "Unarchive" : "Archive"}
            clickAction={chat.onArchive}
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
  workflow?: { trigger: Trigger; file?: string };
  notice?: string;
  onSent?: (session: string) => void;
};

/** A session that exists: its header, its transcript, and its composer. */
function Session({
  id,
  crumbs,
  draft,
  handing = {},
}: {
  id: string;
  crumbs?: string;
  draft: Draft;
  handing?: Handing;
}) {
  const fate = useFateClient();
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
          status="error"
          title={`No session ${id}.`}
          collapsible={false}
          description={
            <Link href="/" hasUnderline>
              Open home
            </Link>
          }
        />
      </Page>
    );
  }
  const chat: ChatControls | undefined =
    session.folder === null
      ? {
          archived: session.archived,
          onRename: async (title) => {
            const result = await fate.mutations.session.rename({
              input: { session: id, title },
              view: SessionView,
            });
            return result.error ? refusal(result.error).message : undefined;
          },
          onArchive: async () => {
            setError(undefined);
            const result = await fate.mutations.session.archive({
              input: { session: id, archived: !session.archived },
              view: SessionView,
            });
            if (result.error) {
              setError(refusal(result.error).message);
            }
          },
        }
      : undefined;
  const allow = async (turn: string, seq: number) => {
    setError(undefined);
    const result = await fate.mutations.session.allow({
      input: { session: id, turn, seq },
      view: SessionView,
    });
    if (result.error) {
      setError(refusal(result.error).message);
    }
  };
  return (
    <Page>
      {crumbs !== undefined && <Crumbs folder={crumbs} current="Session" />}
      <VStack gap={3}>
        <Header
          title={session.title}
          status={{ status: session.status, label: session.statusLabel }}
          place={session.place}
          costUsd={session.costUsd}
          {...(chat ? { chat } : {})}
        />
        <div ref={log}>
          <Transcript
            session={session}
            groups={groups}
            onAllow={allow}
            canAllow={!working}
            onTakenBack={(back) => setText((now) => (now.trim() ? `${back}\n${now}` : back))}
          />
        </div>
        {error && <span {...stylex.props(statusStyles.error)}>{error}</span>}
      </VStack>
      <div {...stylex.props(styles.composer)}>
        <Composer session={id} working={working} value={text} onChange={setText} {...handing} />
      </div>
    </Page>
  );
}

/**
 * A session before its first message: a feature's, created by it, or a new chat, which opens at
 * its own address once sent.
 */
function NoSession({
  title,
  folder,
  crumbs,
  draft: [text, setText],
  handing = {},
  onSent,
}: {
  title: string;
  folder?: string;
  crumbs?: string;
  draft: Draft;
  handing?: Handing;
  onSent: (session: string) => void;
}) {
  return (
    <Page>
      {crumbs !== undefined && <Crumbs folder={crumbs} current="Session" />}
      <VStack gap={3}>
        <Header title={title} />
        <Transcript session={{ id: "", turns: [] }} />
      </VStack>
      <div {...stylex.props(styles.composer)}>
        <Composer
          {...(folder === undefined ? {} : { folder })}
          value={text}
          onChange={setText}
          {...handing}
          onSent={(session) => {
            onSent(session);
            handing.onSent?.(session);
          }}
        />
      </div>
    </Page>
  );
}

/** The workflow's message an address asks for: `?continue=<trigger>&file=<file>`. */
function useHandOver(search: string): { trigger: Trigger; file?: string } | undefined {
  const params = new URLSearchParams(search);
  const trigger = params.get("continue");
  const file = params.get("file");
  return trigger ? { trigger: trigger as Trigger, ...(file ? { file } : {}) } : undefined;
}

/** Reads the workflow's message for a feature, and gives it, or its refusal, to the page. */
function WorkflowMessage({
  folder,
  workflow,
  onRead,
}: {
  folder: string;
  workflow: { trigger: Trigger; file?: string };
  onRead: (message: { text: string; refusal: string | null }) => void;
}) {
  const message = useWorkflowMessage(folder, workflow.trigger, workflow.file);
  const text = message?.text;
  const refusal = message?.refusal;
  useEffect(() => {
    if (text !== undefined && refusal !== undefined) {
      onRead({ text, refusal });
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
          status="error"
          title={`No feature ${folder}.`}
          collapsible={false}
          description={
            <Link href="/" hasUnderline>
              Open home
            </Link>
          }
        />
      </Page>
    );
  }
  const crumbs = wide ? undefined : folder;
  const id = feature.session ?? created;
  const read = (message: { text: string; refusal: string | null }) => {
    setRefusal(message.refusal === null ? undefined : { search, text: message.refusal });
    if (message.refusal === null && filled.current !== search) {
      filled.current = search;
      const text = message.text.trimEnd();
      setText((now) => (now.trim() ? `${text}\n${now}` : text));
    }
  };
  // Sent: the address no longer asks for the message, or the quote.
  const sent = () => redirect(sessionPath(folder));
  const handing: Handing = workflow
    ? { workflow, ...(refused === undefined ? {} : { notice: refused }), onSent: sent }
    : ask !== undefined
      ? { onSent: sent }
      : {};
  return (
    <>
      {workflow && (
        <Suspense fallback={null}>
          <WorkflowMessage key={search} folder={folder} workflow={workflow} onRead={read} />
        </Suspense>
      )}
      {id === undefined ? (
        <NoSession
          title={feature.title}
          folder={folder}
          crumbs={crumbs}
          draft={draft}
          handing={handing}
          onSent={setCreated}
        />
      ) : (
        <Session id={id} crumbs={crumbs} draft={draft} handing={handing} />
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
  const draft = useState("");
  if ("folder" in props) {
    return <FeatureSession folder={props.folder} />;
  }
  if ("id" in props) {
    return <Session id={props.id} draft={draft} />;
  }
  return <NoSession title="New chat" draft={draft} onSent={(id) => navigate(`/chats/${id}`)} />;
}
