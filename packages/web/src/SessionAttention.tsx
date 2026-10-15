import { Banner } from "@astryxdesign/core/Banner";
import type { SessionStatus, StatusReason } from "uraeda-server/fate";
import { useWorkspace } from "./data.ts";

/**
 * What a session that needs attention tells the human, by why it needs it, its item named as a
 * feature or a change.
 */
const ATTENTION: Partial<
  Record<
    StatusReason,
    { status: "error" | "warning"; text: string | ((item: string) => string); title: string }
  >
> = {
  failed: {
    status: "error",
    text: "Read how it ended, then tell the agent how to go on.",
    title: "The agent's run failed.",
  },
  halted: {
    status: "warning",
    text: (item) =>
      `The ${item} still waits on the agent. Read its last message, then tell it how to go on.`,
    title: "The agent stopped before a human gate.",
  },
  stopped: {
    status: "warning",
    text: "Tell the agent how to go on when you are ready.",
    title: "You stopped the agent.",
  },
};

/**
 * Why a session that needs attention stopped, and what the human does next, its item named as a
 * feature or a change; nothing for any other session.
 */
export function Attention({
  folder,
  session,
}: {
  folder?: string | undefined;
  session: { status: SessionStatus; statusReason?: StatusReason | null };
}) {
  const workspace = useWorkspace();
  const attention =
    session.status === "attention" && session.statusReason
      ? ATTENTION[session.statusReason]
      : undefined;
  if (!attention) {
    return null;
  }
  const item = workspace?.features.find((feature) => feature.folder === folder)?.kind ?? "feature";
  return (
    <Banner
      collapsible={false}
      description={typeof attention.text === "string" ? attention.text : attention.text(item)}
      status={attention.status}
      title={attention.title}
    />
  );
}
