// The picker's filter: the shared editor in Astryx's `CommandPalette`, as the custom input its
// `input` slot takes, wired as the palette's own input is: the palette's search as its text, the
// combobox's attributes on its content element, and the palette's keys. With Vim on, normal mode's
// `j` and `k` move the highlighted row and Enter opens it, as LazyVim's picker does.
import { useCommandPaletteContext } from "@astryxdesign/core/CommandPalette";
import { Icon } from "@astryxdesign/core/Icon";
import { Spinner } from "@astryxdesign/core/Spinner";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type KeyboardEvent, type Ref, useState } from "react";
import { Editor, type EditorHandle, type FieldKey } from "./Editor.tsx";
import { took } from "./keys.ts";

const styles = stylex.create({
  // The palette's own input's line: the icon, then the field, with its room around them.
  field: { flexGrow: 1, minWidth: 0 },
  line: {
    alignItems: "center",
    display: "flex",
    flexShrink: 0,
    gap: spacingVars["--spacing-2"],
    paddingBlock: spacingVars["--spacing-3"],
    paddingInline: spacingVars["--spacing-4"],
  },
  mark: { color: colorVars["--color-text-secondary"], display: "inline-flex", flexShrink: 0 },
});

type Palette = NonNullable<ReturnType<typeof useCommandPaletteContext>>;

/**
 * A key handed to the palette, as its own input hands it: the palette reads its name alone, and
 * prevents its default, which the editor's keymap already does.
 */
function toPalette(palette: Palette | null, key: string) {
  palette?.onKeyDown({
    altKey: false,
    ctrlKey: false,
    key,
    metaKey: false,
    preventDefault: () => {},
    shiftKey: false,
  } as KeyboardEvent);
}

/** The palette's keys from the field: Down, Up, PageDown, and PageUp move its highlighted row. */
const listKeys = (palette: Palette | null): Array<FieldKey> =>
  ["ArrowDown", "ArrowUp", "PageDown", "PageUp"].map((key) => ({
    key,
    run: () => took(() => toPalette(palette, key)),
  }));

/**
 * The picker's filter, named `label`: typing searches the palette's items, Down, Up, PageDown, and
 * PageUp move along them, and Enter opens the highlighted one. Escape closes the picker; with Vim
 * on, the first Escape goes to normal mode, where `j` and `k` move along the items and Enter opens
 * one. The picker focuses it through `ref` once drawn.
 */
export function PickerEditor({
  label,
  placeholder,
  ref,
}: {
  label: string;
  placeholder: string;
  ref?: Ref<EditorHandle>;
}) {
  const palette = useCommandPaletteContext();
  // The field's own text, which the palette's search follows: the palette commits a query in a
  // transition, and its search, a letter behind while one is pending, would take the letter back.
  const [text, setText] = useState(palette?.search ?? "");
  // The palette's listbox is there only while it holds results, as its own input says.
  const count = palette?.selectableItems.length ?? 0;
  const index = palette?.highlightedIndex ?? -1;
  const hasList = count > 0;
  const attributes: Record<string, string> = {
    "aria-autocomplete": "list",
    "aria-expanded": String(Boolean(palette?.isOpen) && hasList),
    role: "combobox",
    ...(hasList && palette ? { "aria-controls": palette.listId } : {}),
    ...(hasList && palette && index >= 0 && index < count
      ? { "aria-activedescendant": palette.getItemId(index) }
      : {}),
  };
  return (
    <div {...stylex.props(styles.line)}>
      <span {...stylex.props(styles.mark)}>
        <Icon color="inherit" icon="search" size="sm" />
      </span>
      <div {...stylex.props(styles.field)}>
        <Editor
          attributes={attributes}
          keys={listKeys(palette)}
          label={label}
          // `j` and `k` in Vim's normal mode, as Down and Up, and the palette's keys, which the
          // engine's motions would take there.
          normalKeys={[
            ...listKeys(palette),
            { key: "j", run: () => took(() => toPalette(palette, "ArrowDown")) },
            { key: "k", run: () => took(() => toPalette(palette, "ArrowUp")) },
          ]}
          onChange={(value) => {
            setText(value);
            palette?.setSearch(value);
          }}
          // In insert mode, and in Vim's normal mode, whose Enter is a one-line field's Enter.
          onEnter={() => toPalette(palette, "Enter")}
          // Closes the picker, in its dialog or its sheet, as the palette's own input's Escape.
          onEscape={() => {
            palette?.onClose();
            return "handled";
          }}
          placeholder={placeholder}
          ref={ref}
          value={text}
          variant="line"
        />
      </div>
      {palette?.isBusy && <Spinner size="sm" />}
    </div>
  );
}
