// The inbox page's triage: "Organize with an agent", which asks an agent for a triage, and the
// banner of the triage there is, which leads to answering it, then to applying it. Without an agent
// on this machine, each gives its message to copy, for an agent elsewhere.
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { VStack } from "@astryxdesign/core/VStack";
import { typeScaleVars, typographyVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { useFateClient } from "react-fate";
import { APPLY_TRIAGE, ORGANIZE_INBOX } from "uraeda-server/triage-messages";
import { Paragraph } from "./layout/Paragraph.tsx";
import { navigate, useRepoPath } from "./routes.tsx";
import { sendMessage } from "./sessions.ts";

const styles = stylex.create({
  message: {
    fontFamily: typographyVars["--font-family-code"],
    fontSize: typeScaleVars["--text-code-size"],
    margin: 0,
    whiteSpace: "pre-wrap",
  },
});

/** A chat started from the inbox page: `start` sends a message, `error` is the server's refusal. */
export type StartChat = ReturnType<typeof useStartChat>;

/**
 * Starts a chat in the main checkout with a message, then opens it; `error` is the server's refusal.
 */
export function useStartChat() {
  const fate = useFateClient();
  const here = useRepoPath();
  const [error, setError] = useState<string>();
  const start = async (text: string) => {
    setError(undefined);
    const sent = await sendMessage(fate, { text });
    if (sent.ok) {
      navigate(here(`/chats/${sent.session}`), { created: true });
    } else {
      setError(sent.message);
    }
  };
  return { error, start };
}

/** A message to give an agent in this repository, with a button that copies it. */
function AgentMessage({ text }: { text: string }) {
  return (
    <VStack align="start" gap={2}>
      <Paragraph>Give this message to an agent in this repository:</Paragraph>
      <pre {...stylex.props(styles.message)}>{text}</pre>
      <Button label="Copy the message" onClick={() => void navigator.clipboard?.writeText(text)} />
    </VStack>
  );
}

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
  const here = useRepoPath();
  if (status === "answered") {
    return agent ? (
      <Banner
        collapsible={false}
        endContent={
          <Button clickAction={() => chat.start(APPLY_TRIAGE)} label="Apply the answers" />
        }
        status="info"
        title="Your triage answers are ready to apply"
      />
    ) : (
      <Banner collapsible={false} status="info" title="Your triage answers are ready to apply">
        <AgentMessage text={APPLY_TRIAGE} />
      </Banner>
    );
  }
  return (
    <Banner
      collapsible={false}
      // A link drawn as a button: as tall as a control, for a finger.
      endContent={<Button href={here("/inbox/triage")} label="Answer it" />}
      status="info"
      title="An inbox triage waits for your answers"
    />
  );
}
