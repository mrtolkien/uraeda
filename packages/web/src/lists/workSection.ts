// What a list of work is made of (see `WorkList`): its sections, their colours, how they are
// arranged, the edits of a row's place in its outline, and what the list is given.
import type { HeadingLevel } from "@astryxdesign/core/Heading";
import type { Icon } from "@astryxdesign/core/Icon";
import type { ComponentProps, ReactNode } from "react";
import type { WorkRow } from "./Card.tsx";
import type { Move } from "./destination.ts";
import type { OnDrop, OnMove } from "./useDragOrder.ts";
import type { RowAction, SectionPicker } from "./useRowKeys.ts";

/** A section's colour: the ongoing entries green, Now blue, Later grey, the rest neutral. */
export type Tone = "green" | "blue" | "neutral" | "gray";

/** A section of the list: a heading of the file, the ongoing entries, or a category of the inbox. */
export interface WorkSection {
  /** What goes under its pane, in its column: Home's Recent under the inbox. */
  below?: ReactNode;
  /** Its context, a line under its title. */
  context?: string;
  /** The count in its title, where it is not its rows': Home's inbox lists three of its nine. */
  count?: number;
  /** What ends it, like its Add row. */
  footer?: ReactNode;
  /** An icon before its title. */
  icon?: ComponentProps<typeof Icon>["icon"];
  id: string;
  /** Whether its rows stay where they are, and nothing is dropped in it, as the ongoing entries. */
  isFixed?: boolean;
  /** Its menu, in the top border at its end. */
  menu?: ReactNode;
  rows: ReadonlyArray<WorkRow>;
  title: string;
  /** What draws its title's words, as a title renamed in place: `title` still names it. */
  titleNode?: ReactNode;
  tone: Tone;
}

/** How the sections are arranged: panes in a row that scrolls, or one under the other. */
export type WorkLayout = "columns" | "stack";

/** An edit of a row's place in its outline, from the keys: Tab, Shift+Tab, and a nested row's moves. */
export type OutlineMove = "indent" | "outdent" | "up" | "down";

/** What a list of work is given: its sections, its selection, and what its keys and drops call. */
export type WorkListProps = {
  /**
   * Each new object leaves the list with no row selected, as something else on its page is:
   * home's panes.
   */
  clear?: object | undefined;
  /** A row to select, with the focus, as a write placed it: each new object selects it again. */
  follow?: { key: string } | undefined;
  /** The key of the row selected until another is, where the address names none. */
  initial?: string;
  isFocused?: boolean;
  /** `layout` is the human's choice: kept at every width, the phone's too. */
  isLayoutChosen?: boolean;
  /**
   * For lines that run long, as the priorities': the columns start at 500 px, not 400, and the
   * table is centred, 80 characters a line at most, its panes roomier inside past 600 px.
   */
  isRoomy?: boolean;
  layout?: WorkLayout;
  /** The level of its panes' titles, where the page's headings put them. */
  level?: HeadingLevel;
  /** What `o` calls for the selected row, and `O` with `isAbove`. */
  onAddBeside?: (section: string, row: WorkRow, isAbove?: boolean) => void;
  /**
   * What `d` calls for the selected row, once the human confirmed: it deletes the line, and may
   * resolve with `false` when the write is refused, for the row to come back.
   */
  onDelete?: (row: WorkRow) => Promise<boolean | void> | void;
  /**
   * Up from the top row of a section, or any move with no row selected (`section` undefined):
   * `true` says what is above the list took the focus, as home's panes do.
   */
  onEdge?: (move: Move, section: string | undefined) => boolean;
  onMove?: OnMove;
  /**
   * A drop that nests a row, moves a nested row, or makes one a line: the list then drags every
   * row, nested ones too, to the depth it is dragged to sideways.
   */
  onNest?: OnDrop;
  onOpen?: (href: string) => void;
  /**
   * An edit of the outline of the selected row: Tab indents it, Shift+Tab outdents it, and the keys
   * that move a nested row move it up or down among its siblings.
   */
  onOutline?: (row: WorkRow, edit: OutlineMove) => void;
  /** What `p` calls for the selected row; returning `false` says it has nothing to promote. */
  onPromote?: (row: WorkRow) => boolean | void;
  /** Hears the key of the row selected, as it changes: by the keys, the pointer, or a write. */
  onSelected?: (key: string | undefined) => void;
  /** What `s` calls for the selected row: it starts from it. */
  onStart?: (row: WorkRow) => void;
  /** The list's own keys on the selected row, in its bar, as the inbox's `p` and `v`. */
  rowActions?: ReadonlyArray<RowAction>;
  /**
   * A key that opens a picker of the sections for the selected line, as the inbox's `c`: `open` is
   * given the row and what moves it to the end of the section chosen, by its id, as a key's move.
   */
  sectionPicker?: Omit<SectionPicker, "open"> & {
    open: (row: WorkRow, moveTo: (section: string) => void) => void;
  };
  sections: ReadonlyArray<WorkSection>;
  selected?: string;
};
