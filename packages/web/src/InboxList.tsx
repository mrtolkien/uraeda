// The inbox's notes on the shared list, as an outliner (see `useOutline`): a section per category,
// each note a row with its children, and the keys and pickers that act on the notes and on the
// categories. `InboxPage` draws it under its heading.
import { useState } from "react";
import { useFateClient } from "react-fate";
import type { InboxNote } from "uraeda-binding";
import { rereadChanges } from "./data.ts";
import { draftFile } from "./draftFile.ts";
import { refusal } from "./errors.ts";
import { useInboxImages } from "./InboxImages.tsx";
import { type Inbox, panesOf, sectionId } from "./inboxPanes.ts";
import { type Actions, useCategoryKeys, useMovePicker, usePromote } from "./InboxPickers.tsx";
import { CategoryTitle, DeleteCategoryButton } from "./lists/CategoryPane.tsx";
import { useOutline } from "./lists/useOutline.tsx";
import { WorkList, type WorkRow, type WorkSection } from "./lists/WorkList.tsx";
import { plural } from "./labels.ts";
import { navigate, useRepoPath } from "./routes.tsx";
import { plain, Spans } from "./Spans.tsx";
import type { Placed } from "./useNoteActions.ts";
import { InboxView } from "./views.ts";

/** How the list writes a change: it resolves with its refusal, if any. */
type Run = (call: () => Promise<{ error?: unknown }>) => Promise<string | undefined>;

/**
 * A note's tags as text after it: `agent`, then its feature's, then its images' count, each apart.
 * The images show under the row while it is selected.
 */
function marksOf(note: InboxNote) {
  const marks = [
    ...(note.agent ? ["agent"] : []),
    ...(note.about ? [note.about] : []),
    ...(note.images.length > 0 ? [plural(note.images.length, "image")] : []),
  ];
  if (marks.length === 0) {
    return undefined;
  }
  return marks.map((mark, at) => (
    <span key={mark}>
      {at > 0 && " "}
      {mark}
    </span>
  ));
}

/** What a note's row gets from the inbox's images: its images under it, and its fields' paste. */
type RowImages = Pick<ReturnType<typeof useInboxImages>, "imagesOf" | "withPaste">;

/** A note's row whose field, and its nested rows' fields, give their pasted images to `note`. */
function withNotePaste(row: WorkRow, note: InboxNote, images: RowImages): WorkRow {
  const paste = images.withPaste(note);
  const field = (one: WorkRow): WorkRow => {
    const { editor } = one;
    return editor ? { ...one, editor: (hooks) => paste(editor(hooks)) } : one;
  };
  return { ...field(row), ...(row.children ? { children: row.children.map(field) } : {}) };
}

/**
 * A category's last row, which adds a note: the keyboard's cursor stops on it, and Enter opens a
 * new row at the category's end, as a section of the priorities does. The notes without a category
 * are the inbox's own: theirs only says "Add".
 */
function addRow(section: { id: string; items: ReadonlyArray<unknown> }, name?: string): WorkRow {
  return {
    href: "",
    icon: "uraeda:plus" as const,
    isAdd: true,
    isFixed: true,
    key: `add:${section.id}`,
    lines: [],
    spot: { index: section.items.length, section: section.id },
    text: name === undefined ? "Add" : `Add to ${name}`,
  };
}

/** Writes a change: a refusal is its message, and a conflict reads the inbox again. */
function useRun(): Run {
  const fate = useFateClient();
  return async (call) => {
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
}

/**
 * The inbox as an outliner (see `useOutline`), its writes through `run`, a refused one to
 * `onRefused`, and `onMove`: a note dropped, or moved by a key, in its category at an index, in
 * turn with the others. `categoryOf` is a section's category, by its id.
 */
function useInboxOutline(
  inbox: Inbox,
  run: Run,
  onRefused: (message: string | undefined) => void,
  categoryOf: (section: string) => string | undefined,
) {
  const fate = useFateClient();
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
  return { onMove, outline };
}

/** The inbox's outline, as `useOutline` gives it. */
type InboxOutline = ReturnType<typeof useInboxOutline>["outline"];

/**
 * The sections the list draws, from the `outline`: each category's notes, then its Add row. A
 * category's title renames it in place, `renaming` when its pick opens it, and its menu deletes it.
 * With them, each note's place, by its row's key, what `p` acts on, and each Add row's section, by
 * its address, what Enter or a click on it opens a new row in.
 */
function sectionsOf({
  actions,
  categoryOf,
  here,
  images,
  onRefused,
  outline,
  renaming,
}: {
  actions: Actions;
  categoryOf: (section: string) => string | undefined;
  here: (path: string) => string;
  images: RowImages;
  onRefused: (message: string | undefined) => void;
  outline: InboxOutline;
  renaming: { count: number; name: string } | undefined;
}) {
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
              <DeleteCategoryButton
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
          if (!note) {
            return { ...drawn, editsInPlace: isWritten, href, text: plain(item.spans) };
          }
          placedOf.set(item.key, { category: name, index, note });
          const row: WorkRow = {
            ...drawn,
            // A note that is a draft opens its draft's page, as a line with a draft does.
            editsInPlace: isWritten && note.draft === undefined,
            href,
            image: images.imagesOf(note),
            // The row is one link: a link of its text, like a note's draft, would nest in it.
            label: <Spans spans={note.spans.map(({ link: _, ...span }) => span)} />,
            marks: marksOf(note),
            text: plain(item.spans),
          };
          return withNotePaste(row, note, images);
        }),
        { ...addRow(section, name), href: addHref },
      ],
      title,
      tone: "neutral",
    };
  });
  return { addsTo, placedOf, sections };
}

/**
 * The row selected again where it went: as a write placed it, `placed`, or as an address named it,
 * `named`, whichever came last. It follows each new one as the list renders, where an effect would
 * render the list twice.
 */
function useFollow(placed: { key: string } | undefined, named: { key: string } | undefined) {
  const [follow, setFollow] = useState(named ?? placed);
  const [seen, setSeen] = useState({ named, placed });
  if (seen.placed !== placed || seen.named !== named) {
    setSeen({ named, placed });
    let next = follow;
    if (seen.placed !== placed) {
      next = placed ?? next;
    }
    if (seen.named !== named) {
      next = named ?? next;
    }
    setFollow(next);
  }
  return follow;
}

/**
 * The inbox's categories as sections of the shared list, "No category" first when it holds notes,
 * then each category in the file's order, the empty ones too, each note a row with its children; a
 * drop moves the note to its place in `INBOX.md`. A category's title renames it in place, and its
 * menu deletes it. A refused move or delete goes to `onRefused`, and a conflict reads the inbox
 * again.
 */
export function InboxList({
  actions,
  inbox,
  onNewCategory,
  onRefused,
  select,
}: {
  actions: Actions;
  inbox: Inbox;
  /** What `C` does: it opens the New category line. */
  onNewCategory: () => void;
  onRefused: (message: string | undefined) => void;
  /** A note to select, with the focus, as its address named it: each new object selects it. */
  select?: { key: string } | undefined;
}) {
  const here = useRepoPath();
  const promote = usePromote(inbox.hash, onRefused);
  const categories = panesOf(inbox);
  const run = useRun();
  const categoryOf = (section: string) =>
    categories.find((category) => sectionId(category.name) === section)?.name;
  const { onMove, outline } = useInboxOutline(inbox, run, onRefused, categoryOf);
  const images = useInboxImages({ categoryOf, inbox, onRefused, outline });
  const follow = useFollow(outline.follow, select);
  const moving = useMovePicker(categories);
  const choice = useCategoryKeys(categories, actions, onNewCategory, onRefused);
  const { addsTo, placedOf, sections } = sectionsOf({
    actions,
    categoryOf,
    here,
    images,
    onRefused,
    outline,
    renaming: choice.renaming,
  });
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

  return (
    <>
      {images.dropZone(
        <WorkList
          follow={follow}
          onAddBeside={(_section, row, isAbove) => outline.onAddBeside(row, isAbove)}
          onDelete={outline.onDelete}
          onMove={onMove}
          onNest={outline.onNest}
          onOpen={open}
          onOutline={outline.onOutline}
          onSelected={images.onSelected}
          rowActions={[
            {
              icon: "uraeda:flag",
              isFor: (row) => row.parent === undefined,
              keys: "p",
              label: "promote",
              run: (row) => {
                const placed = placedOf.get(row.key);
                if (placed) {
                  promote.start(placed);
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
              moving.open(from?.id ?? "", moveTo);
            },
          }}
          sections={sections}
        />,
      )}
      {moving.picker}
      {promote.picker}
      {choice.picker}
    </>
  );
}
