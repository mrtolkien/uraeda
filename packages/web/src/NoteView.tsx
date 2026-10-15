import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { Selector } from "@astryxdesign/core/Selector";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { type ReactNode, useState } from "react";
import type { Inbox } from "uraeda-server/fate";
import { useDraftTitles, useInbox, useWorkspace } from "./data.ts";
import { LineField } from "./EditableLine.tsx";
import { Marks } from "./InboxPage.tsx";
import { Page } from "./layout/Page.tsx";
import { useWidthClass } from "./layout/useWidthClass.ts";
import { TITLES } from "./QuickAdd.tsx";
import { useRepoPath, useRestoreScroll } from "./routes.tsx";
import { Spans } from "./Spans.tsx";
import { useLineSave } from "./useLineSave.ts";
import { categoryName, type Placed, useNoteActions } from "./useNoteActions.ts";

/** The Category menu's value for no category; a category's is its name, after `:`. */
const NONE = "none";

/** The note of a key, or of an id while its text, and so its key, changes, with its place. */
function placed(inbox: Pick<Inbox, "categories">, key: string, id?: string): Placed | undefined {
  const find = (match: (note: Placed["note"]) => boolean) => {
    for (const category of inbox.categories) {
      const index = category.notes.findIndex(match);
      if (index >= 0) {
        return { category: category.name, index, note: category.notes[index] };
      }
    }
    return undefined;
  };
  return find((note) => note.key === key) ?? (id ? find((note) => note.id === id) : undefined);
}

/** The path the editor and the moves take for a draft the workspace lists: a folder's proposal. */
function draftFile(path: string) {
  return path.endsWith(".md") ? path : `${path}/proposal.md`;
}

/** A menu of the priorities' sections, behind a button: Now, Next, Later, Blocked. */
function SectionMenu({ label, onPick }: { label: string; onPick: (section: string) => void }) {
  const wide = useWidthClass() === "wide";
  return (
    <DropdownMenu
      button={{ label }}
      items={[...TITLES].map(([section, title]) => ({
        label: title,
        onClick: () => onPick(section),
      }))}
      presentation={wide ? "popover" : "bottom-sheet"}
    />
  );
}

/** The drafts and backlog files, by title, filtered as typed in "Find a draft". */
function DraftPicker({
  except,
  onPick,
}: {
  except?: string;
  onPick: (path: string, title: string) => void;
}) {
  const wide = useWidthClass() === "wide";
  const paths = (useWorkspace()?.drafts ?? []).map(draftFile).filter((path) => path !== except);
  const drafts = useDraftTitles(paths);
  return (
    <Selector
      emptyText="No draft yet."
      hasSearch
      isLabelHidden
      isLoading={drafts === undefined}
      label="Add to a draft"
      onChange={(path: string) => {
        const title = drafts?.find((draft) => draft.path === path)?.title;
        if (title !== undefined) {
          onPick(path, title);
        }
      }}
      options={(drafts ?? []).map((draft) => ({ label: draft.title, value: draft.path }))}
      placeholder="Add to a draft"
      presentation={wide ? "popover" : "bottom-sheet"}
      searchPlaceholder="Find a draft"
    />
  );
}

/** The Category menu: the note's category, which moves the note to the one picked. */
function CategoryMenu({
  category,
  names,
  onPick,
}: {
  category: string | undefined;
  names: ReadonlyArray<string>;
  onPick: (category: string | undefined) => void;
}) {
  const wide = useWidthClass() === "wide";
  const value = category === undefined ? NONE : `:${category}`;
  return (
    <Selector
      label="Category"
      onChange={(next: string) => {
        if (next !== value) {
          onPick(next === NONE ? undefined : next.slice(1));
        }
      }}
      options={[
        { label: "No category", value: NONE },
        ...names.map((name) => ({ label: name, value: `:${name}` })),
      ]}
      presentation={wide ? "popover" : "bottom-sheet"}
      value={value}
    />
  );
}

/** The Organize actions, in a row on wide screens, one under the other on narrow ones. */
function Actions({ children }: { children: ReactNode }) {
  const wide = useWidthClass() === "wide";
  return wide ? (
    <HStack align="end" gap={2} wrap="wrap">
      {children}
    </HStack>
  ) : (
    <VStack gap={2}>{children}</VStack>
  );
}

/** A note found in the inbox: its text edited in place, its category, and what it becomes. */
function NoteBody({
  inbox,
  onRenaming,
  placed: found,
}: {
  inbox: Pick<Inbox, "hash" | "names">;
  onRenaming: (id: string | undefined) => void;
  placed: Placed;
}) {
  const { note } = found;
  const actions = useNoteActions(found, inbox.hash, onRenaming);
  const line = useLineSave({
    empty: "A note needs text.",
    field: `inbox#${note.key}`,
    onSave: actions.edit,
    stayOpen: false,
    value: note.text,
  });
  return (
    <Page>
      <VStack gap={4}>
        <Text color="secondary" type="supporting">
          Note, in {categoryName(found.category)}
        </Text>
        {line.open ? (
          <LineField label="Note" line={line} />
        ) : (
          <HStack align="center" gap={1} wrap="wrap">
            <Marks note={note} />
            <span>
              <Spans spans={note.spans} />
            </span>
          </HStack>
        )}
        <Actions>
          {!line.open && <Button label="Edit" onClick={line.openLine} />}
          <CategoryMenu category={found.category} names={inbox.names} onPick={actions.toCategory} />
        </Actions>
        {actions.message && <Banner collapsible={false} status="error" title={actions.message} />}
        <Heading level={2}>Organize</Heading>
        <Actions>
          <SectionMenu label="Move to priorities" onPick={(s) => void actions.toPriorities(s)} />
          {note.draft === undefined && (
            <SectionMenu label="Make a draft" onPick={(s) => void actions.toNewDraft(s)} />
          )}
          <DraftPicker except={note.draft} onPick={(p, t) => void actions.toDraft(p, t)} />
          <Button clickAction={actions.remove} label="Delete" variant="destructive" />
        </Actions>
      </VStack>
    </Page>
  );
}

/**
 * A note of `INBOX.md`, by its key: its text with its marks as tags, Edit in place, its Category,
 * and under Organize, what it becomes: a priority, a new draft, part of a draft, or deleted.
 */
export function NoteView({ noteKey }: { noteKey: string }) {
  const inbox = useInbox();
  const here = useRepoPath();
  // The note's id while it is renamed: its key changes before its address does.
  const [renaming, setRenaming] = useState<string>();
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(true);
  if (!inbox) {
    return null;
  }
  const found = placed(inbox, noteKey, renaming);
  if (!found) {
    return (
      <Page>
        <Banner
          collapsible={false}
          description={
            <Link hasUnderline href={here("/inbox")}>
              Open the inbox
            </Link>
          }
          status="error"
          title="This note is no longer in INBOX.md."
        />
      </Page>
    );
  }
  return <NoteBody inbox={inbox} onRenaming={setRenaming} placed={found} />;
}
