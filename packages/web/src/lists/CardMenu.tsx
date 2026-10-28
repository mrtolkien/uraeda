// A card's `…` menu: a note's opens its view, and offers its moves out of the inbox, its category,
// and Delete, each running what the pane runs (`useNoteActions`). A priority has none: its keys and
// a drag do all of it. The button shows on hover, on the selected card, on keyboard focus
// within the card, and always when the pointer cannot hover, by the card's `--menu-opacity`.
import { DropdownMenu, type DropdownMenuOption } from "@astryxdesign/core/DropdownMenu";
import * as stylex from "@stylexjs/stylex";
import { useContext, useEffect, useState } from "react";
import type { Inbox } from "uraeda-server/fate";
import { useMenuPresentation } from "../layout/useWidthClass.ts";
import { TITLES } from "../QuickAdd.tsx";
import { plain } from "../Spans.tsx";
import { type Placed, useNoteActions } from "../useNoteActions.ts";
import { MenuStateContext } from "./Card.tsx";
import { MORE_ICON } from "../layout/ActionsMenu.tsx";

const styles = stylex.create({
  // The card's variable, shown while the menu is open, though the pointer left the card for it.
  open: { opacity: 1 },
  // With a mouse, a button well inside the card, never touching its borders: a one-line card is as
  // tall as an `sm` button. A touch screen keeps the control's own size, as its target.
  trigger: {
    height: { "@media (hover: hover)": "1.5rem", default: null },
    minHeight: { "@media (hover: hover)": 0, default: null },
    minWidth: { "@media (hover: hover)": 0, default: null },
    opacity: "var(--menu-opacity, 1)",
    width: { "@media (hover: hover)": "1.5rem", default: null },
  },
});

/**
 * What `…` opens: `items` under `label`, as a popover, or a bottom sheet on a narrow screen. In a
 * card, the list holds whether it is open, so the `m` key opens it as the button does.
 */
export function CardMenu({
  items,
  label,
  onOpen,
}: {
  items: Array<DropdownMenuOption>;
  label: string;
  onOpen?: () => void;
}) {
  const presentation = useMenuPresentation();
  const held = useContext(MenuStateContext);
  const [isOwnOpen, setOwnOpen] = useState(false);
  const isOpen = held?.isOpen ?? isOwnOpen;
  return (
    <DropdownMenu
      alignment="end"
      button={{
        icon: MORE_ICON,
        isIconOnly: true,
        label,
        size: "sm",
        variant: "ghost",
        xstyle: [styles.trigger, isOpen && styles.open],
      }}
      hasChevron={false}
      isMenuOpen={held?.isOpen}
      items={items}
      onOpenChange={(next: boolean) => {
        setOwnOpen(next);
        held?.onOpenChange(next);
        if (next) {
          onOpen?.();
        }
      }}
      placement="below"
      presentation={presentation}
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

/** A draft the menu lists: its file and its title. */
export type DraftChoice = { path: string; title: string };

/** A note's menu: `placed` is its note and place, over the inbox of `inbox`. */
export function NoteMenu({
  drafts,
  inbox,
  onOpen,
  onOpenNote,
  onRefused,
  placed,
}: {
  /** The drafts to add the note to, once the menu has been opened. */
  drafts: ReadonlyArray<DraftChoice> | undefined;
  inbox: Pick<Inbox, "hash" | "names">;
  onOpen: () => void;
  /** Opens the note's view, with its images and its draft: the row itself edits in place. */
  onOpenNote?: () => void;
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
        ...(onOpenNote === undefined ? [] : [{ label: "Open", onClick: onOpenNote }]),
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
