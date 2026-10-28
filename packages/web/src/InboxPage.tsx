import { Badge } from "@astryxdesign/core/Badge";
import { AnnouncedBanner } from "./layout/AnnouncedBanner.tsx";
import { Icon } from "@astryxdesign/core/Icon";
import { Thumbnail } from "@astryxdesign/core/Thumbnail";
import { VStack } from "@astryxdesign/core/VStack";
import { useEffect, useState } from "react";
import { useFateClient } from "react-fate";
import type { InboxNote } from "uraeda-binding";
import { rereadChanges, useAgent, useDraftTexts, useInbox, useWorkspace } from "./data.ts";
import { EditableLine } from "./EditableLine.tsx";
import { refusal } from "./errors.ts";
import { OrganizeButton, OrganizeMessage, TriageBanner } from "./InboxTriage.tsx";
import { useStartChat } from "./StartChat.tsx";
import { Page } from "./layout/Page.tsx";
import { KeyPicker } from "./keys/KeyPicker.tsx";
import type { PickerItem } from "./keys/pickerSources.ts";
import { useKeys } from "./keys/registry.tsx";
import { PromotePicker } from "./PromotePicker.tsx";
import type { Placed } from "./useNoteActions.ts";
import { useOpenAddForm } from "./SidebarAdd.tsx";
import { CategoryMenu, CategoryTitle, useCategoryDelete } from "./lists/CategoryPane.tsx";
import { useCategoryActions } from "./lists/useCategoryActions.ts";
import { draftFile } from "./draftFile.ts";
import { useOutline } from "./lists/useOutline.tsx";
import { WorkList, type WorkRow, type WorkSection } from "./lists/WorkList.tsx";
import { navigate, repoPath, useRepoPath, useRepository, useRestoreScroll } from "./routes.tsx";
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
  onNewCategory,
  onRefused,
  select,
}: {
  actions: ReturnType<typeof useCategoryActions>;
  inbox: NonNullable<ReturnType<typeof useInbox>>;
  /** What `C` does: it opens the New category line. */
  onNewCategory: () => void;
  onRefused: (message: string | undefined) => void;
  /** A note to select, with the focus, as its address named it: each new object selects it. */
  select?: { key: string } | undefined;
}) {
  const fate = useFateClient();
  const here = useRepoPath();
  // The drafts' titles are read once `p` is pressed, for "Add to <draft>".
  const [wantsDrafts, setWantsDrafts] = useState(false);
  // `p`'s picker, for the note it was opened on: drawn from its first opening.
  const [promoting, setPromoting] = useState<Placed>();
  const [isPromoting, setIsPromoting] = useState(false);
  // `R`'s rename, opened in a category's title: each pick counts up, which opens it again.
  const [renaming, setRenaming] = useState<{ count: number; name: string }>();
  // `D` and `R`'s picker of the categories, and what a pick does.
  const [choosing, setChoosing] = useState<"delete" | "rename">("delete");
  const [isChoosing, setIsChoosing] = useState(false);
  // Drawn from its first opening on: the page's focus is its own until then.
  const [isChoiceDrawn, setChoiceDrawn] = useState(false);
  const deleting = useCategoryDelete(actions.remove, onRefused);
  const paths = (useWorkspace()?.drafts ?? []).map(draftFile);
  const drafts = useDraftTexts(wantsDrafts ? paths : []);
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
  // Each note's place, by its row's key: what `p` acts on.
  const placedOf = new Map<string, Placed>();
  // Each Add row's section, by its address: what Enter or a click on it opens a new row in.
  const addsTo = new Map<string, string>();
  const sections = outline.drawn.sections.map((section): WorkSection => {
    const name = categoryOf(section.id);
    const title = name ?? "No category";
    const addHref = here(`/inbox#add-${encodeURIComponent(section.id)}`);
    addsTo.set(addHref, section.id);
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
            titleNode: (
              <CategoryTitle
                name={name}
                onRename={actions.rename}
                opens={renaming?.name === name ? renaming.count : 0}
              />
            ),
          }),
      rows: [
        ...section.items.map((item, index): WorkRow => {
          const note = item.source;
          const href = here(`/inbox/${item.key}`);
          const { isWritten, ...drawn } = outline.rowOf(item, { index, section: section.id }, href);
          if (note) {
            placedOf.set(item.key, { category: name, index, note });
          }
          return {
            ...drawn,
            // A note that is a draft opens its draft's page, as a line with a draft does.
            editsInPlace: isWritten && note?.draft === undefined,
            href,
            // The row is one link: a link of its text, like a note's draft, would nest in it.
            ...(note
              ? {
                  image: <Image note={note} />,
                  label: <Spans spans={note.spans.map(({ link: _, ...span }) => span)} />,
                  marks: marksOf(note),
                }
              : {}),
            text: plain(item.spans),
          };
        }),
        // The category's last row adds a note: the keyboard's cursor stops on it, and Enter opens a
        // new row at the category's end, as a section of the priorities does. The notes without a
        // category are the inbox's own: theirs only says "Add".
        {
          href: addHref,
          icon: "uraeda:plus" as const,
          isAdd: true,
          isFixed: true,
          key: `add:${section.id}`,
          lines: [],
          spot: { index: section.items.length, section: section.id },
          text: name === undefined ? "Add" : `Add to ${title}`,
        },
      ],
      title,
      tone: "neutral",
    };
  });
  // The row selected again where it went: as a write placed it, or as an address named it.
  const [follow, setFollow] = useState<{ key: string }>();
  useEffect(() => setFollow((before) => outline.follow ?? before), [outline.follow]);
  useEffect(() => setFollow((before) => select ?? before), [select]);
  /**
   * Enter or a click on a row not edited in place: an Add row opens a new row at its category's
   * end, and a note that is a draft its draft's page.
   */
  const open = (href: string) => {
    const adding = addsTo.get(href);
    if (adding !== undefined) {
      outline.openAt(adding);
      return;
    }
    const draft = [...placedOf.values()].find(({ note }) => here(`/inbox/${note.key}`) === href)
      ?.note.draft;
    if (draft !== undefined) {
      navigate(here(`/edit/${draftFile(draft)}`));
    }
  };
  // `c`'s picker of the categories, for the note it was opened on: drawn from its first opening.
  const [picking, setPicking] = useState<{ from: string; moveTo: (section: string) => void }>();
  const [isPicking, setIsPicking] = useState(false);
  /** A category as its pickers list it, by its pane's id, its notes as its preview. */
  const itemOf = (category: (typeof categories)[number]): PickerItem => {
    const title = category.name ?? "No category";
    return {
      icon: "uraeda:layers",
      id: sectionId(category.name),
      kind: "notes",
      path: "",
      preview: [`## ${title}`, "", ...category.notes.map((note) => `- ${note.text}`)].join("\n"),
      title,
    };
  };
  const choices = categories
    .filter((category) => sectionId(category.name) !== picking?.from)
    .map(itemOf);
  // `D` and `R` act on a category, an empty one too: picked from all of them, by name.
  const named = categories.filter((category) => category.name !== undefined);
  const choose = (kind: "delete" | "rename") => {
    setChoosing(kind);
    setIsChoosing(true);
    setChoiceDrawn(true);
  };
  useKeys([
    // `C` opens the New category line, as a click on it does: first, as it adds one.
    { hint: "C", keys: "C", label: "new category", run: onNewCategory },
    {
      hint: "D",
      hintLabel: "delete category",
      keys: "D",
      label: "delete a category",
      run: () => choose("delete"),
    },
    {
      hint: "R",
      hintLabel: "rename category",
      keys: "R",
      label: "rename a category",
      run: () => choose("rename"),
    },
  ]);
  const chosen = (item: PickerItem) => {
    const category = named.find((one) => sectionId(one.name) === item.id);
    const name = category?.name;
    if (name === undefined) {
      return;
    }
    if (choosing === "delete") {
      deleting.start(name, category?.notes.length ?? 0);
    } else {
      setRenaming((before) => ({ count: (before?.count ?? 0) + 1, name }));
    }
  };

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
    <>
      <WorkList
        follow={follow}
        onAddBeside={(_section, row, isAbove) => outline.onAddBeside(row, isAbove)}
        onDelete={outline.onDelete}
        onMove={onMove}
        onNest={outline.onNest}
        onOpen={open}
        onOutline={outline.onOutline}
        rowActions={[
          {
            icon: "uraeda:flag",
            isFor: (row) => row.parent === undefined,
            keys: "p",
            label: "promote",
            run: (row) => {
              const placed = placedOf.get(row.key);
              if (placed) {
                setWantsDrafts(true);
                setPromoting(placed);
                setIsPromoting(true);
              }
            },
          },
        ]}
        sectionPicker={{
          icon: "uraeda:layers",
          keys: "c",
          label: "category",
          open: (row, moveTo) => {
            const from = sections.find((section) =>
              section.rows.some((one) => one.key === row.key),
            );
            setPicking({ from: from?.id ?? "", moveTo });
            setIsPicking(true);
          },
        }}
        sections={sections}
      />
      {picking && (
        <KeyPicker
          isOpen={isPicking}
          items={choices}
          onClose={() => setIsPicking(false)}
          onPick={(item) => {
            setIsPicking(false);
            picking.moveTo(item.id);
          }}
          placeholder="Move to a category…"
          title="Move to a category"
        />
      )}
      {promoting && (
        <PromotePicker
          drafts={drafts}
          hash={inbox.hash}
          isOpen={isPromoting}
          key={promoting.note.id}
          onClose={() => setIsPromoting(false)}
          onRefused={onRefused}
          placed={promoting}
        />
      )}
      {isChoiceDrawn && (
        <KeyPicker
          isOpen={isChoosing}
          items={named.map(itemOf)}
          onClose={() => setIsChoosing(false)}
          onPick={(item) => {
            setIsChoosing(false);
            chosen(item);
          }}
          placeholder={choosing === "rename" ? "Rename a category…" : "Delete a category…"}
          title={choosing === "rename" ? "Rename a category" : "Delete a category"}
        />
      )}
      {deleting.dialog}
    </>
  );
}

/**
 * The inbox: `INBOX.md`'s notes in a pane per category, the notes without one first, then in the
 * file's order, an empty category as an empty pane, under a line that says what the inbox is for.
 * "New category" adds a pane. Each note is edited in place, or opens its draft, and drags to its
 * place; the commit bar commits the inbox's changes with the priorities'. The heading carries the
 * count, and "Organize with an agent", on its right, asks for a triage, one at a time, which its
 * banner leads to. `select` selects a note, as its address names it.
 */
export function InboxPage({ select }: { select?: { key: string } | undefined } = {}) {
  const inbox = useInbox();
  const agent = useAgent()?.available === true;
  const chat = useStartChat();
  const [message, setMessage] = useState<string>();
  const actions = useCategoryActions(inbox?.hash ?? "");
  const openForm = useOpenAddForm();
  // The ＋ next to Inbox, from the keyboard: the form in its default place. Not named in the status
  // line.
  useKeys([{ icon: "plus", keys: "a", label: "add", run: () => openForm("note") }]);
  // `C`, which the list declares with its other category keys, opens the New category line.
  const [newCategory, setNewCategory] = useState(0);
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
          opens={newCategory}
          value=""
        />
        <InboxList
          actions={actions}
          inbox={inbox}
          onNewCategory={() => setNewCategory((count) => count + 1)}
          onRefused={setMessage}
          select={select}
        />
      </VStack>
    </Page>
  );
}
