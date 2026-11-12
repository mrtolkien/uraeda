// The whole app over the sandbox, as `setup.test.tsx` walks it: `Walk.tsx`'s page. With `host.params.signed`, it is another machine's app before the sandbox with sign-in on
// (`URAEDA_SANDBOX_SIGN_IN`), never paired: the pairing page sends what is typed to the server's
// `POST /pair`, whose refusals it shows; `pair-with-key` pairs it with the access key, which the
// test cannot read on GTK, and opens the app again, signed in with its own token.
import { ErrorBoundary, host, mount, Text } from "nsh";
import { boot } from "../../screens/shell/boot";
import { appHost, type ShellHost } from "../../screens/shell/host";
import { Root } from "../../screens/shell/Root";
import { navigate, parseRoute } from "../../store";

host.on("go", (address) => navigate(parseRoute(String(address))));

const signed = process.env.URAEDA_SANDBOX_SIGN_IN ?? "";
let token: string | null = null;

/** Pairs this device with the sandbox with sign-in: the server's words when it refuses. */
async function paired(given: unknown): Promise<string> {
  const answer = await fetch(`${signed}/pair`, {
    body: JSON.stringify({ ...(given as object), name: "The walk's laptop" }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (!answer.ok) throw new Error(((await answer.json()) as { error?: string }).error);
  return ((await answer.json()) as { token: string }).token;
}

const signedHost: ShellHost = {
  forget: () => {
    token = null;
    return Promise.resolve();
  },
  pair: async (given) => (token = await paired(given)),
  server: () => Promise.resolve({ address: signed, local: false }),
  token: () => Promise.resolve(token),
};

let unmount = () => {};
const start = () => {
  unmount();
  const shell = host.params.signed === true ? signedHost : appHost();
  unmount = mount(() => (
    <ErrorBoundary fallback={(error) => <Text>{`problem: ${String(error)}`}</Text>}>
      <Root host={shell} />
    </ErrorBoundary>
  ));
};
host.on("pair-with-key", async () => {
  token = await paired({ key: process.env.URAEDA_SANDBOX_KEY ?? "" });
  start();
});

void boot().then(start);
