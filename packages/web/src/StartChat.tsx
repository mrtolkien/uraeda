// What the inbox page and the decisions page share to ask an agent for a round on the default
// branch: a chat started in the main checkout, and the message to give an agent elsewhere.
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { VStack } from "@astryxdesign/core/VStack";
import { typeScaleVars, typographyVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { useFateClient } from "react-fate";
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

/** A chat started from a page: `start` sends a message, `error` is the server's refusal. */
export type StartChat = ReturnType<typeof useStartChat>;

/**
 * Starts a chat in the main checkout with a message, then opens it; `error` is the server's
 * refusal.
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

/**
 * The banner of a round on the default branch: one waiting for the human links to its answering
 * view, `href`, and an answered one offers to apply it, in a chat while the agent works on this
 * machine, else with the message to give one, `apply`.
 */
export function RoundBanner({
  agent,
  apply,
  chat,
  href,
  status,
  titles,
}: {
  agent: boolean;
  apply: string;
  chat: StartChat;
  href: string;
  status: string;
  titles: { answered: string; waiting: string };
}) {
  const here = useRepoPath();
  if (status === "answered") {
    return agent ? (
      <Banner
        collapsible={false}
        endContent={<Button clickAction={() => chat.start(apply)} label="Apply the answers" />}
        status="info"
        title={titles.answered}
      />
    ) : (
      <Banner collapsible={false} status="info" title={titles.answered}>
        <AgentMessage text={apply} />
      </Banner>
    );
  }
  return (
    <Banner
      collapsible={false}
      // A link drawn as a button: as tall as a control, for a finger.
      endContent={<Button href={here(href)} label="Answer it" />}
      status="info"
      title={titles.waiting}
    />
  );
}

/** A message to give an agent in this repository, with a button that copies it. */
export function AgentMessage({ text }: { text: string }) {
  return (
    <VStack align="start" gap={2}>
      <Paragraph>Give this message to an agent in this repository:</Paragraph>
      <pre {...stylex.props(styles.message)}>{text}</pre>
      <Button label="Copy the message" onClick={() => void navigator.clipboard?.writeText(text)} />
    </VStack>
  );
}
