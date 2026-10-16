import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { VStack } from "@astryxdesign/core/VStack";
import { useState } from "react";
import { useFateClient } from "react-fate";
import type { InboxNote } from "uraeda-binding";
import { CommitBar } from "./CommitBar.tsx";
import { rereadChanges, useAgent, useInbox } from "./data.ts";
import { refusal } from "./errors.ts";
import { OrganizeButton, OrganizeMessage, TriageBanner, useStartChat } from "./InboxTriage.tsx";
import { Page } from "./layout/Page.tsx";
import { Paragraph } from "./layout/Paragraph.tsx";
import { WorkList, type WorkSection } from "./lists/WorkList.tsx";
import { useLocalPath, useRepoPath, useRestoreScroll } from "./routes.tsx";
import { plain, Spans } from "./Spans.tsx";
import { InboxView } from "./views.ts";

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
      {note.agent && note.about && " "}
      {note.about && <Badge label={note.about} variant="neutral" />}{" "}
    </>
  );
}

/** A note's marks as its row shows them, on its right: the same tags, side by side. */
function RowMarks({ note }: { note: InboxNote }) {
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

/** A section's id: "none" for the notes before the first category. */
function sectionId(name: string | undefined) {
  return name === undefined ? "none" : `category:${name}`;
}

/**
 * The inbox's categories with notes as sections of the shared list, "No category" first, each note
 * a row with its children; a drop moves the note to its place in `INBOX.md`. A refused move goes to
 * `onRefused`, and a conflict reads the inbox again.
 */
function InboxList({
  inbox,
  onRefused,
}: {
  inbox: NonNullable<ReturnType<typeof useInbox>>;
  onRefused: (message: string | undefined) => void;
}) {
  const fate = useFateClient();
  const here = useRepoPath();
  const pathname = useLocalPath();
  const categories = inbox.categories.filter((category) => category.notes.length > 0);
  const sections = categories.map((category): WorkSection => ({
    id: sectionId(category.name),
    rows: category.notes.map((note) => ({
      href: here(`/inbox/${note.key}`),
      key: note.key,
      // The row is one link: a link of its text, like a note's draft, would nest in it.
      label: <Spans spans={note.spans.map(({ link: _, ...span }) => span)} />,
      lines: note.nestedSpans.map(plain),
      marks: <RowMarks note={note} />,
      text: plain(note.spans),
    })),
    title: category.name ?? "No category",
    tone: "neutral",
  }));
  const selected = categories
    .flatMap((category) => category.notes)
    .find((note) => pathname === `/inbox/${note.key}`)?.key;

  const onMove = async (key: string, section: string, index: number) => {
    const note = categories.flatMap((c) => c.notes).find((one) => one.key === key);
    const target = categories.find((category) => sectionId(category.name) === section);
    if (!note || !target) {
      return;
    }
    onRefused(undefined);
    // Over the version the drag started from: an inbox changed meanwhile refuses the move.
    const result = await fate.mutations.inbox.place({
      input: {
        hash: inbox.hash,
        index: Math.min(index, target.notes.length),
        note: note.id,
        ...(target.name === undefined ? {} : { category: target.name }),
      },
      view: InboxView,
    });
    if (result.error) {
      const failed = refusal(result.error);
      onRefused(failed.message);
      if (failed.kind === "conflict") {
        rereadChanges(fate);
      }
    }
  };

  return <WorkList onMove={onMove} sections={sections} selected={selected} />;
}

/**
 * The inbox: `INBOX.md`'s notes under their categories, the notes without one first, then in the
 * file's order; a category with no note is hidden. Each note opens its view, and drags to its
 * place; the commit bar commits the inbox's changes with the priorities'. The heading carries the
 * count, and "Organize with an agent", on its right, asks for a triage, one at a time, which its
 * banner leads to.
 */
export function InboxPage() {
  const inbox = useInbox();
  const agent = useAgent()?.available === true;
  const chat = useStartChat();
  const [message, setMessage] = useState<string>();
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(true);
  if (!inbox) {
    return null;
  }
  return (
    <Page>
      <VStack gap={2}>
        <HStack align="center" gap={3} justify="between" wrap="wrap">
          <HStack align="center" gap={2}>
            <Heading level={1}>Inbox</Heading>
            {inbox.count > 0 && <Badge label={String(inbox.count)} variant="neutral" />}
          </HStack>
          {agent && <OrganizeButton chat={chat} triage={inbox.triage} />}
        </HStack>
        {!agent && inbox.triage === null && <OrganizeMessage />}
        {inbox.triage !== null && <TriageBanner agent={agent} chat={chat} status={inbox.triage} />}
        {chat.error && <Banner collapsible={false} status="error" title={chat.error} />}
        {message && <Banner collapsible={false} status="error" title={message} />}
        {inbox.count === 0 && (
          <Paragraph color="secondary">
            The inbox is empty. Notes you add with ＋ next to Inbox land here.
          </Paragraph>
        )}
        <InboxList inbox={inbox} onRefused={setMessage} />
        <CommitBar changes={inbox.changes} />
      </VStack>
    </Page>
  );
}
