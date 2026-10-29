// The decisions page's check, as the inbox page's triage is: "Review with AI", which asks an agent
// for a check, and the banner of the check there is, which leads to answering it, then to applying
// it. Without an agent on this machine, the button gives its message to copy.
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { APPLY_DECISIONS_CHECK, RUN_DECISIONS_CHECK } from "uraeda-server/round-messages";
import { MessageToCopy, RoundBanner, type StartChat } from "../StartChat.tsx";
import { Foldable } from "../layout/Foldable.tsx";

/**
 * "Review with AI": starts the check's chat, gone while a check exists, whose banner leads to it.
 * On the phone, its question icon and "Ask", beside "Jump to…" on one line.
 */
export function CheckButton({ chat, check }: { chat: StartChat; check: string | null }) {
  const narrow = isNarrow(useWidthClass());
  if (check !== null) {
    return null;
  }
  return (
    <Button
      clickAction={() => chat.start(RUN_DECISIONS_CHECK)}
      icon={<Icon icon="uraeda:step-questions" />}
      label="Review with AI"
      variant="secondary"
    >
      {narrow ? "Ask" : undefined}
    </Button>
  );
}

/** Without an agent on this machine, "Review with AI" opens its message, to copy. */
export function CheckMessage() {
  return (
    <Foldable label="Review with AI">
      <MessageToCopy text={RUN_DECISIONS_CHECK} />
    </Foldable>
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
