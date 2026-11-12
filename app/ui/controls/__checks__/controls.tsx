// What `controls.test.tsx` opens: a switch whose server refuses every change after half a
// second, a dialog, opened by a key, holding a select, a disabled button, and one that counts,
// and two confirmations, opened by their keys: `d` discards, which loses something, and `r` runs,
// which spends.
// The page says what each holds, as a screen would.
import { mount, signal, Text, View } from "nsh";
import { KeysHost } from "../../keys/KeysHost";
import { KeyScope, registerKey } from "../../keys/registry";
import { Dialog } from "../../surfaces";
import { Button, Confirm, Select, sent, Switch } from "..";

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
  const discarded = signal(0);
  const ran = signal(0);
  const asking = signal<"discard" | "run" | null>(null);
  registerKey({ keys: "mod+o", label: "Ask", run: () => isOpen.set(true) });
  registerKey({ keys: "d", label: "Discard…", run: () => asking.set("discard") });
  registerKey({ keys: "r", label: "Run…", run: () => asking.set("run") });
  return (
    <View style={{ flex: 1, gap: 8, padding: 16 }}>
      <Switch label="Night" onChange={night.set} refusal={night.refusal()} value={night.value()} />
      <Text>Night: {night.value() ? "on" : "off"}</Text>
      <Text>Model: {model()}</Text>
      <Text>Kept: {String(kept())}</Text>
      <Text>Discarded: {String(discarded())}</Text>
      <Text>Ran: {String(ran())}</Text>
      <Confirm
        keep="Keep them"
        keys="d"
        label="Discard the changes"
        loses
        onClose={() => asking.set(null)}
        onConfirm={() => discarded.update((n) => n + 1)}
        open={asking() === "discard"}
        title="Discard the changes to README.md?"
        words="The file goes back to its last commit. Nothing can bring the changes back."
      />
      <Confirm
        keys="r"
        label="Run it now"
        onClose={() => asking.set(null)}
        onConfirm={() => ran.update((n) => n + 1)}
        open={asking() === "run"}
        title="Run “Weekly report” now?"
        words="It starts a session with the job's prompt: that spends its agent's time and usage."
      />
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
