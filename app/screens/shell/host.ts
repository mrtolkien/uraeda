// What the shell asks of the machine it runs on: the server, and the device's token for it. On
// Linux the app's host, `uraeda` (`crates/app/src/host.rs`), answers over NSH's host channel: it
// finds or starts this machine's server, and keeps the token in the system's secret store. On a
// phone or a tablet there is no server to start: its owner names one, another machine's, once, and
// the device pairs with it and keeps its token (`deviceHost`). On a Mac the app's own native
// module finds or starts this machine's server, as the Linux host does, and keeps the token in the
// login keychain (`macHost`, `crates/app/src/local.rs`). Run without any, by `just app-dev`, a test,
// or a picture, the app works with a sandbox, which needs no sign-in.
import { type Accessor, host, platform, signal } from "nsh";
import { Application } from "nsh/desktop";
import { localForget, localPair, localServer, localStop, localToken } from "uraeda/native";
import { followed } from "../../sandbox/tracked";
import { device } from "../../store/device";
import { refusalOf } from "../../ui/controls";
import { ios } from "../../ui/native";

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
  /** On a device whose owner names its server: the server named, and how to name another. */
  remote?: Remote;
};

/** The server a device's owner named, kept on the device. */
export type Remote = {
  /** The address named, `undefined` until one is. */
  address(): string | undefined;
  /** Forgets the server and the device's token for it: the app asks for a server again. */
  leave(): Promise<void>;
  /** Names the server at `address`, once it answered as Uraeda's: it fails with why it did not. */
  name(address: string): Promise<void>;
};

/** The sandbox `just sandbox` starts, unless `URAEDA_SANDBOX` names another. */
const SANDBOX = "http://127.0.0.1:4420";

/** A call of the Linux host: a start waits for the server, a pairing for the secret store's prompt. */
const ask = <T>(name: string, data?: unknown) => host.call<T>(name, data ?? null, { timeout: 0 });

/** The sandbox a development run offers on a device, in place of a server to name. */
export const DEV_SANDBOX = SANDBOX;

/**
 * Leaves the server the device works with, for another: `undefined` where the app's host finds
 * the server itself. The shell's root sets it, and the settings' Sign-in page offers it.
 */
const leaving = signal<(() => void) | undefined>(undefined);
export const leaveServer: Accessor<(() => void) | undefined> = leaving;
export const setLeaveServer = (leave: (() => void) | undefined) => leaving.set(leave);

/**
 * An address as a person types or pastes it, as the app keeps it: with its scheme, `https` unless
 * it names this device or says otherwise, and no path. A pairing link, as `ura pair` prints and
 * draws it, `https://mac.example.net/pair#7KQ2M9XA0TBD`, gives its code too.
 */
export function addressOf(typed: string): { address: string; code?: string } | undefined {
  const trimmed = typed.trim();
  if (trimmed === "") return undefined;
  const local = /^(localhost|127\.|10\.|192\.168\.|\[::1\])/.test(trimmed);
  const whole = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `${local ? "http" : "https"}://${trimmed}`;
  const found = /^(https?:\/\/[^/\s?#]+)([^#\s]*)(?:#(\S+))?$/i.exec(whole);
  if (found === null) return undefined;
  const code = found[2]?.replace(/\/+$/, "") === "/pair" ? found[3] : undefined;
  return { address: found[1]!, ...(code === undefined || code === "" ? {} : { code }) };
}

/**
 * Whether the server at `address` signs nobody in, as a sandbox: its own session's check answers
 * so. It fails, in words, when nothing answers there, or something that is not Uraeda's server.
 */
async function signsNobodyIn(address: string): Promise<boolean> {
  let answer: Response;
  try {
    answer = await fetch(`${address}/session`);
  } catch {
    throw new Error(
      `Nothing answers at ${address}. Check the address, and that this device reaches it.`,
    );
  }
  if (answer.ok) return true;
  if (answer.status === 401) return false;
  throw new Error(`What answers at ${address} is not Uraeda's server: it said ${answer.status}.`);
}

/** What the device calls itself as it pairs, which its owner renames in the settings. */
const deviceName = () => (platform.idiom === "phone" ? "iPhone" : "iPad");

/** The server the device keeps, if its owner named one. */
const kept = () => device.get("server");

/** The server the device keeps: it throws before its owner named one. */
function named(): { address: string; open?: boolean; token?: string } {
  const now = kept();
  if (now === undefined) throw new Error("This device has no server yet.");
  return now;
}

/**
 * The host of a phone or a tablet: the server is the one its owner named, kept on the device with
 * the token it pairs for. The token is in the app's own storage, which iOS keeps to the app: the
 * settings' Sign-in page revokes it alone, on any of the server's devices.
 */
export function deviceHost(): ShellHost {
  return {
    forget: () => {
      const now = kept();
      if (now !== undefined) device.set("server", { address: now.address, open: now.open });
      return Promise.resolve();
    },
    pair: async (given) => {
      if (given === null) throw new Error("A device pairs with a code, or with the access key.");
      const { address } = named();
      let answer: Response;
      try {
        answer = await fetch(`${address}/pair`, {
          body: JSON.stringify({ ...given, name: deviceName() }),
          headers: { "content-type": "application/json" },
          method: "POST",
        });
      } catch {
        throw new Error(`${address} does not answer.`);
      }
      const body = (await answer.json().catch(() => ({}))) as { error?: string; token?: string };
      if (!answer.ok || typeof body.token !== "string") {
        throw new Error(body.error ?? `The server answered ${answer.status}.`);
      }
      device.set("server", { ...named(), token: body.token });
      return body.token;
    },
    remote: {
      address: () => kept()?.address,
      leave: () => {
        device.set("server", undefined);
        return Promise.resolve();
      },
      name: async (address) => {
        const open = await signsNobodyIn(address);
        device.set("server", { address, open });
      },
    },
    server: async () => {
      const now = named();
      // Asked again at each start, where it answers: a sandbox started with sign-in since then.
      const open = await signsNobodyIn(now.address).catch(() => now.open === true);
      if (open !== (now.open === true)) device.set("server", { ...now, open });
      return { address: now.address, local: false, open };
    },
    token: () => Promise.resolve(kept()?.token ?? null),
  };
}

/**
 * The Mac app's host: this Mac's server, found or started by the app's native module, which stops
 * the one it started as the app quits. The device pairs with it by itself, and its token is kept
 * in the login keychain.
 */
export function macHost(): ShellHost {
  Application.on("quit", () => localStop());
  return {
    forget: () => localForget(),
    pair: (given) =>
      localPair(
        given !== null && "code" in given ? given.code : null,
        given !== null && "key" in given ? given.key : null,
      ),
    server: async () => ({ address: await localServer(), local: true }),
    token: () => localToken(),
  };
}

/**
 * Whether the app is the Mac app a person opened: on macOS, neither a development run nor a test,
 * which work with a sandbox (`URAEDA_SANDBOX`).
 */
const macApp = () =>
  platform.os === "macos" && !followed && process.env.URAEDA_SANDBOX === undefined;

/** The host the app runs in: the Linux host's channel, a device's own, the Mac's, or the sandbox. */
export function appHost(): ShellHost {
  if (host.params.local === undefined) {
    if (ios) return deviceHost();
    if (macApp()) return macHost();
    return sandboxHost(process.env.URAEDA_SANDBOX ?? SANDBOX);
  }
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
  const message = refusalOf(error);
  return message.trim() === "" ? "It gave no reason." : message;
}
