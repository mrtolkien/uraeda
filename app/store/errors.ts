// Why a call failed, or why a record has no value: the server's own code and words, or the
// client's two, `offline` and `dropped`. The message is for a person, and a screen shows it as it
// is, under the control it answers (`sent`, `app/ui/controls/sent.ts`).
import type { ErrorCode, Refusal } from "./protocol";

/** The server's codes, and the client's: no line to send on, or a line that dropped mid-call. */
export type StoreErrorCode = ErrorCode | "offline" | "dropped";

export class StoreError extends Error {
  readonly code: StoreErrorCode;

  constructor(code: StoreErrorCode, message: string) {
    super(message);
    this.name = "StoreError";
    this.code = code;
  }
}

/** A call made with no line to the server: it fails at once, and never waits for one. */
export function offline(): StoreError {
  return new StoreError(
    "offline",
    "The app is not connected to Uraeda's server: try again once it is back.",
  );
}

/** A call whose line dropped before its answer: it may have run, or not. */
export function dropped(): StoreError {
  return new StoreError(
    "dropped",
    "The connection dropped before the server answered: it may have been done. Check before trying again.",
  );
}

/** Which side to update, or that the device must sign in again, after a `refused`. */
export type Refused = {
  reason: Refusal;
  update: "app" | "server" | "sign-in";
  /** What to tell the person, in the contract's words. */
  words: string;
  /** The server's version of the protocol. */
  protocol: number;
};

export function refusedBy(reason: Refusal, protocol: number): Refused {
  switch (reason) {
    case "client-too-old":
      return { protocol, reason, update: "app", words: "Update this app: the server is newer." };
    case "server-too-old":
      return { protocol, reason, update: "server", words: "Update the server: this app is newer." };
    case "not-signed-in":
      return {
        protocol,
        reason,
        update: "sign-in",
        words: "Sign in, or pair this device again: the server no longer knows it.",
      };
  }
}
