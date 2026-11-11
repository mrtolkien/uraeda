// Pairing this device with a server: once, with the code `ura pair` prints on the server's machine,
// or with Uraeda's access key. The device then signs in with a token of its own, which the host
// keeps in the system's secret store, and which the owner can revoke. On the server's own machine
// the app pairs by itself; this page shows there only after a refusal, to pair again.
//
// The field takes what a person types: a code in small letters, with spaces or without its dashes,
// or the key, which starts with `ura_`. A refusal shows under it, in the server's words.
import { signal, View } from "nsh";
import { pairingOf } from "./given";
import { failureWords, type Server, type ShellHost } from "../shell/host";
import { Lone } from "../shell/Lone";
import { Button, Text } from "../../ui/controls";
import { TextField } from "../../ui/text";

export function Pairing(props: {
  host: ShellHost;
  onPaired: (token: string) => void;
  server: Server;
  /** Why the device pairs again: it was unpaired. */
  why?: string;
}) {
  const typed = signal("");
  const refusal = signal<string | null>(null);
  const pending = signal(false);

  const pair = async (given: Parameters<ShellHost["pair"]>[0]) => {
    if (pending()) return;
    pending.set(true);
    refusal.set(null);
    try {
      props.onPaired(await props.host.pair(given));
    } catch (error) {
      refusal.set(failureWords(error));
    }
    pending.set(false);
  };
  const submit = () => {
    const given = pairingOf(typed());
    if (given === undefined) {
      refusal.set("Type the code “ura pair” printed, as 7KQ2-M9XA-0TBD, or the access key.");
      return;
    }
    void pair(given);
  };

  const intro = () =>
    props.server.local
      ? "This app pairs by itself with the server of this machine."
      : `Pair this device with the server at ${props.server.address}, once. On that machine, “ura pair” prints a code that pairs one device within 10 minutes.`;

  return (
    <Lone
      icon="key-round"
      testID="pairing"
      title={props.server.local ? "Pair this app again" : "Pair this device"}
      words={props.why === undefined ? intro() : `${props.why} ${intro()}`}
    >
      <If
        when={!props.server.local}
        else={
          <View style={{ alignItems: "flex-start", gap: 8 }}>
            <Button
              icon="key-round"
              label="Pair this app"
              onPress={() => void pair(null)}
              pending={pending()}
              variant="main"
            />
            <If when={refusal()}>{(words) => <Text tone="danger">{words()}</Text>}</If>
          </View>
        }
      >
        <TextField
          autoFocus
          hint="The access key works too: it starts with ura_."
          label="Pairing code"
          lines="one"
          onChange={(value) => {
            typed.set(value);
            refusal.set(null);
          }}
          onEnter={submit}
          placeholder="7KQ2-M9XA-0TBD"
          refusal={refusal()}
          value={typed()}
        />
        <View style={{ alignItems: "flex-start" }}>
          <Button
            icon="key-round"
            label="Pair"
            onPress={submit}
            pending={pending()}
            variant="main"
          />
        </View>
      </If>
    </Lone>
  );
}
