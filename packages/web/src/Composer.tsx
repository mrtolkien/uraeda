import { Button } from "@astryxdesign/core/Button";
import {
  ChatComposer,
  ChatComposerInput,
  type ChatComposerInputHandle,
  ChatSendButton,
} from "@astryxdesign/core/Chat";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { useFateClient } from "react-fate";
import type { Trigger } from "uraeda-server/fate";
import { useAgent } from "./data.ts";
import { refusal } from "./errors.ts";
import { useWidthClass } from "./layout/useWidthClass.ts";
import { sendMessage } from "./sessions.ts";
import { SessionView } from "./views.ts";

/**
 * What the status region says: that the agent replies while the session works, and that the reply
 * is complete once it stops working, never on a session already idle when shown.
 */
function useReplyStatus(agentName: string, working: boolean): string {
  const [said, setSaid] = useState(working ? `${agentName} is replying` : "");
  const was = useRef(working);
  useEffect(() => {
    if (working && !was.current) {
      setSaid(`${agentName} is replying`);
    } else if (!working && was.current) {
      setSaid("Reply complete");
    }
    was.current = working;
  }, [agentName, working]);
  return said;
}

/**
 * The composer under a transcript, on Astryx's `ChatComposer`: Send, which turns into Stop while
 * the session works, and reads "Start the agent" while it holds the workflow's message, or "Start
 * once this turn ends" while the session works on a chat. Enter sends on wide screens; on the
 * phone, Return adds a line and only the button sends. It sends to `session`, else to the feature
 * of `folder`, else to a new chat, then calls `onSent` with the session's ID. A refused send keeps the text, with the reason under it until the next send, as a
 * refused Stop does.
 * `notice` is the page's own reason under it, like the workflow's refusal to continue: with the
 * workflow's message, "Start the agent" stays, disabled, so the message never goes as a chat.
 * `blocked` disables it, with why, as when the agent is not on this machine.
 */
export function Composer({
  session,
  folder,
  working = false,
  value,
  onChange,
  workflow,
  notice,
  blocked,
  onSent,
}: {
  session?: string;
  folder?: string;
  /** Whether the session has a turn going: Stop shows, and Send steers into the turn. */
  working?: boolean;
  value: string;
  onChange: (value: string) => void;
  /** The workflow's trigger, while the composer holds its message. */
  workflow?: { trigger: Trigger; file?: string };
  /** Why the page cannot do what it was opened for, shown under the composer. */
  notice?: string;
  /** Why nothing can be sent here, like a feature with no branch yet: the composer is disabled. */
  blocked?: string;
  onSent?: (session: string) => void;
}) {
  const fate = useFateClient();
  const agent = useAgent();
  const wide = useWidthClass() === "wide";
  const input = useRef<ChatComposerInputHandle>(null);
  const [error, setError] = useState<string>();
  const name = agent?.name ?? "the agent";
  const status = useReplyStatus(name, working);
  // Why nothing can be sent: the agent is not on this machine, or the page says why.
  const disabled = agent?.available ? blocked : `${name} is not available on this machine.`;
  const refused = workflow !== undefined && notice !== undefined;

  const submit = (text: string) => {
    if (refused) {
      return;
    }
    setError(undefined);
    onChange("");
    void sendMessage(fate, {
      ...(session === undefined ? (folder === undefined ? {} : { folder }) : { session }),
      text,
      ...(workflow === undefined ? {} : { workflow }),
    }).then((sent) => {
      if (sent.ok) {
        onSent?.(sent.session);
      } else {
        onChange(text);
        setError(sent.message);
      }
    });
  };
  const stop = () => {
    if (session !== undefined) {
      setError(undefined);
      // The turn ends once the agent answers the interrupt: its live update brings the state.
      void fate.mutations.session.stop({ input: { session }, view: SessionView }).then((result) => {
        if (result.error) {
          setError(refusal(result.error).message);
        }
      });
    }
  };
  // On the phone, Return adds a line: the keyboard has no Shift to hold.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!wide && event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      input.current?.insertText("\n");
    }
  };
  const canSend = value.trim() !== "" && !disabled;
  const placeholder = `Message ${name}`;

  return (
    <>
      <ChatComposer
        value={value}
        onChange={onChange}
        onSubmit={submit}
        onStop={stop}
        isStopShown={working && !workflow}
        placeholder={placeholder}
        isDisabled={Boolean(disabled)}
        input={<ChatComposerInput label={placeholder} handleRef={input} onKeyDown={onKeyDown} />}
        sendActions={
          // During a turn, Send steers the message into it, beside Stop.
          working && canSend && !workflow ? <ChatSendButton isStopShown={false} /> : undefined
        }
        sendButton={
          workflow ? (
            <Button
              variant="primary"
              label={working ? "Start once this turn ends" : "Start the agent"}
              isDisabled={!canSend || refused}
              clickAction={() => submit(value.trim())}
            />
          ) : undefined
        }
        status={
          error
            ? { type: "error", message: error }
            : notice
              ? { type: "error", message: notice }
              : disabled
                ? { type: "warning", message: disabled }
                : undefined
        }
      />
      <VisuallyHidden as="div" role="status">
        {status}
      </VisuallyHidden>
    </>
  );
}
