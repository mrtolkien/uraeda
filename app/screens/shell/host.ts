// What the shell asks of the machine it runs on: the server, and the device's token for it. On
// Linux the app's host, `uraeda` (`crates/app/src/host.rs`), answers over NSH's host channel: it
// finds or starts this machine's server, and keeps the token in the system's secret store. Run
// without it, by `just app-dev` or a test's picture, the app works with a sandbox, which needs no
// sign-in.
import { host } from "nsh";

/** A server that answers. */
export type Server = {
  /** Where it listens: `http://127.0.0.1:4310`. */
  address: string;
  /** It is this machine's: the host starts it again when it stops, and pairs by itself. */
  local: boolean;
  /** It signs nobody in, as a sandbox: the app connects with no token. */
  open?: boolean;
};

/** What a person gives to pair: the code `ura pair` printed, or the access key. */
export type Given = { code: string } | { key: string };

export type ShellHost = {
  /** The server, once it answers: this machine's is started when none runs. */
  server(): Promise<Server>;
  /** The device's token for it, or `null` when it was never paired. */
  token(): Promise<string | null>;
  /** Pairs the device, with what a person gave, or by itself with `null` on this machine. */
  pair(given: Given | null): Promise<string>;
  /** Forgets the token, which the server no longer knows. */
  forget(): Promise<void>;
};

/** The sandbox `just sandbox` starts, unless `URAEDA_SANDBOX` names another. */
const SANDBOX = "http://127.0.0.1:4420";

/** A call of the Linux host: a start waits for the server, a pairing for the secret store's prompt. */
const ask = <T>(name: string, data?: unknown) => host.call<T>(name, data ?? null, { timeout: 0 });

/** The host the app runs in: the Linux host's channel, or the sandbox without one. */
export function appHost(): ShellHost {
  if (host.params.local === undefined) return sandboxHost(process.env.URAEDA_SANDBOX ?? SANDBOX);
  return {
    forget: () => ask<null>("uraeda.forget").then(() => undefined),
    pair: (given) => ask<string>("uraeda.pair", given ?? {}),
    server: () => ask<Server>("uraeda.server"),
    token: () => ask<string | null>("uraeda.token"),
  };
}

/** A sandbox at `address`: it signs nobody in, and keeps no token. */
export function sandboxHost(address: string): ShellHost {
  return {
    forget: () => Promise.resolve(),
    pair: () => Promise.resolve(""),
    server: () => Promise.resolve({ address, local: false, open: true }),
    token: () => Promise.resolve(null),
  };
}

/** The words of a failure, as the host or the server gave them. */
export function failureWords(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.trim() === "" ? "It gave no reason." : message;
}
