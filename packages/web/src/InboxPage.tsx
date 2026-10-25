import { Badge } from "@astryxdesign/core/Badge";
import { AnnouncedBanner } from "./layout/AnnouncedBanner.tsx";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Thumbnail } from "@astryxdesign/core/Thumbnail";
import { VStack } from "@astryxdesign/core/VStack";
import { useState } from "react";
import { useFateClient } from "react-fate";
import type { InboxNote } from "uraeda-binding";
import { CommitBar } from "./CommitBar.tsx";
import { rereadChanges, useAgent, useDraftTitles, useInbox, useWorkspace } from "./data.ts";
import { EditableLine } from "./EditableLine.tsx";
import { refusal } from "./errors.ts";
import { OrganizeButton, OrganizeMessage, TriageBanner } from "./InboxTriage.tsx";
import { useStartChat } from "./StartChat.tsx";
import { Page } from "./layout/Page.tsx";
import { Paragraph } from "./layout/Paragraph.tsx";
import { NoteMenu } from "./lists/CardMenu.tsx";
import { CategoryMenu, CategoryTitle } from "./lists/CategoryPane.tsx";
import { useCategoryActions } from "./lists/useCategoryActions.ts";
import { draftFile } from "./pane/NoteParts.tsx";
import { WorkList, type WorkSection } from "./lists/WorkList.tsx";
import { NOTE, openDetail } from "./pane/DetailOverlay.tsx";
import { repoPath, useLocalPath, useRepoPath, useRepository, useRestoreScroll } from "./routes.tsx";
import { imagePath, plain, Spans } from "./Spans.tsx";
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

/** A note's tags as text in its card's border: `agent`, then its feature's, each apart. */
function marksOf(note: InboxNote) {
  if (!note.agent && !note.about) {
    return undefined;
  }
  return (
    <>
      {note.agent && <span>agent</span>}
      {note.agent && note.about && " "}
      {note.about && <span>{note.about}</span>}
    </>
  );
}

/** A note's first image, under its text: decorative, as the text says what the note is. */
function Image({ note }: { note: InboxNote }) {
  const repo = useRepository();
  const first = imagePath(note.images[0]);
  return first ? <Thumbnail alt="" src={repoPath(repo, first)} /> : null;
}

/** A section's id: "none" for the notes before the first category. */
function sectionId(name: string | undefined) {
  return name === undefined ? "none" : `category:${name}`;
}

/** The notes of each pane: "No category" when it holds notes, then every category, file order. */
function panesOf(inbox: NonNullable<ReturnType<typeof useInbox>>) {
  const notesOf = new Map(inbox.categories.map((category) => [category.name, category.notes]));
  const none = notesOf.get(undefined);
  return [
    ...(none && none.length > 0 ? [{ name: undefined, notes: none }] : []),
    ...inbox.names.map((name) => ({
      name: name as string | undefined,
      notes: notesOf.get(name) ?? [],
    })),
  ];
}

/**
 * The inbox's categories as sections of the shared list, "No category" first when it holds notes,
 * then each category in the file's order, the empty ones too, each note a row with its children; a
 * drop moves the note to its place in `INBOX.md`. A category's title renames it in place, and its
 * menu deletes it. A refused move or delete goes to `onRefused`, and a conflict reads the inbox
 * again.
 */
function InboxList({
  actions,
  inbox,
  onRefused,
}: {
  actions: ReturnType<typeof useCategoryActions>;
  inbox: NonNullable<ReturnType<typeof useInbox>>;
  onRefused: (message: string | undefined) => void;
}) {
  const fate = useFateClient();
  const here = useRepoPath();
  const pathname = useLocalPath();
  // The drafts' titles are read once a menu is opened, for "Add to a draft".
  const [wantsDrafts, setWantsDrafts] = useState(false);
  const paths = (useWorkspace()?.drafts ?? []).map(draftFile);
  const drafts = useDraftTitles(wantsDrafts ? paths : []);
  const categories = panesOf(inbox);
  const sections = categories.map((category): WorkSection => ({
    id: sectionId(category.name),
    ...(category.name === undefined
      ? {}
      : {
          menu: (
            <CategoryMenu
              count={category.notes.length}
              name={category.name}
              onRefused={onRefused}
              onRemove={actions.remove}
            />
          ),
          titleNode: <CategoryTitle name={category.name} onRename={actions.rename} />,
        }),
    rows: category.notes.map((note, index) => ({
      href: here(`/inbox/${note.key}`),
      key: note.key,
      // The row is one link: a link of its text, like a note's draft, would nest in it.
      image: <Image note={note} />,
      label: <Spans spans={note.spans.map(({ link: _, ...span }) => span)} />,
      lines: note.nestedSpans.map(plain),
      marks: marksOf(note),
      menu: (
        <NoteMenu
          drafts={drafts}
          inbox={inbox}
          onOpen={() => setWantsDrafts(true)}
          onRefused={onRefused}
          placed={{ category: category.name, index, note }}
        />
      ),
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

  return (
    <WorkList
      onMove={onMove}
      onOpen={(href) => openDetail(href, NOTE)}
      sections={sections}
      selected={selected}
    />
  );
}

/**
 * The inbox: `INBOX.md`'s notes in a pane per category, the notes without one first, then in the
 * file's order, an empty category as an empty pane, under a line that says what the inbox is for.
 * "New category" adds a pane. Each note opens its view, and drags to its place; the commit bar
 * commits the inbox's changes with the priorities'. The heading carries the count, and "Organize
 * with an agent", on its right, asks for a triage, one at a time, which its banner leads to.
 */
export function InboxPage() {
  const inbox = useInbox();
  const agent = useAgent()?.available === true;
  const chat = useStartChat();
  const [message, setMessage] = useState<string>();
  const actions = useCategoryActions(inbox?.hash ?? "");
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
        {chat.error && <AnnouncedBanner collapsible={false} status="error" title={chat.error} />}
        {message && <AnnouncedBanner collapsible={false} status="error" title={message} />}
        {inbox.count === 0 && (
          <Paragraph color="secondary">
            The inbox is empty. Notes you add with ＋ next to Inbox land here.
          </Paragraph>
        )}
        <Paragraph color="secondary">
          Things noticed, not decided: turn each into a priority, a draft, or nothing.
        </Paragraph>
        <EditableLine
          display={
            <>
              <Icon icon="uraeda:plus" size="sm" /> New category
            </>
          }
          empty="A category needs a name."
          field="inbox#new-category"
          label="New category"
          onSave={actions.add}
          value=""
        />
        <InboxList actions={actions} inbox={inbox} onRefused={setMessage} />
        <CommitBar changes={inbox.changes} />
      </VStack>
    </Page>
  );
}
