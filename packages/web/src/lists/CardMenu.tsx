// A card's `…` menu. A priority's offers its moves, a draft, Start, and Delete; a note's, its moves
// out of the inbox and its category, and Delete. Every item runs what the pane runs
// (`usePriorityActions`, `useNoteActions`), and a move within a section is `moveIndex`'s, which
// the drag's `fileIndex` owns. The button shows on hover, on the selected card, on keyboard focus
// within the card, and always when the pointer cannot hover, by the card's `--menu-opacity`.
import { DropdownMenu, type DropdownMenuOption } from "@astryxdesign/core/DropdownMenu";
import { Icon } from "@astryxdesign/core/Icon";
import * as stylex from "@stylexjs/stylex";
import { useEffect, useState } from "react";
import type { Inbox } from "uraeda-server/fate";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { type Found, usePriorityActions } from "../pane/usePriorityActions.ts";
import { TITLES } from "../QuickAdd.tsx";
import { navigate, useRepoPath } from "../routes.tsx";
import { plain } from "../Spans.tsx";
import { type Placed, useNoteActions } from "../useNoteActions.ts";
import { type Direction, moveIndex, movesOf } from "./cardMoves.ts";

const styles = stylex.create({
  // The card's variable, shown while the menu is open, though the pointer left the card for it.
  open: { opacity: 1 },
  trigger: { opacity: "var(--menu-opacity, 1)" },
});

/** What `…` opens: `items` under `label`, as a popover, or a bottom sheet on a narrow screen. */
export function CardMenu({
  items,
  label,
  onOpen,
}: {
  items: Array<DropdownMenuOption>;
  label: string;
  onOpen?: () => void;
}) {
  const wide = !isNarrow(useWidthClass());
  const [isOpen, setOpen] = useState(false);
  return (
    <DropdownMenu
      alignment="end"
      button={{
        icon: <Icon color="secondary" icon="moreHorizontal" />,
        isIconOnly: true,
        label,
        size: "sm",
        variant: "ghost",
        xstyle: [styles.trigger, isOpen && styles.open],
      }}
      hasChevron={false}
      items={items}
      onOpenChange={(next: boolean) => {
        setOpen(next);
        if (next) {
          onOpen?.();
        }
      }}
      placement="below"
      presentation={wide ? "popover" : "bottom-sheet"}
    />
  );
}

/** A refusal the menu's action met, handed to the page that shows it. */
function useRefusal(message: string | undefined, onRefused: (message: string) => void) {
  useEffect(() => {
    if (message !== undefined) {
      onRefused(message);
    }
  }, [message, onRefused]);
}

/** Runs an action of the menu without waiting for it: its refusal is shown elsewhere. */
function go(call: Promise<unknown>) {
  void call;
}

const DIVIDER: DropdownMenuOption = { type: "divider" };

/** A priority's menu: `found` is its line and place, over the priorities of `hash`. */
export function PriorityMenu({
  found,
  hash,
  onRefused,
}: {
  found: Found;
  hash: string;
  onRefused: (message: string | undefined) => void;
}) {
  const here = useRepoPath();
  const actions = usePriorityActions(found, hash, () => undefined);
  useRefusal(actions.message, onRefused);
  const { entry, section } = found;
  const label = `Actions of ${plain(entry.spans)}`;
  if (entry.running) {
    // Derived: its section is not the file's to move it from, and it never deletes.
    return (
      <CardMenu
        items={[{ label: "Open", onClick: () => navigate(here(`/f/${entry.running?.folder}`)) }]}
        label={label}
      />
    );
  }
  const within = (to: Direction) => () =>
    go(actions.moveTo(section.section, moveIndex(section.entries, entry.key, to)).then(onRefused));
  const place = movesOf(section.entries, entry.key);
  const isDrafted = entry.draft !== null && entry.draft !== undefined;
  const hasLink = entry.spans.some((span) => span.link?.path);
  return (
    <CardMenu
      items={[
        ...[...TITLES]
          .filter(([id]) => id !== section.section)
          .map(([id, title]) => ({
            label: `Move to ${title}`,
            onClick: () => go(actions.moveTo(id, Number.MAX_SAFE_INTEGER).then(onRefused)),
          })),
        { isDisabled: !place.up, label: "Move up", onClick: within("up") },
        { isDisabled: !place.down, label: "Move down", onClick: within("down") },
        { isDisabled: !place.up, label: "To the top", onClick: within("top") },
        { isDisabled: !place.down, label: "To the bottom", onClick: within("bottom") },
        ...(isDrafted || hasLink
          ? []
          : [
              DIVIDER,
              { label: "Make a draft", onClick: () => go(actions.draft()) },
              { label: "Start", onClick: () => go(actions.startChange()) },
            ]),
        DIVIDER,
        { label: "Delete", onClick: () => go(actions.remove()), variant: "destructive" as const },
      ]}
      label={label}
    />
  );
}

/** A draft the menu lists: its file and its title. */
export type DraftChoice = { path: string; title: string };

/** A note's menu: `placed` is its note and place, over the inbox of `inbox`. */
export function NoteMenu({
  drafts,
  inbox,
  onOpen,
  onRefused,
  placed,
}: {
  /** The drafts to add the note to, once the menu has been opened. */
  drafts: ReadonlyArray<DraftChoice> | undefined;
  inbox: Pick<Inbox, "hash" | "names">;
  onOpen: () => void;
  onRefused: (message: string | undefined) => void;
  placed: Placed;
}) {
  const actions = useNoteActions(placed, inbox.hash, () => undefined);
  useRefusal(actions.message, onRefused);
  const { note } = placed;
  const choices = [
    ...(placed.category === undefined ? [] : [{ category: undefined, label: "No category" }]),
    ...inbox.names
      .filter((name) => name !== placed.category)
      .map((name) => ({ category: name, label: name })),
  ];
  const draftItems: Array<DropdownMenuOption> = (drafts ?? [])
    .filter((draft) => draft.path !== note.draft)
    .map((draft) => ({
      id: draft.path,
      label: draft.title,
      onClick: () => go(actions.toDraft(draft.path, draft.title)),
    }));
  return (
    <CardMenu
      items={[
        {
          items: [...TITLES].map(([id, title]) => ({
            label: title,
            onClick: () => go(actions.toPriorities(id)),
          })),
          label: "Move to a priority",
        },
        {
          items:
            draftItems.length > 0
              ? draftItems
              : [{ isDisabled: true, label: drafts === undefined ? "Loading…" : "No draft yet." }],
          label: "Add to a draft",
        },
        ...(note.draft === undefined
          ? [
              {
                items: [...TITLES].map(([id, title]) => ({
                  label: title,
                  onClick: () => go(actions.toNewDraft(id)),
                })),
                label: "Make a draft",
              },
            ]
          : []),
        ...(choices.length > 0
          ? [
              {
                items: choices.map(({ category, label }) => ({
                  label,
                  onClick: () => go(actions.toCategory(category)),
                })),
                label: "Category",
              },
            ]
          : []),
        DIVIDER,
        { label: "Delete", onClick: () => go(actions.remove()), variant: "destructive" as const },
      ]}
      label={`Actions of ${plain(note.spans)}`}
      onOpen={onOpen}
    />
  );
}
