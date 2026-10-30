import { Suspense } from "react";
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
  turns: ReadonlyArray<string>;
};

/**
 * Why a session that needs attention stopped, and what the human does next, its item named as a
 * feature or a change; nothing for any other session. A failed run's text starts with its latest
 * turn's reason, when it has one.
 */
export function Attention({
  folder,
  session,
}: {
  folder?: string | undefined;
  session: AttentionSession;
}) {
  const reason = session.status === "attention" ? session.statusReason : undefined;
  const turn = session.turns.at(-1);
  if (!reason || !ATTENTION[reason]) {
    return null;
  }
  return reason === "failed" && turn !== undefined ? (
    <Suspense fallback={<AttentionBanner folder={folder} session={session} />}>
      <FailedBanner folder={folder} session={session} turn={turn} />
    </Suspense>
  ) : (
    <AttentionBanner folder={folder} session={session} />
  );
}

/** A failed run's banner, its latest turn's reason first. */
function FailedBanner({
  folder,
  session,
  turn,
}: {
  folder?: string | undefined;
  session: AttentionSession;
  turn: string;
}) {
  const ended = useTurn(turn)?.reason ?? undefined;
  return <AttentionBanner folder={folder} session={session} why={ended} />;
}

/** The banner, by why the session needs attention, `why` before its text; with its Dismiss. */
function AttentionBanner({
  folder,
  session,
  why,
}: {
  folder?: string | undefined;
  session: AttentionSession;
  why?: string | undefined;
}) {
  const workspace = useWorkspace();
  const { dismiss, error } = useDismiss();
  const item = workspace?.features.find((feature) => feature.folder === folder)?.kind ?? "feature";
  const turn = session.turns.at(-1);
  const reason = session.statusReason!;
  return (
    <RunBanner
      error={error}
      item={item}
      reason={reason}
      why={why}
      {...(turn !== undefined && isDismissable({ reason, status: session.status })
        ? { onDismiss: () => void dismiss({ session: session.id, turn }) }
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
