// The inbox page's triage: "Organize with an agent", which asks an agent for a triage, and the
// banner of the triage there is, which leads to answering it, then to applying it. Without an agent
// on this machine, each gives its message to copy, for an agent elsewhere.
import { Button } from "@astryxdesign/core/Button";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { APPLY_TRIAGE, ORGANIZE_INBOX } from "uraeda-server/round-messages";
import { AgentMessage, RoundBanner, type StartChat } from "./StartChat.tsx";

/** "Organize with an agent": starts the triage's chat, disabled while a triage exists. */
export function OrganizeButton({ chat, triage }: { chat: StartChat; triage: string | null }) {
  return (
    <Button
      clickAction={() => chat.start(ORGANIZE_INBOX)}
      isDisabled={triage !== null}
      label="Organize with an agent"
    />
  );
}

/** Without an agent on this machine, "Organize with an agent" opens its message, to copy. */
export function OrganizeMessage() {
  return (
    <Collapsible trigger="Organize with an agent">
      <AgentMessage text={ORGANIZE_INBOX} />
    </Collapsible>
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
