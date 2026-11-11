// What `controls.test.tsx` opens: a switch whose server refuses every change after half a
// second, and a dialog, opened by a key, holding a select, a disabled button, and one that counts.
// The page says what each holds, as a screen would.
import { mount, signal, Text, View } from "nsh";
import { KeysHost } from "../../keys/KeysHost";
import { KeyScope, registerKey } from "../../keys/registry";
import { Dialog } from "../../surfaces";
import { Button, Select, sent, Switch } from "..";

const MODELS = [
  { label: "Codex", value: "codex" },
  { label: "Claude", value: "claude" },
] as const;

function Page() {
  const stored = signal(false);
  const night = sent(
    stored,
    () =>
      new Promise((_, refuse) =>
        setTimeout(() => refuse(new Error("Night is set by the system theme here.")), 500),
      ),
  );
  const isOpen = signal(false);
  const model = signal<"codex" | "claude">("codex");
  const kept = signal(0);
  registerKey({ keys: "mod+o", label: "Ask", run: () => isOpen.set(true) });
  return (
    <View style={{ flex: 1, gap: 8, padding: 16 }}>
      <Switch label="Night" onChange={night.set} refusal={night.refusal()} value={night.value()} />
      <Text>Night: {night.value() ? "on" : "off"}</Text>
      <Text>Model: {model()}</Text>
      <Text>Kept: {String(kept())}</Text>
      <Dialog onClose={() => isOpen.set(false)} open={isOpen()} title="Settings">
        <Select
          first
          label="Model"
          onChange={(next) => model.set(next)}
          options={MODELS}
          testID="model"
          value={model()}
        />
        <Button disabled label="Archive" onPress={() => kept.update((n) => n - 100)} />
        <Button label="Keep" onPress={() => kept.update((n) => n + 1)} />
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
