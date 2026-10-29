// The inbox page's triage: "Organize with AI", which asks an agent for a triage, and the
// banner of the triage there is, which leads to answering it, then to applying it. Without an agent
// on this machine, each gives its message to copy, for an agent elsewhere.
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";
import { APPLY_TRIAGE, ORGANIZE_INBOX } from "uraeda-server/round-messages";
import { MessageToCopy, RoundBanner, type StartChat } from "./StartChat.tsx";
import { Foldable } from "./layout/Foldable.tsx";

/**
 * "Organize with AI", as the decisions page's "Review with AI": starts the triage's chat, gone
 * while a triage exists, whose banner leads to it. On the phone, its icon and "Organize".
 */
export function OrganizeButton({ chat, triage }: { chat: StartChat; triage: string | null }) {
  const narrow = isNarrow(useWidthClass());
  if (triage !== null) {
    return null;
  }
  return (
    <Button
      clickAction={() => chat.start(ORGANIZE_INBOX)}
      icon={<Icon icon="uraeda:step-questions" />}
      label="Organize with AI"
      variant="secondary"
    >
      {narrow ? "Organize" : undefined}
    </Button>
  );
}

/** Without an agent on this machine, "Organize with AI" opens its message, to copy. */
export function OrganizeMessage() {
  return (
    <Foldable label="Organize with AI">
      <MessageToCopy text={ORGANIZE_INBOX} />
    </Foldable>
  );
}

/**
 * The triage's banner: a triage waiting for the human links to its answering view, and an answered
 * one offers to apply it, in a chat while the agent works on this machine, else with the message to
 * give one.
 */
export function TriageBanner({
  agent,
  chat,
  status,
}: {
  agent: boolean;
  chat: StartChat;
  status: string;
}) {
  return (
    <RoundBanner
      agent={agent}
      apply={APPLY_TRIAGE}
      chat={chat}
      href="/inbox/triage"
      status={status}
      titles={{
        answered: "Your triage answers are ready to apply",
        waiting: "An inbox triage waits for your answers",
      }}
    />
  );
}
