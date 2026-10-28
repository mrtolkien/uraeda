// The key picker (US4): the Jump palette made general, one dialog over a list of items of any kind,
// with the item under the cursor previewed beside the list as raw markdown, on wide and semi-wide
// screens. Astryx's `CommandPalette` draws the search and the list, inline in a dialog of our own,
// so the preview can sit beside them: an Astryx gap (plan, Complexity tracking), for the palette
// has no preview slot, and the markdown is drawn as plain wrapped text. A part in its footer reads the cursor
// from the palette's context, puts it on the first result after each letter, so Enter opens it, and
// lifts it to the preview (rulings R1 and R28 of the layout look). On narrow screens it is a sheet,
// its list alone. Opening it adds a history entry, so Back closes it; Escape closes it, and the
// focus returns to where it was: the dialog's own (Astryx's `Dialog` and `BottomSheet` keep the
// element that had the focus as they open, whatever it is, and give it back as they close), so a pick
// is left to the page it opens (R33).
import { BottomSheet } from "@astryxdesign/core/BottomSheet";
import {
  CommandPalette,
  CommandPaletteFooter,
  CommandPaletteInput,
  useCommandPaletteContext,
} from "@astryxdesign/core/CommandPalette";
import { Dialog } from "@astryxdesign/core/Dialog";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import {
  borderVars,
  colorVars,
  fontWeightVars,
  spacingVars,
  typographyVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import type { SearchableItem, SearchSource } from "@astryxdesign/core/Typeahead";
import * as stylex from "@stylexjs/stylex";
import {
  type ReactNode,
  type RefObject,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { searchRanked } from "../decisions/jump.ts";
import { afterOverlayCloses } from "../layout/Overlay.tsx";
import { useBackCloses } from "../layout/useBackCloses.ts";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { CardKindIcon, CardStatus } from "../sidebar/ItemCard.tsx";
import type { PickerItem } from "./pickerSources.ts";

export { useKeyPicker } from "./pickerState.ts";

const styles = stylex.create({
  body: {
    display: "grid",
    gridTemplateColumns: "var(--size-palette-list) minmax(0, 1fr)",
    maxHeight: "var(--size-palette-height)",
    minHeight: 0,
  },
  list: {
    // The palette's own surface would read as a card inside the dialog.
    boxShadow: "none",
    // As wide as the sheet or the dialog's column: Astryx's dialog also keeps a gutter from the
    // window's edges, which inside the phone's sheet left a strip on its right.
    maxWidth: "100%",
    minWidth: 0,
  },
  mark: {
    color: colorVars["--color-text-secondary"],
    display: "inline-flex",
    fontWeight: fontWeightVars["--font-weight-semibold"],
    minWidth: spacingVars["--spacing-6"],
  },
  // As the file is written, its lines wrapped at the words: Astryx's wrapped code block breaks a
  // word anywhere ("app" and "roved."), which reads badly in prose.
  preview: {
    borderInlineStartColor: colorVars["--color-border"],
    borderInlineStartStyle: "solid",
    borderInlineStartWidth: borderVars["--border-width"],
    maxHeight: "var(--size-palette-height)",
    minWidth: 0,
    overflowY: "auto",
  },
  raw: {
    fontFamily: typographyVars["--font-family-code"],
    margin: 0,
    overflowWrap: "break-word",
    padding: spacingVars["--spacing-4"],
    whiteSpace: "pre-wrap",
  },
  row: {
    flexGrow: 1,
    minWidth: 0,
  },
  // The row fills the item, so the kind is at its end whatever the title's length.
  rowFill: {
    width: "100%",
  },
  // The sheet's handle floats over the top of its content, which would hide the search field's
  // outline: the list starts below it.
  sheet: {
    paddingBlockStart: spacingVars["--spacing-6"],
  },
});

/** An item as the palette's list holds it: its address is its id. */
type PickerEntry = SearchableItem<{ item: PickerItem }>;

const toEntry = (item: PickerItem): PickerEntry => ({
  auxiliaryData: { item },
  id: item.id,
  label: item.title,
});

/** An item's numeral, or its icon, its card's for a card, in one column. */
function Mark({ item }: { item: PickerItem }) {
  return (
    <span {...stylex.props(styles.mark)}>
      {item.mark ??
        (item.card ? <CardKindIcon item={item.card} /> : <Icon icon={item.icon} size="sm" />)}
    </span>
  );
}

/**
 * The palette's footer, its keys, which also follows the cursor: it puts it on the first result
 * when a search left none, and tells `onCursor` the item under it. When the items change while it
 * is open, as a decision is committed, it runs the search again, for the palette searches only as
 * it opens and as a letter is typed.
 */
function CursorFooter({
  field,
  onCursor,
  source,
}: {
  /** The search field: its text is what the human sees, whatever the palette has committed. */
  field: RefObject<HTMLInputElement | null>;
  onCursor: (id: string | undefined) => void;
  source: SearchSource<PickerEntry>;
}) {
  const palette = useCommandPaletteContext();
  const searched = useRef(source);
  // The field's text, not the palette's: a letter typed as the items arrive is in the field while
  // the palette still holds the query before it, and searching that would drop the letter.
  const searchAgain = useEffectEvent(() =>
    palette?.setSearch(field.current?.value ?? palette.search),
  );
  useEffect(() => {
    if (searched.current !== source) {
      searched.current = source;
      searchAgain();
    }
  }, [source]);
  const index = palette?.highlightedIndex ?? -1;
  const entries = palette?.selectableItems ?? [];
  const setHighlighted = palette?.setHighlightedIndex;
  const count = entries.length;
  const id = entries[index]?.value;
  useEffect(() => {
    if (index === -1 && count > 0) {
      setHighlighted?.(0);
    }
  }, [count, index, setHighlighted]);
  useEffect(() => {
    onCursor(id);
  }, [onCursor, id]);
  return <CommandPaletteFooter />;
}

/** The item under the cursor, as its file is written. */
function Preview({ item }: { item: PickerItem | undefined }) {
  return (
    <section aria-label="Preview" {...stylex.props(styles.preview)}>
      {item && (
        <div {...stylex.props(styles.raw)}>
          {/* A line is its own block, an empty one held open by a break. */}
          {item.preview
            .split("\n")
            .map((text, id) => ({ id, text }))
            .map(({ id, text }) => (
              <div key={id}>{text === "" ? <br /> : text}</div>
            ))}
        </div>
      )}
    </section>
  );
}

/**
 * A row of the list: the mark, the title, and a card's status, as the sidebar's card draws it, the
 * agent at work on it. The kind is the mark's icon, among several kinds too.
 */
function Row({ item }: { item: PickerItem }) {
  return (
    <HStack align="center" gap={2} xstyle={styles.rowFill}>
      <Mark item={item} />
      <span {...stylex.props(styles.row)}>{item.title}</span>
      {item.card && <CardStatus item={item.card} />}
    </HStack>
  );
}

/** The palette's search and list, inline, its cursor told to `onCursor`. */
function Search({
  isLoading,
  items,
  label,
  maxHeight,
  onCursor,
  onOpenChange,
  onPick,
  placeholder,
}: {
  isLoading: boolean;
  items: ReadonlyArray<PickerItem>;
  label: string;
  /** The palette's height at most: the dialog's, or the sheet's whole. */
  maxHeight: string;
  onCursor: (id: string | undefined) => void;
  onOpenChange: (open: boolean) => void;
  onPick: (id: string) => void;
  placeholder: string;
}) {
  const field = useRef<HTMLInputElement>(null);
  // The caller builds the items again at each render: they are kept until what the list shows of
  // them changes, and the source with them. The previews are no part of that, so a cursor that
  // moves does not weigh whole files.
  const signature = JSON.stringify(items.map(({ preview: _preview, ...shown }) => shown));
  const [kept, setKept] = useState({ items, signature });
  if (kept.signature !== signature) {
    setKept({ items, signature });
  }
  const source = useMemo<SearchSource<PickerEntry>>(
    () => ({
      bootstrap: () => kept.items.map(toEntry),
      search: (query: string) =>
        searchRanked(kept.items, query, (item) => ({
          numeral: item.mark,
          summary: item.summary ?? null,
          title: item.title,
        })).map(toEntry),
    }),
    [kept],
  );
  // Inline, the palette leaves the focus where it is: the dialog around it is what opened.
  useEffect(() => {
    const frame = requestAnimationFrame(() => field.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <CommandPalette<PickerEntry>
      emptyBootstrapText={isLoading ? "Loading…" : "Nothing to find."}
      emptySearchText={isLoading ? "Loading…" : "Nothing matches."}
      footer={<CursorFooter field={field} onCursor={onCursor} source={source} />}
      input={<CommandPaletteInput label={label} placeholder={placeholder} ref={field} />}
      isInline
      isOpen
      label={label}
      maxHeight={maxHeight}
      onOpenChange={onOpenChange}
      onValueChange={onPick}
      renderItem={(entry: PickerEntry) =>
        entry.auxiliaryData && <Row item={entry.auxiliaryData.item} />
      }
      role="group"
      searchSource={source}
      width="100%"
      xstyle={styles.list}
    />
  );
}

/** What the open picker draws: its list, and beside it, on wide screens, the cursor's preview. */
function Body({
  isNarrow: narrow,
  items,
  ...search
}: {
  isLoading: boolean;
  isNarrow: boolean;
  items: ReadonlyArray<PickerItem>;
  label: string;
  onOpenChange: (open: boolean) => void;
  onPick: (id: string) => void;
  placeholder: string;
}) {
  // Its own state: a picker opened again starts with no cursor, and so no old item's preview.
  const [cursor, setCursor] = useState<string>();
  const list = (
    <Search
      items={items}
      maxHeight={narrow ? "100%" : "var(--size-palette-height)"}
      onCursor={setCursor}
      {...search}
    />
  );
  return narrow ? (
    <div {...stylex.props(styles.sheet)}>{list}</div>
  ) : (
    <div {...stylex.props(styles.body)}>
      {list}
      <Preview item={items.find((item) => item.id === cursor)} />
    </div>
  );
}

/**
 * The picker over `items` while `isOpen`: Enter or a tap on an item calls `onPick` once the
 * picker's history entry is gone, Escape, Back, or a tap outside closes it, `onClose`. `title`
 * names the dialog and its history entry; `label` names its search field, `title` unless given.
 */
export function KeyPicker({
  isLoading = false,
  isOpen,
  items,
  label,
  onClose,
  onPick,
  placeholder = "Find…",
  title,
}: {
  /** Its items are still being read: the list says "Loading…" and the search is kept. */
  isLoading?: boolean;
  isOpen: boolean;
  items: ReadonlyArray<PickerItem>;
  label?: string;
  onClose: () => void;
  /** What Enter does with an item: it opens its page, and the picker closes. */
  onPick: (item: PickerItem) => void;
  placeholder?: string;
  title: string;
}): ReactNode {
  const narrow = isNarrow(useWidthClass());
  const close = useBackCloses(title, isOpen, onClose);
  // Escape reaches the palette's field and the dialog's both: the first closes it.
  const closing = useRef(false);
  useEffect(() => {
    closing.current = !isOpen;
  }, [isOpen]);
  const onOpenChange = (open: boolean) => {
    if (!open && !closing.current) {
      closing.current = true;
      close();
    }
  };
  // The item opens once the picker's history entry is gone, which Back would otherwise undo.
  const pick = (id: string) => {
    const item = items.find((one) => one.id === id);
    if (item) {
      afterOverlayCloses(title, () => onPick(item));
    }
  };
  const body = isOpen && (
    <Body
      isLoading={isLoading}
      isNarrow={narrow}
      items={items}
      label={label ?? title}
      onOpenChange={onOpenChange}
      onPick={pick}
      placeholder={placeholder}
    />
  );
  if (narrow) {
    return (
      <BottomSheet
        height="tall"
        isOpen={isOpen}
        label={title}
        onOpenChange={onOpenChange}
        padding={0}
      >
        {body}
      </BottomSheet>
    );
  }
  return (
    <Dialog
      aria-label={title}
      isOpen={isOpen}
      maxHeight="var(--size-palette-height)"
      onOpenChange={onOpenChange}
      padding={0}
      width="var(--size-palette)"
    >
      {body}
    </Dialog>
  );
}
