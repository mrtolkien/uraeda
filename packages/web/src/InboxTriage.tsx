// The inbox page's triage: "Organize with AI", which asks an agent for a triage, and the
// banner of the triage there is, which leads to answering it, then to applying it, or dismisses it
// for a new one. Without an agent on this machine, each gives its message to copy, for an agent
// elsewhere.
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";
import { APPLY_TRIAGE, ORGANIZE_INBOX } from "uraeda-server/round-messages";
import { MessageToCopy, RoundBanner, type StartChat } from "./StartChat.tsx";
import { Foldable } from "./layout/Foldable.tsx";
import { useFateClient } from "react-fate";
import { TRIAGE_ID } from "uraeda-server/round-messages";
import { useRound } from "./data.ts";
import { refusal } from "./errors.ts";
import { useConfirm } from "./fields/Confirm.tsx";
import { InboxView } from "./views.ts";

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

/** What Dismiss asks when the triage holds answers not committed yet, which it deletes for good. */
export const DISMISS_UNSUBMITTED = {
  body: "The answers you saved but did not submit are deleted with it.",
  cancel: "Keep it",
  confirm: "Dismiss",
  destructive: true,
  title: "Dismiss the inbox triage?",
};

/**
 * Dismiss: deletes the triage and commits the deletion alone, so "Organize with AI" asks for a new
 * one. A triage committed as it is goes at once, as git keeps it; one holding answers saved but not
 * committed asks first, as those are lost. `onRefused` shows the server's refusal, as a triage
 * changed since it was read.
 */
export function DismissTriage({ onRefused }: { onRefused: (message: string) => void }) {
  const fate = useFateClient();
  const confirm = useConfirm();
  const file = useRound(TRIAGE_ID);
  if (!file || file.missing) {
    return null;
  }
  const dismiss = async () => {
    if (file.committed && !(await confirm(DISMISS_UNSUBMITTED))) {
      return;
    }
    const result = await fate.mutations.defaultRound.dismiss({
      input: {
        previous: file.current.document.hash,
        write: { href: "/inbox", label: "Dismissing the inbox triage" },
      },
      view: InboxView,
    });
    if (result.error) {
      onRefused(refusal(result.error).message);
    }
  };
  // Not a `clickAction`: its transition would hold the question back until the action ends, which
  // waits for the answer.
  // Ghost: the banner's own action, Answer it or Apply the answers, stays its one lead.
  return <Button label="Dismiss" onClick={() => void dismiss()} variant="ghost" />;
}

/**
 * The triage's banner: a triage waiting for the human links to its answering view, and an answered
 * one offers to apply it, in a chat while the agent works on this machine, else with the message to
 * give one. Either can be dismissed, for a new one.
 */
export function TriageBanner({
  agent,
  chat,
  onRefused,
  status,
}: {
  agent: boolean;
  chat: StartChat;
  onRefused: (message: string) => void;
  status: string;
}) {
  return (
    <RoundBanner
      agent={agent}
      apply={APPLY_TRIAGE}
      chat={chat}
      dismiss={<DismissTriage onRefused={onRefused} />}
      href="/inbox/triage"
      status={status}
      titles={{
        answered: "Your triage answers are ready to apply",
        waiting: "An inbox triage waits for your answers",
      }}
    />
  );
}
