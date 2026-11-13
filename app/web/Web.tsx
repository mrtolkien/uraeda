// The app in a browser, from its first frame: it asks the server that served the page whether
// the browser is signed in, shows the sign-in page when it is not, then the same shell as on a
// desktop, over the same connection, signed in by the session's cookie.
import { signal } from "nsh";
import { origin, signedIn, webHost } from "./host";
import { SignIn } from "./SignIn";
import { Root } from "../screens/shell/Root";
import { KeysHost } from "../ui/keys";
import { Backdrop } from "../ui/surfaces";

export function Web() {
  const address = origin();
  const state = signal<"asking" | "in" | "out">("asking");
  const why = signal<string | undefined>(undefined);

  // A server that does not answer is said by the sign-in page, under its field, at the first try.
  void signedIn(address).then(
    (yes) => state.set(yes ? "in" : "out"),
    () => state.set("out"),
  );
  const host = webHost(address, () => {
    why.set("This browser was signed out, or the server's access key changed.");
    state.set("out");
  });

  return (
    <>
      <If when={state() === "asking"}>
        <Backdrop />
      </If>
      <If when={state() === "out"}>
        <KeysHost place="/sign-in">
          <SignIn address={address} onSignedIn={() => state.set("in")} why={why()} />
        </KeysHost>
      </If>
      <If when={state() === "in"}>
        <Root host={host} />
      </If>
    </>
  );
}
