// The key picker: one layer over a list of items of any kind, with a search, and the item under
// the cursor previewed beside the list on a wide window, drawn as its caller draws that content.
// Every picker of the app is this one: Find, Space Space, promote, a category's, a font's. The
// cursor sits on the first result after each letter, so Enter opens it; the arrows, and Ctrl+J and
// Ctrl+K as in LazyVim's picker, move it, from the search itself; Enter or a press on a row picks,
// and Escape, a press outside, or the phone's Back closes. On a narrow window it is a sheet, its
// list alone. What it lists, and where a pick goes, are its caller's.
// With Vim, `j` and `k` in normal mode move the cursor too, as the shared field gives a one-line
// field's owner its down and up.
import { computed, effect, type JSX, Scroll, type ScrollRef, signal, untracked, View } from "nsh";
import { isNarrow } from "../width";
import { Kbd, Text } from "../controls";
import { tokens } from "../tokens";
import { searchRanked } from "./pickerSearch";
import { registerKey } from "./registry";
import { Overlay } from "../surfaces";
import { TextField } from "../text/TextField";

/** What a picker lists: an item of any kind, found by its title and its first sentence. */
export type PickerItem = {
  /** Small words at the row's end, as "in use". */
  aside?: string;
  /** Unique among the items. */
  id: string;
  /** What the row shows before its title, as a principle's numeral. */
  mark?: string;
  /** A first sentence, which a search reads after the title. */
  summary?: string | null;
  title: string;
};

/** A row's height: a finger's target on a narrow window, a row's elsewhere. */
const rowHeight = () => (isNarrow() ? 44 : tokens.space.row);

/** What a picker takes. */
export type KeyPickerProps<Item extends PickerItem> = {
  /** Its items are still being read: the list says so, and the search is kept. */
  isLoading?: boolean;
  items: ReadonlyArray<Item>;
  onClose: () => void;
  /** Shown while true, and for its way out after: true unless given. */
  open?: boolean;
  /** The item under the cursor, as it moves: a caller that previews it in the page itself. */
  onCursor?: (item: Item | undefined) => void;
  /** What Enter does with an item, once the picker is closed. */
  onPick: (item: Item) => void;
  placeholder?: string;
  /** The item under the cursor, drawn beside the list on a wide window. */
  preview?: (item: Item) => JSX.Element;
  /** The item the cursor starts on, as the one in use. */
  start?: string;
  title: string;
};

/** The filter, the list, and the preview, with the picker's keys: made anew at each opening. */
function Picking<Item extends PickerItem>(props: { picker: KeyPickerProps<Item> }) {
  const picker = props.picker;
  const query = signal("");
  const found = computed(() => searchRanked(picker.items, query(), (item) => item));
  // The cursor's item, by its id: the first result after a letter, `start` before any.
  const cursor = signal<string | undefined>(untracked(() => picker.start));
  const at = computed(() => {
    const index = found().findIndex((item) => item.id === cursor());
    return index === -1 ? 0 : index;
  });
  const held = (): Item | undefined => found()[at()];
  const move = (by: number) => {
    const next = found()[Math.min(Math.max(at() + by, 0), found().length - 1)];
    cursor.set(next?.id);
  };
  const pick = (item: Item | undefined) => {
    if (item !== undefined) {
      picker.onClose();
      picker.onPick(item);
    }
  };

  const here = { inField: true } as const;
  const moves = (by: number) => ({ repeat: true, run: () => move(by) });
  // Heard in the search, which has the focus: none of them types.
  registerKey([
    { ...here, hint: "↑ ↓", hintLabel: "move", keys: "ArrowDown", label: "Next", ...moves(1) },
    { ...here, keys: "mod+j", label: "Next", ...moves(1) },
    { ...here, keys: "ArrowUp", label: "Previous", ...moves(-1) },
    { ...here, keys: "mod+k", label: "Previous", ...moves(-1) },
    {
      ...here,
      hint: "⏎",
      hintLabel: "open",
      keys: "Enter",
      label: "Open",
      run: () => pick(held()),
    },
  ]);

  effect(() => picker.onCursor?.(held()));
  // The cursor's row stays in the list's sight.
  let list: ScrollRef | undefined;
  effect(() => list?.scrollTo({ animated: false, y: Math.max(0, (at() - 4) * rowHeight()) }));

  const empty = () =>
    picker.isLoading === true
      ? "Loading…"
      : picker.items.length === 0
        ? "Nothing to find."
        : "Nothing matches.";
  return (
    <>
      <View style={{ flexDirection: "row", flexShrink: 1, gap: 16 }}>
        <View style={{ flexBasis: 0, flexGrow: 1, gap: 8 }}>
          <TextField
            first
            label={picker.title}
            lines="one"
            onChange={(value) => {
              query.set(value);
              cursor.set(undefined);
            }}
            placeholder={picker.placeholder ?? "Find…"}
            testID="key-picker-filter"
            value={query()}
          />
          <Scroll
            ref={(node: ScrollRef) => (list = node)}
            style={{ flexShrink: 1, maxHeight: 16 * rowHeight() }}
          >
            <If when={found().length > 0} else={<Text tone="quiet">{empty()}</Text>}>
              <Each key={(item: Item) => item.id} of={found()}>
                {(item: () => Item) => (
                  <View
                    focusable={false}
                    onPress={() => pick(item())}
                    style={{
                      alignItems: "center",
                      backgroundColor: held()?.id === item().id ? tokens.row.selected : undefined,
                      flexDirection: "row",
                      gap: 8,
                      minHeight: rowHeight(),
                      paddingHorizontal: 8,
                    }}
                  >
                    <If when={item().mark}>{(mark) => <Text tone="quiet">{mark()}</Text>}</If>
                    <View style={{ flexGrow: 1, flexShrink: 1 }}>
                      <Text>{item().title}</Text>
                    </View>
                    <If when={item().aside}>{(aside) => <Text tone="quiet">{aside()}</Text>}</If>
                  </View>
                )}
              </Each>
            </If>
          </Scroll>
          <If when={!isNarrow()}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
              <Kbd keys="ArrowUp" />
              <Kbd keys="ArrowDown" />
              <Text tone="quiet">move</Text>
              <Kbd keys="Enter" />
              <Text tone="quiet">open</Text>
              <Kbd keys="Escape" />
              <Text tone="quiet">close</Text>
            </View>
          </If>
        </View>
        <If when={!isNarrow() && picker.preview !== undefined}>
          <Scroll style={{ flexBasis: 0, flexGrow: 1 }}>
            <If when={held()}>{(item) => <>{picker.preview?.(item())}</>}</If>
          </Scroll>
        </If>
      </View>
    </>
  );
}

export function KeyPicker<Item extends PickerItem>(props: KeyPickerProps<Item>) {
  return (
    <Overlay
      name={props.title}
      onClose={() => props.onClose()}
      open={props.open}
      testID="key-picker"
      title={props.title}
      top
      width={920}
    >
      <Picking picker={props} />
    </Overlay>
  );
}
