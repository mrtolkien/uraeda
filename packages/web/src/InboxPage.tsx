import { Badge } from "@astryxdesign/core/Badge";
import { AnnouncedBanner } from "./layout/AnnouncedBanner.tsx";
import { Icon } from "@astryxdesign/core/Icon";
import { Thumbnail } from "@astryxdesign/core/Thumbnail";
import { VStack } from "@astryxdesign/core/VStack";
import { useState } from "react";
import { useFateClient } from "react-fate";
import type { InboxNote } from "uraeda-binding";
import { rereadChanges, useAgent, useDraftTitles, useInbox, useWorkspace } from "./data.ts";
import { EditableLine } from "./EditableLine.tsx";
import { refusal } from "./errors.ts";
import { OrganizeButton, OrganizeMessage, TriageBanner } from "./InboxTriage.tsx";
import { useStartChat } from "./StartChat.tsx";
import { Page } from "./layout/Page.tsx";
import { useKeys } from "./keys/registry.tsx";
import { NoteMenu } from "./lists/CardMenu.tsx";
import { useOpenAddForm } from "./SidebarAdd.tsx";
import { CategoryMenu, CategoryTitle } from "./lists/CategoryPane.tsx";
import { useCategoryActions } from "./lists/useCategoryActions.ts";
import { draftFile } from "./pane/NoteParts.tsx";
import { useOutline } from "./lists/useOutline.tsx";
import { WorkList, type WorkRow, type WorkSection } from "./lists/WorkList.tsx";
import { NOTE, openDetail } from "./pane/DetailOverlay.tsx";
import { repoPath, useLocalPath, useRepoPath, useRepository, useRestoreScroll } from "./routes.tsx";
import { imagePath, plain, Spans } from "./Spans.tsx";
import { InboxView } from "./views.ts";
import { plural } from "./labels.ts";
import { Empty } from "./layout/Empty.tsx";
import { PageTitle } from "./layout/PageTitle.tsx";

/** "1 note", "10 notes". */
export function notes(count: number) {
  return plural(count, "note");
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
  /** Writes a change: a refusal is its message, and a conflict reads the inbox again. */
  const run = async (call: () => Promise<{ error?: unknown }>) => {
    const result = await call();
    if (!result.error) {
      return undefined;
    }
    const failed = refusal(result.error);
    if (failed.kind === "conflict") {
      rereadChanges(fate);
    }
    return failed.message;
  };
  const categoryOf = (section: string) =>
    categories.find((category) => sectionId(category.name) === section)?.name;
  const outline = useOutline(
    inbox,
    {
      add: (now, section, text) => {
        const category = categoryOf(section);
        return run(() =>
          fate.mutations.inbox.add({
            input: { hash: now.hash, text, ...(category === undefined ? {} : { category }) },
            view: InboxView,
          }),
        );
      },
      drop: (now, from, to) => {
        const category = "under" in to ? undefined : categoryOf(to.section);
        return run(() =>
          fate.mutations.inbox.drop({
            input: {
              ...(from.at === undefined ? {} : { at: from.at }),
              hash: now.hash,
              index: to.index,
              note: from.id,
              ...("under" in to
                ? {
                    under: to.under.id,
                    ...(to.under.at === undefined ? {} : { underAt: to.under.at }),
                  }
                : category === undefined
                  ? {}
                  : { category }),
            },
            view: InboxView,
          }),
        );
      },
      edit: (now, id, at, kind, text) =>
        run(() =>
          fate.mutations.inbox.outline({
            input: {
              ...(at === undefined ? {} : { at }),
              hash: now.hash,
              kind,
              note: id,
              ...(text === undefined ? {} : { text }),
            },
            view: InboxView,
          }),
        ),
      read: (now) => ({
        hash: now.hash,
        sections: panesOf(now).map((category) => ({
          id: sectionId(category.name),
          items: category.notes.map((note) => ({
            children: note.children,
            id: note.id,
            key: note.key,
            source: note,
            spans: note.spans,
            // A note that is a draft stays a note: nested, it would be no note to open.
            staysItem: note.draft !== undefined,
            text: note.text,
          })),
        })),
      }),
    },
    onRefused,
    { edit: "Edit the note", fresh: "New note" },
  );
  const sections = outline.drawn.sections.map((section): WorkSection => {
    const name = categoryOf(section.id);
    return {
      id: section.id,
      ...(name === undefined
        ? {}
        : {
            menu: (
              <CategoryMenu
                count={section.items.length}
                name={name}
                onRefused={onRefused}
                onRemove={actions.remove}
              />
            ),
            titleNode: <CategoryTitle name={name} onRename={actions.rename} />,
          }),
      rows: section.items.map((item, index): WorkRow => {
        const note = item.source;
        const href = here(`/inbox/${item.key}`);
        const { isWritten, ...drawn } = outline.rowOf(item, { index, section: section.id }, href);
        return {
          ...drawn,
          // A note that is a draft opens its view, as a line with a draft opens its draft.
          editsInPlace: isWritten && note?.draft === undefined,
          href,
          // The row is one link: a link of its text, like a note's draft, would nest in it.
          ...(note
            ? {
                image: <Image note={note} />,
                label: <Spans spans={note.spans.map(({ link: _, ...span }) => span)} />,
                marks: marksOf(note),
                menu: (
                  <NoteMenu
                    drafts={drafts}
                    inbox={inbox}
                    onOpen={() => setWantsDrafts(true)}
                    onOpenNote={() => openDetail(href, NOTE)}
                    onRefused={onRefused}
                    placed={{ category: name, index, note }}
                  />
                ),
              }
            : {}),
          text: plain(item.spans),
        };
      }),
      title: name ?? "No category",
      tone: "neutral",
    };
  });
  const selected = categories
    .flatMap((category) => category.notes)
    .find((note) => pathname === `/inbox/${note.key}`)?.key;

  /** A note dropped, or moved by a key, in its category at an index, in turn with the others. */
  const onMove = (key: string, section: string, index: number) =>
    outline.write((now) => {
      const panes = panesOf(now);
      const note = panes.flatMap((pane) => pane.notes).find((one) => one.key === key);
      const target = panes.find((pane) => sectionId(pane.name) === section);
      if (!note || !target) {
        return Promise.resolve("The note or its category is no longer in INBOX.md.");
      }
      return run(() =>
        fate.mutations.inbox.place({
          input: {
            hash: now.hash,
            index: Math.min(index, target.notes.length),
            note: note.id,
            ...(target.name === undefined ? {} : { category: target.name }),
          },
          view: InboxView,
        }),
      );
    });

  return (
    <WorkList
      follow={outline.follow}
      onAddBeside={(_section, row, isAbove) => outline.onAddBeside(row, isAbove)}
      onDelete={outline.onDelete}
      onMove={onMove}
      onNest={outline.onNest}
      onOpen={(href) => openDetail(href, NOTE)}
      onOutline={outline.onOutline}
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
  const openForm = useOpenAddForm();
  // The ＋ next to Inbox, from the keyboard: the form in its default place. Not named in the status
  // line.
  useKeys([{ icon: "plus", keys: "a", label: "add", run: () => openForm("note") }]);
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(true);
  if (!inbox) {
    return null;
  }
  return (
    <Page>
      <VStack gap={2}>
        <PageTitle
          aside={agent && <OrganizeButton chat={chat} triage={inbox.triage} />}
          count={inbox.count > 0 ? inbox.count : undefined}
        >
          Inbox
        </PageTitle>
        {!agent && inbox.triage === null && <OrganizeMessage />}
        {inbox.triage !== null && <TriageBanner agent={agent} chat={chat} status={inbox.triage} />}
        {chat.error && <AnnouncedBanner collapsible={false} status="error" title={chat.error} />}
        {message && <AnnouncedBanner collapsible={false} status="error" title={message} />}
        {inbox.count === 0 && (
          <Empty>The inbox is empty. Notes you add with ＋ next to Inbox land here.</Empty>
        )}
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
      </VStack>
    </Page>
  );
}
