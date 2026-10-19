// The decisions page's check, as the inbox page's triage is: "Check decisions", which asks an agent
// for a check, and the banner of the check there is, which leads to answering it, then to applying
// it. Without an agent on this machine, the button gives its message to copy.
import { Button } from "@astryxdesign/core/Button";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { APPLY_DECISIONS_CHECK, RUN_DECISIONS_CHECK } from "uraeda-server/round-messages";
import { AgentMessage, RoundBanner, type StartChat } from "../StartChat.tsx";

/** "Check decisions": starts the check's chat, disabled while a check exists. */
export function CheckButton({ chat, check }: { chat: StartChat; check: string | null }) {
  return (
    <Button
      clickAction={() => chat.start(RUN_DECISIONS_CHECK)}
      isDisabled={check !== null}
      label="Check decisions"
    />
  );
}

/** Without an agent on this machine, "Check decisions" opens its message, to copy. */
export function CheckMessage() {
  return (
    <Collapsible trigger="Check decisions">
      <AgentMessage text={RUN_DECISIONS_CHECK} />
    </Collapsible>
  );
}

/** The check's banner: to answer it while it waits, to apply it once answered. */
export function DecisionsCheckBanner({
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
      apply={APPLY_DECISIONS_CHECK}
      chat={chat}
      href="/decisions/check"
      status={status}
      titles={{
        answered: "Your decisions check answers are ready to apply",
        waiting: "A decisions check waits for your answers",
      }}
    />
  );
}
