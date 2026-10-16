// The note pane's own controls: its Category, and the Organize actions, as `NoteView` draws them.
// TEMPORARY: copies of `NoteView`'s, which the redesign's implementation shares between the two.
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Selector } from "@astryxdesign/core/Selector";
import { VStack } from "@astryxdesign/core/VStack";
import type { ReactNode } from "react";
import { useDraftTitles, useWorkspace } from "../data.ts";
import { useWidthClass } from "../layout/useWidthClass.ts";
import { TITLES } from "../QuickAdd.tsx";
import type { useNoteActions } from "../useNoteActions.ts";

/** The Category menu's value for no category; a category's is its name, after `:`. */
const NONE = "none";

/** The path the editor and the moves take for a draft the workspace lists: a folder's proposal. */
export function draftFile(path: string) {
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
export function CategoryMenu({
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

/**
 * Organize: what the note becomes, a priority, a new draft, or part of a draft. Delete is the
 * pane's own, under it.
 */
export function Organize({
  actions,
  draft,
}: {
  actions: ReturnType<typeof useNoteActions>;
  draft: string | undefined;
}) {
  return (
    <VStack gap={2}>
      <Heading level={2}>Organize</Heading>
      <Actions>
        <SectionMenu label="Move to priorities" onPick={(s) => void actions.toPriorities(s)} />
        {draft === undefined && (
          <SectionMenu label="Make a draft" onPick={(s) => void actions.toNewDraft(s)} />
        )}
        <DraftPicker except={draft} onPick={(p, t) => void actions.toDraft(p, t)} />
      </Actions>
    </VStack>
  );
}
