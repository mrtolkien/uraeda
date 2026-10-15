import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { useState } from "react";
import { useFateClient } from "react-fate";
import type { InboxNote } from "uraeda-binding";
import { APPLY_TRIAGE, ORGANIZE_INBOX } from "uraeda-server/triage-messages";
import { CommitBar } from "./CommitBar.tsx";
import { useAgent, useInbox } from "./data.ts";
import { Page } from "./layout/Page.tsx";
import { Paragraph } from "./layout/Paragraph.tsx";
import { navigate, useLocalPath, useRepoPath, useRestoreScroll } from "./routes.tsx";
import { sendMessage } from "./sessions.ts";
import { Spans } from "./Spans.tsx";

/** "1 note", "10 notes". */
export function notes(count: number) {
  return `${count} ${count === 1 ? "note" : "notes"}`;
}

/** A note's marks, as tags before its text: `agent` in a colour of its own, then its feature's. */
export function Marks({ note }: { note: InboxNote }) {
  if (!note.agent && !note.about) {
    return null;
  }
  return (
    <>
      {note.agent && <Badge label="agent" variant="purple" />}
      {note.about && <Badge label={note.about} variant="neutral" />}{" "}
    </>
  );
}

/** A note: its marks, then its text; tapped, it opens its view. */
function Note({ isSelected, note }: { isSelected: boolean; note: InboxNote }) {
  const here = useRepoPath();
  return (
    <ListItem
      href={here(`/inbox/${note.key}`)}
      isSelected={isSelected}
      // Nodes, not strings, so long notes wrap instead of being cut.
      label={
        <HStack align="center" gap={1} wrap="wrap">
          <Marks note={note} />
          <span>
            {/* The row is one link: a link of its text, like a note's draft, would nest in it. */}
            <Spans spans={note.spans.map(({ link: _, ...span }) => span)} />
          </span>
        </HStack>
      }
    />
  );
}

/**
 * Starts a chat in the main checkout with a message, then opens it; `error` is the server's refusal.
 */
function useStartChat() {
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
 * The triage's banner: a triage waiting for the human links to its answering view, and an answered
 * one offers to apply it, in a chat, while the agent works on this machine.
 */
function TriageBanner({
  agent,
  onApply,
  status,
}: {
  agent: boolean;
  onApply: () => Promise<void>;
  status: string;
}) {
  const here = useRepoPath();
  if (status === "answered") {
    return (
      <Banner
        collapsible={false}
        endContent={agent && <Button clickAction={onApply} label="Apply the answers" />}
        status="info"
        title="Your triage answers are ready to apply"
      />
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

/**
 * The inbox: `INBOX.md`'s notes under their categories, the notes without one first, then in the
 * file's order; a category with no note is hidden. Each note opens its view; the commit bar commits
 * the inbox's changes with the priorities'. "Organize with an agent" asks for a triage, one at a
 * time, which its banner leads to.
 */
export function InboxPage() {
  const inbox = useInbox();
  const agent = useAgent()?.available === true;
  const chat = useStartChat();
  // The note open beside the list, on wide screens.
  const pathname = useLocalPath();
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(true);
  if (!inbox) {
    return null;
  }
  return (
    <Page>
      <VStack gap={4}>
        <HStack align="baseline" gap={3} wrap="wrap">
          <Heading level={1}>Inbox</Heading>
          {inbox.count > 0 && <Text color="secondary">{notes(inbox.count)}</Text>}
          {agent && (
            <Button
              clickAction={() => chat.start(ORGANIZE_INBOX)}
              isDisabled={inbox.triage !== null}
              label="Organize with an agent"
            />
          )}
        </HStack>
        {inbox.triage !== null && (
          <TriageBanner
            agent={agent}
            onApply={() => chat.start(APPLY_TRIAGE)}
            status={inbox.triage}
          />
        )}
        {chat.error && <Banner collapsible={false} status="error" title={chat.error} />}
        {inbox.count === 0 && (
          <Paragraph color="secondary">
            The inbox is empty. Notes you add with ＋ next to Inbox land here.
          </Paragraph>
        )}
        {inbox.categories
          .filter((category) => category.notes.length > 0)
          .map((category) => {
            const name = category.name ?? "No category";
            return (
              <List
                aria-label={name}
                hasDividers
                header={<Heading level={2}>{name}</Heading>}
                key={category.name === undefined ? "none" : `category:${name}`}
              >
                {category.notes.map((note) => (
                  <Note isSelected={pathname === `/inbox/${note.key}`} key={note.id} note={note} />
                ))}
              </List>
            );
          })}
        <CommitBar changes={inbox.changes} />
      </VStack>
    </Page>
  );
}
