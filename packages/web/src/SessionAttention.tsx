import { Suspense, useState } from "react";
import type { SessionStatus, StatusReason } from "uraeda-server/fate";
import { useWorkspace } from "./data.ts";
import { StatusText } from "./fields/StatusText.tsx";
import { AnnouncedBanner } from "./layout/AnnouncedBanner.tsx";
import { useTurn } from "./sessionData.ts";
import { isDismissable, useDismiss } from "./useDismiss.ts";

/**
 * What a session that needs attention tells the human, by why it needs it, its item named as a
 * feature or a change. A failed, stopped, or interrupted run asks until dismissed: its text says
 * so, and the banner has Dismiss.
 */
const ATTENTION: Partial<
  Record<
    StatusReason,
    { status: "error" | "warning"; text: string | ((item: string) => string); title: string }
  >
> = {
  failed: {
    status: "error",
    text: "Read how it ended, then tell the agent how to go on, or dismiss this.",
    title: "The agent's run failed.",
  },
  halted: {
    status: "warning",
    text: (item) =>
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

/** A session that needs attention, as the banner reads it. */
type AttentionSession = {
  id: string;
  status: SessionStatus;
  statusReason?: StatusReason | null;
  /** The turn its status follows: its latest not taken back. */
  statusTurn: string | null;
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
  if (!reason || !ATTENTION[reason]) {
    return refusal ? (
      <StatusText role="alert" tone="error">
        {refusal}
      </StatusText>
    ) : null;
  }
  const banner = <AttentionBanner dismissal={dismissal} folder={folder} session={session} />;
  return reason === "failed" && turn !== undefined ? (
    <Suspense fallback={banner}>
      <FailedBanner dismissal={dismissal} folder={folder} session={session} turn={turn} />
    </Suspense>
  ) : (
    banner
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

/** The banner, by why the session needs attention, `why` before its text; with its Dismiss. */
function AttentionBanner({
  dismissal,
  folder,
  session,
  why,
}: {
  dismissal: Dismissal;
  folder?: string | undefined;
  session: AttentionSession;
  why?: string | undefined;
}) {
  const workspace = useWorkspace();
  const item = workspace?.features.find((feature) => feature.folder === folder)?.kind ?? "feature";
  const turn = session.statusTurn;
  const reason = session.statusReason!;
  return (
    <RunBanner
      error={dismissal.error}
      item={item}
      reason={reason}
      why={why}
      {...(turn !== null && isDismissable({ reason, status: session.status })
        ? { onDismiss: () => dismissal.onDismiss(turn) }
        : {})}
    />
  );
}

/**
 * The banner of a run that needs attention, by `reason`, its item named as `item`, `why` before
 * its text; with Dismiss when `onDismiss` is given, and why the server refused it, `error`, under
 * it.
 */
export function RunBanner({
  error,
  item = "feature",
  onDismiss,
  reason,
  why,
}: {
  error?: string | undefined;
  item?: string;
  onDismiss?: () => void;
  reason: StatusReason;
  why?: string | undefined;
}) {
  const attention = ATTENTION[reason];
  if (!attention) {
    return null;
  }
  const text = typeof attention.text === "string" ? attention.text : attention.text(item);
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
