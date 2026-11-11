// The page of the text field's tests: a note whose unsaved text the device keeps, and whether it
// has the focus. The host's `vim` turns Vim's keys on.
import { host, mount, signal, Text, View } from "nsh";
import { vimKeys } from "uraeda/native";
import { device } from "../../../store/device";
import { KeysHost } from "../../keys/KeysHost";
import { KeyScope } from "../../keys/registry";
import { setVimMode, TextField, vimStatus } from "../TextField";
import { unsavedText } from "../unsaved";

function Page() {
  setVimMode(host.params.vim === "on");
  const note = unsavedText("checks:note", () => "Saved text");
  const saves = signal(0);
  const taken = signal(0);
  const typing = signal(false);
  return (
    <View style={{ flex: 1, gap: 8, padding: 16 }}>
      <Text>{note.dirty() ? "Unsaved changes" : "All saved"}</Text>
      <Text>{`Saves: ${saves()}`}</Text>
      <Text>{`Mode: ${vimStatus().mode}`}</Text>
      <Text>{`Note: ${note.text()}`}</Text>
      <Text>{`Taken by Vim: ${taken()}`}</Text>
      <Text>{typing() ? "Typing in the note" : "Not typing"}</Text>
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
