// What `keys.test.ts` opens: a page with keys of its own, a row that comes and goes with its key,
// a text field, the single-key switch, and a picker, under the app's `KeysHost`. It says what
// ran, and the hints the status line would draw.
import { mount, signal, Text, View } from "nsh";
import { Input } from "nsh/base";
import { KeyPicker } from "../KeyPicker";
import { KeysHost } from "../KeysHost";
import { tokens } from "../../tokens";
import { keyHints, KeyScope, registerKey, singleKeys } from "../registry";

const ran = signal<Array<string>>([]);
const note = (what: string) => () => ran.update((list) => [...list, what]);

const PLACES = [
  { id: "inbox", title: "Inbox" },
  { id: "settings", title: "Settings" },
  { id: "sessions", title: "Sessions" },
];

/** The hints the status line would draw, as one line. */
const hints = () =>
  keyHints()
    .map(({ keys, label }) => `${keys} ${label}`)
    .join(" · ");

/** A row with a key of its own, which works while the row is there. */
function Row() {
  registerKey({
    hint: "d",
    hintLabel: "delete",
    keys: "d",
    label: "Delete",
    run: note("deleted the row"),
  });
  return <Text>A row</Text>;
}

function Page() {
  registerKey([
    { hint: "j", hintLabel: "down", keys: "j", label: "Down", run: note("down") },
    { keys: "ArrowDown", label: "Arrow down", run: note("arrow") },
    { keys: "g i", label: "Inbox", run: note("went to the inbox") },
    { hint: "space", hintLabel: "menu", keys: "space n n", label: "Note", run: note("new note") },
  ]);
  const hasRow = signal(true);
  const isPicking = signal(false);
  const typed = signal("");
  const picked = signal("nothing");
  return (
    <View style={{ backgroundColor: tokens.role.page, flex: 1, gap: 8, padding: 16 }}>
      <Text>Ran: {ran().join(", ") || "nothing"}</Text>
      <Text>Hints: {hints() || "none"}</Text>
      <Text>Field: {typed()}</Text>
      <Text>Picked: {picked()}</Text>
      <Input onChange={({ value }) => typed.set(value)} testID="field" />
      <Text onPress={() => hasRow.set(false)}>Remove the row</Text>
      <Text onPress={() => singleKeys.set(false)}>Turn single keys off</Text>
      <Text onPress={() => isPicking.set(true)}>Open the picker</Text>
      <If when={hasRow()}>
        <Row />
      </If>
      <If when={isPicking()}>
        <KeyPicker
          items={PLACES}
          onClose={() => isPicking.set(false)}
          onPick={(place) => picked.set(place.title)}
          preview={(place) => <Text>Preview of {place.title}</Text>}
          title="Find a place"
        />
      </If>
    </View>
  );
}

mount(() => (
  <KeysHost>
    <KeyScope name="Checks">
      <Page />
    </KeyScope>
  </KeysHost>
));
