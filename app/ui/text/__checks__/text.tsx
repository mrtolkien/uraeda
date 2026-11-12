// The page of the text field's tests: a note whose unsaved text the device keeps, and whether it
// has the focus, a dialog with a field of its own, and a composer with one image attached, which
// `detach` takes away, and the status line's hints. The host's `vim` turns Vim's keys on.
import { host, mount, signal, Text, View } from "nsh";
import { vimKeys } from "uraeda/native";
import { device } from "../../../store/device";
import { KeysHost } from "../../keys/KeysHost";
import { keyHints, KeyScope, registerKey } from "../../keys/registry";
import { Dialog } from "../../surfaces";
import { Composer } from "../Composer";
import { setVimMode, TextField, vimStatus } from "../TextField";
import { unsavedText } from "../unsaved";

function Page() {
  setVimMode(host.params.vim === "on");
  const note = unsavedText("checks:note", () => "Saved text");
  const saves = signal(0);
  const taken = signal(0);
  const typing = signal(false);
  const asking = signal(false);
  const name = signal("");
  const message = signal("");
  const attached = signal(1);
  const sent = signal(0);
  // A page's key, which a field with the focus never hears: the status line hints it outside one.
  registerKey({ hint: "j", hintLabel: "move", keys: "j", label: "Move", run: () => undefined });
  return (
    <View style={{ flex: 1, gap: 8, padding: 16 }}>
      <Text>{note.dirty() ? "Unsaved changes" : "All saved"}</Text>
      <Text>{`Saves: ${saves()}`}</Text>
      <Text>{`Mode: ${vimStatus().mode}`}</Text>
      <Text>{`Note: ${note.text()}`}</Text>
      <Text>{`Taken by Vim: ${taken()}`}</Text>
      <Text>{typing() ? "Typing in the note" : "Not typing"}</Text>
      <Text>{`Hints: ${keyHints()
        .map((hint) => hint.label)
        .join(", ")}`}</Text>
      <View onPress={() => taken.set(vimKeys().keys)} testID="count">
        <Text>Count</Text>
      </View>
      <TextField
        label="Note"
        onBlur={() => typing.set(false)}
        onChange={note.change}
        onFocus={() => typing.set(true)}
        onSave={() => saves.update((count) => count + 1)}
        testID="note"
        value={note.text()}
      />
      <Text>{`Sent: ${sent()}`}</Text>
      <View onPress={() => attached.set(0)} testID="detach">
        <Text>Detach</Text>
      </View>
      <Composer
        attached={attached()}
        label="Message"
        onChange={(value) => message.set(value)}
        onSend={() => sent.update((count) => count + 1)}
        value={message()}
      />
      <Text>{asking() ? "Dialog open" : "Dialog closed"}</Text>
      <View onPress={() => asking.set(true)} testID="ask">
        <Text>Ask</Text>
      </View>
      <Dialog onClose={() => asking.set(false)} open={asking()} title="Name it">
        <TextField
          first
          label="Name"
          lines="one"
          onChange={(value) => name.set(value)}
          testID="name"
          value={name()}
        />
      </Dialog>
    </View>
  );
}

void device.load().then(() =>
  mount(() => (
    <KeysHost>
      <KeyScope name="Checks">
        <Page />
      </KeyScope>
    </KeysHost>
  )),
);
