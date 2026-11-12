// A browser's sign-in: Uraeda's access key, once. The server answers with a session's cookie,
// which the browser keeps until the session ends: signed out, a new key, or 30 days without use.
//
// The field takes the key as a person pastes it, spaces around it included. A refusal shows under
// it, in the server's words, and so does a server that does not answer.
import { signal, View } from "nsh";
import { signIn } from "./host";
import { Lone } from "../screens/shell/Lone";
import { Button } from "../ui/controls";
import { TextField } from "../ui/text";

export function SignIn(props: {
  /** The server's address. */
  address: string;
  onSignedIn: () => void;
  /** Why the browser signs in again: its session ended. */
  why?: string;
}) {
  const typed = signal("");
  const refusal = signal<string | null>(null);
  const pending = signal(false);

  const submit = async () => {
    const key = typed().trim();
    if (pending()) return;
    if (key === "") {
      refusal.set("Paste the access key: it starts with ura_.");
      return;
    }
    pending.set(true);
    refusal.set(null);
    try {
      await signIn(props.address, key);
      props.onSignedIn();
    } catch (error) {
      const words = error instanceof Error ? error.message : String(error);
      refusal.set(words.trim() === "" ? "The server did not answer." : words);
    }
    pending.set(false);
  };

  const intro =
    "Run “ura key” on the machine the server runs on: it shows the access key, once. A password manager fills it here.";

  return (
    <Lone
      icon="key-round"
      testID="sign-in"
      title="Sign in to Uraeda"
      words={props.why === undefined ? intro : `${props.why} ${intro}`}
    >
      <TextField
        autoFocus
        label="Access key"
        lines="one"
        onChange={(value) => {
          typed.set(value);
          refusal.set(null);
        }}
        onEnter={() => void submit()}
        placeholder="ura_…"
        refusal={refusal()}
        value={typed()}
      />
      <View style={{ alignItems: "flex-start" }}>
        <Button
          icon="key-round"
          label="Sign in"
          onPress={() => void submit()}
          pending={pending()}
          variant="main"
        />
      </View>
    </Lone>
  );
}
