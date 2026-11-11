// A text field with a list of choices under it, found by what is typed: a file picked after `@`
// in a composer, a category for a note. The cursor sits on the first choice after each letter, so
// Enter picks it; the arrows, and Ctrl+J and Ctrl+K as in LazyVim's picker, move it from the field
// itself, and so do `j` and `k` in Vim's normal mode. Its keys are a selection's, on while the field
// has the focus. A press on a row picks it too. What it lists, and what a pick does, are its
// caller's. The key picker, which floats over the page, is `app/ui/keys/KeyPicker.tsx`.
import { computed, effect, Scroll, type ScrollRef, signal, untracked, View } from "nsh";
import { Text } from "../controls";
import { KeyScope, registerKey } from "../keys/registry";
import { type PickerItem } from "../keys/KeyPicker";
import { searchRanked } from "../keys/pickerSearch";
import { tokens } from "../tokens";
import { isNarrow } from "../width";
import { TextField } from "./TextField";

export type PickerFieldProps<Item extends PickerItem> = {
  autoFocus?: boolean;
  /** Said where nothing is found: "No file has that name." */
  empty?: string;
  first?: boolean;
  /** Its choices are still being read: the list says so. */
  isLoading?: boolean;
  items: ReadonlyArray<Item>;
  label: string;
  onPick: (item: Item) => void;
  placeholder?: string;
  /** The rows shown before the list scrolls: 6 unless given. */
  rows?: number;
  testID?: string;
};

/** A row's height: a finger's target on a narrow window, a row's elsewhere. */
const rowHeight = () => (isNarrow() ? 44 : tokens.space.row);

function Row(props: { held: boolean; item: PickerItem; onPress: () => void }) {
  return (
    <View
      focusable={false}
      onPress={props.onPress}
      style={{
        alignItems: "center",
        backgroundColor: props.held ? tokens.row.selected : "transparent",
        borderLeftColor: props.held ? tokens.light.focus : "transparent",
        borderLeftWidth: tokens.row.bar,
        flexDirection: "row",
        gap: 8,
        height: rowHeight(),
        paddingHorizontal: 8,
      }}
    >
      <If when={props.item.mark}>{(mark) => <Text tone="faint">{mark()}</Text>}</If>
      <Text lines={1} style={{ flexShrink: 1 }}>
        {props.item.title}
      </Text>
      <If when={props.item.aside}>
        {(aside) => (
          <Text size="under" style={{ marginLeft: "auto" }} tone="faint">
            {aside()}
          </Text>
        )}
      </If>
    </View>
  );
}

export function PickerField<Item extends PickerItem>(props: PickerFieldProps<Item>) {
  const query = signal("");
  const focused = signal(false);
  const found = computed(() => searchRanked(props.items, query(), (item) => item));
  const cursor = signal(0);
  effect(() => {
    found();
    untracked(() => cursor.set(0));
  });
  const move = (by: number) =>
    cursor.set(Math.min(Math.max(untracked(cursor) + by, 0), untracked(found).length - 1));
  const pick = (item: Item | undefined) => {
    if (item !== undefined) {
      props.onPick(item);
    }
  };
  let list: ScrollRef | undefined;
  effect(() => list?.scrollTo({ animated: false, y: Math.max(0, (cursor() - 2) * rowHeight()) }));

  const moves = (by: number) => ({ repeat: true, run: () => move(by) });
  const Keys = () => {
    const here = { inField: true } as const;
    registerKey([
      { ...here, hint: "↑ ↓", hintLabel: "move", keys: "ArrowDown", label: "Next", ...moves(1) },
      { ...here, keys: "mod+j", label: "Next", ...moves(1) },
      { ...here, keys: "ArrowUp", label: "Previous", ...moves(-1) },
      { ...here, keys: "mod+k", label: "Previous", ...moves(-1) },
      {
        ...here,
        hint: "⏎",
        hintLabel: "pick",
        keys: "Enter",
        label: "Pick",
        run: () => pick(untracked(found)[untracked(cursor)]),
      },
    ]);
    return null;
  };

  const empty = () => (props.isLoading === true ? "Loading…" : (props.empty ?? "Nothing matches."));
  return (
    <View style={{ alignSelf: "stretch", gap: 4 }} testID={props.testID}>
      <KeyScope kind="selection" name={props.label} on={focused}>
        <Keys />
      </KeyScope>
      <TextField
        autoFocus={props.autoFocus}
        first={props.first}
        label={props.label}
        lines="one"
        onBlur={() => focused.set(false)}
        onChange={(value) => query.set(value)}
        onFocus={() => focused.set(true)}
        placeholder={props.placeholder ?? "Find…"}
        value={query()}
      />
      <Scroll
        ref={(node: ScrollRef) => (list = node)}
        style={{ maxHeight: (props.rows ?? 6) * rowHeight() }}
      >
        <Each key={(item: Item) => item.id} of={found()}>
          {(item: () => Item) => (
            <Row
              held={found()[cursor()]?.id === item().id}
              item={item()}
              onPress={() => pick(item())}
            />
          )}
        </Each>
        <If when={found().length === 0}>
          <Text style={{ paddingHorizontal: 8 }} tone="faint">
            {empty()}
          </Text>
        </If>
      </Scroll>
    </View>
  );
}
