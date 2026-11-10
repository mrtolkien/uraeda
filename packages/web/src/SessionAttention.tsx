import { Suspense, useState } from "react";
import type { SessionStatus, StatusReason } from "uraeda-server/fate";
import type { Wait } from "uraeda-server/status";
import { useWorkspace } from "./data.ts";
import { StatusText } from "./fields/StatusText.tsx";
import { AnnouncedBanner } from "./layout/AnnouncedBanner.tsx";
import { useTurn } from "./sessionData.ts";
import { isDismissable, useDismiss } from "./useDismiss.ts";
import { waitTime } from "./wait.ts";

/**
 * What a banner's text reads: the session's item, a feature or a change, its continues, and its
 * pull request's number, when it has one.
 */
type Of = { continues: number; item: string; pullRequest?: number | undefined };

/**
 * What a session that needs attention tells the human, by why it needs it, its item named as a
 * feature or a change. A failed, stopped, or interrupted run, a catch-up stopped on a conflict, and
 * a job's run whose change could not start, ask until dismissed: the text says so, and the banner has Dismiss. A run past the cap on automatic
 * continues says how many it had.
 */
const ATTENTION: Partial<
  Record<
    StatusReason,
    { status: "error" | "warning"; text: string | ((of: Of) => string); title: string }
  >
> = {
  capped: {
    status: "warning",
    text: ({ continues }) =>
      `Uraeda continued it ${continues} times in a row without a commit or a message from you, and stops there. Read its last message, then tell it how to go on, or dismiss this.`,
    title: "The agent keeps stopping.",
  },
  "change-refused": {
    status: "warning",
    text: "Start it from the offer's card above, or dismiss this.",
    title: "The change could not start by itself.",
  },
  conflict: {
    status: "warning",
    text: ({ pullRequest }) =>
      `It left the branch as it was, and asked on ${pullRequest === undefined ? "the pull request" : `pull request #${pullRequest}`} how to settle a conflict. Answer there by requesting changes, or dismiss this.`,
    title: "The catch-up stopped on a conflict.",
  },
  failed: {
    status: "error",
    text: "Read how it ended, then tell the agent how to go on, or dismiss this.",
    title: "The agent's run failed.",
  },
  halted: {
    status: "warning",
    text: ({ item }) =>
      `The ${item} still waits on the agent. Read its last message, then tell it how to go on.`,
    title: "The agent stopped before a human gate.",
  },
  interrupted: {
    status: "warning",
    text: "It was running when the server stopped. Tell the agent how to go on, or dismiss this.",
    title: "The server stopped the agent.",
  },
  stopped: {
    status: "warning",
    text: "Tell the agent how to go on when you are ready, or dismiss this.",
    title: "You stopped the agent.",
  },
};

/** A session that needs attention, or waits to continue, as the banner reads it. */
type AttentionSession = {
  /** The automatic continues in a row of its run, which a capped run's banner counts. */
  automaticContinues?: number;
  /** Why the change its job's run offered could not start, which that banner gives first. */
  changeRefusal?: string | null;
  id: string;
  status: SessionStatus;
  statusReason?: StatusReason | null;
  /** The turn its status follows: its latest not taken back. */
  statusTurn: string | null;
  /** When its run continues by itself, while it waits. */
  wait?: Wait | null;
};

/** The banner's Dismiss, and why the server refused it, held by `Attention`. */
type Dismissal = { error: string | undefined; onDismiss: (turn: string) => void };

/**
 * Why a session that needs attention stopped, and what the human does next, its item named as a
 * feature or a change; nothing for any other session. A failed run's text starts with the reason
 * of the turn its status follows, when it has one, and Dismiss sends that turn. The dismissal is
 * held here, not in the banner its idle status takes away at once: a refusal shows under the
 * banner, or alone in its place while it is hidden, as long as the run it concerns is the latest
 * or one still runs. Keyed by the session.
 */
export function Attention({
  folder,
  session,
}: {
  folder?: string | undefined;
  session: AttentionSession;
}) {
  const { dismiss, error } = useDismiss();
  const [sent, setSent] = useState<string>();
  const reason = session.status === "attention" ? session.statusReason : undefined;
  const turn = session.statusTurn ?? undefined;
  const refusal = turn === sent || session.status === "working" ? error : undefined;
  const dismissal: Dismissal = {
    error: refusal,
    onDismiss: (dismissed) => {
      setSent(dismissed);
      void dismiss({ folder, session: session.id, turn: dismissed });
    },
  };
  if (session.wait?.reason === "limit") {
    return <LimitWait wait={session.wait} />;
  }
  if (!reason || !ATTENTION[reason]) {
    return refusal ? (
      <StatusText role="alert" tone="error">
        {refusal}
      </StatusText>
    ) : null;
  }
  const banner = <AttentionBanner dismissal={dismissal} folder={folder} session={session} />;
  const Read = reason === "failed" ? FailedBanner : reason === "capped" ? CappedBanner : undefined;
  return Read && turn !== undefined ? (
    <Suspense fallback={banner}>
      <Read dismissal={dismissal} folder={folder} session={session} turn={turn} />
    </Suspense>
  ) : (
    banner
  );
}

/**
 * A run waiting for a usage limit's reset: when it continues, and what a message or Stop does
 * meanwhile. A restart's or a gate's wait lasts seconds, and has none: it would only flash.
 */
function LimitWait({ wait }: { wait: Wait }) {
  return (
    <AnnouncedBanner
      collapsible={false}
      description={`The run continues by itself at ${waitTime(wait)}. A message you send now goes to the agent at once, and Stop cancels the wait.`}
      status="info"
      title="Waiting for the usage limit's reset."
    />
  );
}

/** A failed run's banner, its turn's reason first. */
function FailedBanner({
  turn,
  ...banner
}: {
  dismissal: Dismissal;
  folder?: string | undefined;
  session: AttentionSession;
  turn: string;
}) {
  const ended = useTurn(turn)?.reason ?? undefined;
  return <AttentionBanner {...banner} why={ended} />;
}

/** A capped run's banner, with Dismiss when its turn failed or stopped: one ended done takes none. */
function CappedBanner({
  turn,
  ...banner
}: {
  dismissal: Dismissal;
  folder?: string | undefined;
  session: AttentionSession;
  turn: string;
}) {
  const state = useTurn(turn)?.state;
  return <AttentionBanner {...banner} turnState={state} />;
}

/** The banner, by why the session needs attention, `why` before its text; with its Dismiss. */
function AttentionBanner({
  dismissal,
  folder,
  session,
  turnState,
  why,
}: {
  dismissal: Dismissal;
  folder?: string | undefined;
  session: AttentionSession;
  turnState?: string | undefined;
  why?: string | undefined;
}) {
  const workspace = useWorkspace();
  const feature = workspace?.features.find((each) => each.folder === folder);
  const turn = session.statusTurn;
  const reason = session.statusReason!;
  return (
    <RunBanner
      continues={session.automaticContinues ?? 0}
      error={dismissal.error}
      item={feature?.kind ?? "feature"}
      pullRequest={feature?.pullRequest?.number}
      reason={reason}
      why={why ?? (reason === "change-refused" ? (session.changeRefusal ?? undefined) : undefined)}
      {...(turn !== null && isDismissable({ reason, status: session.status, turnState })
        ? { onDismiss: () => dismissal.onDismiss(turn) }
        : {})}
    />
  );
}

/**
 * The banner of a run that needs attention, by `reason`, its item named as `item`, `why` before
 * its text, a capped run's automatic `continues` counted, a conflict's `pullRequest` named; with
 * Dismiss when `onDismiss` is given, and why the server refused it, `error`, under it.
 */
export function RunBanner({
  continues = 0,
  error,
  item = "feature",
  onDismiss,
  pullRequest,
  reason,
  why,
}: {
  continues?: number;
  error?: string | undefined;
  item?: string;
  onDismiss?: () => void;
  pullRequest?: number | undefined;
  reason: StatusReason;
  why?: string | undefined;
}) {
  const attention = ATTENTION[reason];
  if (!attention) {
    return null;
  }
  const text =
    typeof attention.text === "string"
      ? attention.text
      : attention.text({ continues, item, pullRequest });
  return (
    <>
      <AnnouncedBanner
        collapsible={false}
        description={why ? `${why}${/[.!?]$/.test(why) ? "" : "."} ${text}` : text}
        status={attention.status}
        title={attention.title}
        {...(onDismiss ? { dismissLabel: "Dismiss", isDismissable: true, onDismiss } : {})}
      />
      {error && (
        <StatusText role="alert" tone="error">
          {error}
        </StatusText>
      )}
    </>
  );
}
