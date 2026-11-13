// Naming this device's server: a phone or a tablet runs no server of its own, so its owner gives
// the address of the machine that does, once. Uraeda's server listens on its own machine alone:
// what a device reaches is the address a proxy or a tailnet gives it (`docs/app.md`, "Reaching it
// from another device").
//
// The field takes an address, with or without its scheme, or the whole pairing link `ura pair`
// prints, which names the server and pairs the device at once. A refusal shows under it: nothing
// answers there, or what answers is not Uraeda's server.
import { signal, View } from "nsh";
import { addressOf, DEV_SANDBOX, failureWords, type ShellHost } from "../shell/host";
import { Lone } from "../shell/Lone";
import { followed } from "../../sandbox/tracked";
import { Button } from "../../ui/controls";
import { TextField } from "../../ui/text";

export function Connect(props: {
  host: ShellHost;
  /** The server is named: the app goes on to it. `why`, when a link's code did not pair. */
  onNamed: (why?: string) => void;
}) {
  const typed = signal("");
  const refusal = signal<string | null>(null);
  const pending = signal(false);

  const name = async (address: string, code?: string) => {
    const remote = props.host.remote;
    if (remote === undefined || pending()) return;
    pending.set(true);
    refusal.set(null);
    try {
      await remote.name(address);
    } catch (error) {
      refusal.set(failureWords(error));
      pending.set(false);
      return;
    }
    // A pairing link pairs at once; a code the server refuses is asked for again, with its words.
    let why: string | undefined;
    if (code !== undefined) {
      try {
        await props.host.pair({ code: code.replace(/[^0-9a-z]/gi, "").toUpperCase() });
      } catch (error) {
        why = failureWords(error);
      }
    }
    pending.set(false);
    props.onNamed(why);
  };
  const submit = () => {
    const given = addressOf(typed());
    if (given === undefined) {
      refusal.set("Type the server's address, as https://mac.tail1234.ts.net.");
      return;
    }
    void name(given.address, given.code);
  };

  return (
    <Lone
      icon="server"
      testID="connect"
      title="Connect to your server"
      words="Uraeda runs on your computer, and this device works with it. Give the address this device reaches it at, or paste the link “ura pair” prints there, which pairs it too."
    >
      <TextField
        autoFocus
        hint="A tailnet's name, or your proxy's: the server itself listens on its own machine alone."
        label="Server address"
        lines="one"
        onChange={(value) => {
          typed.set(value);
          refusal.set(null);
        }}
        onEnter={submit}
        placeholder="https://mac.tail1234.ts.net"
        refusal={refusal()}
        value={typed()}
      />
      <View style={{ alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button icon="server" label="Connect" onPress={submit} pending={pending()} variant="main" />
        {/* A development run reaches the sandbox of the machine it runs from. */}
        <If when={followed}>
          <Button
            icon="flask-conical"
            label="Use this Mac's sandbox"
            onPress={() => void name(DEV_SANDBOX)}
          />
        </If>
      </View>
    </Lone>
  );
}
