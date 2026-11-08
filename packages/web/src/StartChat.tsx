// What the inbox page and the decisions page share to ask an agent for a round on the default
// branch: a chat started in the main checkout, and the message to give an agent elsewhere.
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { HStack } from "@astryxdesign/core/HStack";
import { VStack } from "@astryxdesign/core/VStack";
import { type ReactNode, useState } from "react";
import { useFateClient } from "react-fate";
import { Paragraph } from "./layout/Paragraph.tsx";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";
import { navigate, sessionIdPath, useRepoPath } from "./routes.tsx";
import { RuntimePicker } from "./RuntimePicker.tsx";
import { sendMessage } from "./sessions.ts";

/** A chat started from a page: `start` sends a message, `error` is the server's refusal. */
export type StartChat = ReturnType<typeof useStartChat>;

/**
 * Starts a chat in the main checkout with a message, then opens it; `error` is the server's
 * refusal. The chat runs on `runtime`, once picked, else on the first one on.
 */
export function useStartChat() {
  const fate = useFateClient();
  const here = useRepoPath();
  const [error, setError] = useState<string>();
  const [runtime, setRuntime] = useState<string>();
  const start = async (text: string) => {
    setError(undefined);
    const sent = await sendMessage(fate, { text, ...(runtime === undefined ? {} : { runtime }) });
    if (sent.ok) {
      navigate(here(sessionIdPath(sent.session)), { created: true });
    } else {
      setError(sent.message);
    }
  };
  return { error, runtime, setRuntime, start };
}

/**
 * The banner of a round on the default branch: one waiting for the human links to its answering
 * view, `href`, and an answered one offers to apply it, in a chat while the agent works on this
 * machine, on the runtime picked beside it when two or more are on, else with the message to give
 * one, `apply`.
 */
export function RoundBanner({
  agent,
  apply,
  chat,
  dismiss,
  href,
  status,
  titles,
}: {
  agent: boolean;
  apply: string;
  chat: StartChat;
  /** A second action after the first, the triage's Dismiss. */
  dismiss?: ReactNode;
  href: string;
  status: string;
  titles: { answered: string; waiting: string };
}) {
  const here = useRepoPath();
  // On the phone, the actions go under the title, which keeps the banner's width.
  const narrow = isNarrow(useWidthClass());
  const placed = (action?: ReactNode) => {
    const actions =
      action && dismiss ? (
        <HStack gap={2} wrap="wrap">
          {action}
          {dismiss}
        </HStack>
      ) : (
        (action ?? dismiss)
      );
    return actions ? (narrow ? { description: actions } : { endContent: actions }) : {};
  };
  if (status === "answered") {
    return agent ? (
      <Banner
        collapsible={false}
        {...placed(
          <HStack align="center" gap={2} wrap="wrap">
            <RuntimePicker onChange={chat.setRuntime} value={chat.runtime} />
            <Button clickAction={() => chat.start(apply)} label="Apply the answers" />
          </HStack>,
        )}
        status="info"
        title={titles.answered}
      />
    ) : (
      <Banner
        collapsible={false}
        // Without an agent, the message to copy is its action, and Dismiss alone sits on the side.
        {...placed()}
        status="info"
        title={titles.answered}
      >
        <MessageToCopy text={apply} />
      </Banner>
    );
  }
  return (
    <Banner
      collapsible={false}
      // A link drawn as a button: as tall as a control, for a finger.
      {...placed(<Button href={here(href)} label="Answer it" />)}
      status="info"
      title={titles.waiting}
    />
  );
}

/** A message to give an agent in this repository, with a button that copies it. */
export function MessageToCopy({ text }: { text: string }) {
  return (
    <VStack align="start" gap={2}>
      <Paragraph>Give this message to an agent in this repository:</Paragraph>
      <CodeBlock code={text} hasCopyButton={false} isWrapped size="sm" width="100%" />
      <Button label="Copy the message" onClick={() => void navigator.clipboard?.writeText(text)} />
    </VStack>
  );
}
