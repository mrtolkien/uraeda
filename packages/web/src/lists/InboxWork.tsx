// The inbox drawn with the priorities' list: its categories as sections, "No category" first, each
// note with the same handle, its children as grey lines, and its marks on the right.
import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import type { InboxNote } from "uraeda-binding";
import { CommitBar } from "../CommitBar.tsx";
import { useAgent, useInbox } from "../data.ts";
import { notes } from "../InboxPage.tsx";
import { OrganizeButton, OrganizeMessage, TriageBanner, useStartChat } from "../InboxTriage.tsx";
import { Page } from "../layout/Page.tsx";
import { Paragraph } from "../layout/Paragraph.tsx";
import { useLocalPath, useRepoPath } from "../routes.tsx";
import { plain, Spans } from "../Spans.tsx";
import { WorkList, type WorkRow, type WorkSection } from "./WorkList.tsx";

/** A note's marks: `agent` in a colour of its own, then the slug of what it is about. */
function Marks({ note }: { note: InboxNote }) {
  if (!note.agent && !note.about) {
    return null;
  }
  return (
    <HStack align="center" gap={1} wrap="wrap">
      {note.agent && <Badge label="agent" variant="purple" />}
      {note.about && <Badge label={note.about} variant="neutral" />}
    </HStack>
  );
}

/**
 * A note's children, each without its marker. TEMPORARY: read from the note's lines as written,
 * after its first; the core will send them, as it sends an entry's.
 */
function children(note: InboxNote): Array<string> {
  return note.lines
    .slice(1)
    .map((line) => line.trim().replace(/^[-*+]\s+/, ""))
    .filter((line) => line !== "");
}

/** A note as a row of the list. */
function row(note: InboxNote, href: string): WorkRow {
  return {
    href,
    key: note.key,
    // The row is one link: a link of its text, like a note's draft, would nest in it.
    label: <Spans spans={note.spans.map(({ link: _, ...span }) => span)} />,
    lines: children(note),
    marks: <Marks note={note} />,
    text: plain(note.spans),
  };
}

/**
 * The inbox's list: each category with notes, "No category" first, then in the file's order; the
 * note open beside the list is selected. "Organize with an agent" asks for a triage, as today.
 */
export function InboxWork() {
  const inbox = useInbox();
  const agent = useAgent()?.available === true;
  const chat = useStartChat();
  const here = useRepoPath();
  const pathname = useLocalPath();
  if (!inbox) {
    return null;
  }
  const sections = inbox.categories
    .filter((category) => category.notes.length > 0)
    .map((category): WorkSection => ({
      id: category.name === undefined ? "none" : `category:${category.name}`,
      rows: category.notes.map((note) => row(note, here(`/inbox/${note.key}`))),
      title: category.name ?? "No category",
      tone: "neutral",
    }));
  const selected = sections
    .flatMap((section) => section.rows)
    .find((r) => pathname === `/inbox/${r.key}`)?.key;
  return (
    <Page>
      <VStack gap={2}>
        <HStack align="center" gap={3} wrap="wrap">
          <Heading level={1}>Inbox</Heading>
          {inbox.count > 0 && <Text color="secondary">{notes(inbox.count)}</Text>}
          {agent && <OrganizeButton chat={chat} triage={inbox.triage} />}
        </HStack>
        {!agent && inbox.triage === null && <OrganizeMessage />}
        {inbox.triage !== null && <TriageBanner agent={agent} chat={chat} status={inbox.triage} />}
        {chat.error && <Banner collapsible={false} status="error" title={chat.error} />}
        {inbox.count === 0 && (
          <Paragraph color="secondary">
            The inbox is empty. Notes you add with ＋ next to Inbox land here.
          </Paragraph>
        )}
        <WorkList sections={sections} selected={selected} />
        <CommitBar changes={inbox.changes} />
      </VStack>
    </Page>
  );
}
