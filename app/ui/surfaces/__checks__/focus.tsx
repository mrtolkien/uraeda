// The page of the surfaces' tests of the focus: a field of the page, and a dialog with two fields
// of its own, opened by a key that is heard in a field too.
import { type InputRef, mount, signal, Text, View } from "nsh";
import { Input } from "nsh/base";
import { KeysHost } from "../../keys/KeysHost";
import { KeyScope, registerKey } from "../../keys/registry";
import { Dialog, focusStop } from "..";

/** A field that says it can take the focus, and shows what was typed in it. */
function Field(props: { first?: boolean; name: string }) {
  let field: InputRef | undefined;
  const stop = focusStop(() => field, { first: props.first });
  const typed = signal("");
  return (
    <View>
      <Text>
        {props.name}: {typed()}
      </Text>
      <Input
        onBlur={stop.onBlur}
        onChange={({ value }) => typed.set(value)}
        onFocus={stop.onFocus}
        ref={(node: InputRef) => (field = node)}
        testID={props.name}
      />
    </View>
  );
}

function Page() {
  const isOpen = signal(false);
  registerKey({ inField: true, keys: "mod+o", label: "Ask", run: () => isOpen.set(true) });
  return (
    <View style={{ flex: 1, gap: 8, padding: 16 }}>
      <Field name="page" />
      <Dialog onClose={() => isOpen.set(false)} open={isOpen()} testID="dialog" title="A question">
        <Field first name="first" />
        <Field name="second" />
      </Dialog>
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
