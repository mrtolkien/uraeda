// The protocol between Uraeda's server and its clients, as a client reads it.
// Written by `vp run protocol:types` from `crates/protocol/`: never by hand.

/** The protocol's version, which a client's `hello` gives. */
export type Protocol = 1;

/**
 * What a client sends.
 *
 * A `sub`, a `call`, and a `resume` carry an `id` the client picks, unique among the
 * subscriptions and the calls it has open on the connection: every answer names it.
 */
export type ClientMessage = { "type": "hello", protocol: number, signIn: SignIn, } | { "type": "sub", id: number, record: string, args: JsonValue, } | { "type": "unsub", id: number, } | { "type": "call", id: number, action: string, input: JsonValue, } | { "type": "resume", id: number, record: string, args: JsonValue, epoch: string, seq: number, };

/**
 * A paired device.
 */
export type Device = { 
/**
 * What names the device: the part of its token before the dot, which is no secret.
 */
id: string, 
/**
 * The name it gave as it paired, or the owner gave it since.
 */
name: string, 
/**
 * When it paired, in RFC 3339, as `2026-11-10T09:00:00Z`.
 */
created: string, 
/**
 * The day it last signed in, in RFC 3339: a use is recorded once a day at most.
 */
used: string, };

/**
 * The devices paired with the server, each signing in with a token of its own.
 */
export type Devices = { 
/**
 * The oldest pairing first.
 */
devices: Array<Device>, };

/**
 * Renames a device.
 */
export type DevicesRename = { 
/**
 * The device's `id`.
 */
id: string, 
/**
 * Its new name: the blanks around it go, and it holds a letter at least.
 */
name: string, };

/**
 * Revokes a device: its token signs in nowhere any more, and its open connections close.
 */
export type DevicesRevoke = { 
/**
 * The device's `id`.
 */
id: string, };

/**
 * What an `error` is about.
 */
export type ErrorCode = "not-signed-in" | "bad-message" | "unknown-record" | "unknown-action" | "bad-args" | "bad-input" | "refused" | "conflict" | "hook" | "internal";

export type JsonValue = number | string | boolean | Array<JsonValue> | { [key in string]: JsonValue } | null;

/**
 * One operation of a change.
 *
 * A list takes `insert`, `remove`, and `move` only when each of its items is a record with an
 * `id`, a text no other item of the list has: any other list changes whole, by `set`.
 */
export type Op = { "op": "set", path: Array<string>, value: JsonValue, } | { "op": "append", path: Array<string>, text: string, } | { "op": "insert", path: Array<string>, value: JsonValue, before?: string | null, } | { "op": "remove", path: Array<string>, } | { "op": "move", path: Array<string>, before?: string | null, };

/**
 * A checkout's preview. Subscribing to it starts its command, which stops 30 minutes after its
 * last read.
 */
export type Preview = { state: PreviewState, 
/**
 * Once ready, the path it is served under, `/r/<name>/preview/<secret>/<folder>/`, with the
 * frame secret: on the server's address, it is the preview's own first page.
 */
base: string | null, 
/**
 * When failed, why, as one sentence.
 */
error: string | null, };

/**
 * Which checkout's preview: a repository of the list, and a feature's or a change's folder, or
 * `main` for the main checkout.
 */
export type PreviewArgs = { 
/**
 * The repository's name in the list, the `<name>` of `/r/<name>/`.
 */
repository: string, 
/**
 * A feature's or a change's folder, or `main`.
 */
folder: string, };

/**
 * Stops a checkout's preview command, if it runs, and starts it again: the way out of a failed
 * preview. It answers the preview as it is then, starting.
 */
export type PreviewRestart = { 
/**
 * The repository's name in the list.
 */
repository: string, 
/**
 * A feature's or a change's folder, or `main`.
 */
folder: string, };

/**
 * Where a checkout's preview is.
 */
export type PreviewState = "none" | "starting" | "ready" | "failed";

/**
 * Why a server turns a `hello` down.
 */
export type Refusal = "client-too-old" | "server-too-old" | "not-signed-in";

/**
 * What a server sends.
 */
export type ServerMessage = { "type": "welcome", protocol: number, epoch: string, } | { "type": "refused", reason: Refusal, protocol: number, } | { "type": "data", id: number, seq: number, value: JsonValue, } | { "type": "change", id: number, seq: number, ops: Array<Op>, } | { "type": "result", id: number, output: JsonValue, } | { "type": "error", id?: number | null, code: ErrorCode, message: string, };

/**
 * How a client signs in.
 */
export type SignIn = { "by": "cookie" } | { "by": "token", "token": string };

/**
 * A story of a checkout's preview. Subscribing to it starts the preview.
 */
export type Story = { state: StoryState, 
/**
 * Once ready, the path of the story alone, to show in a web view:
 * `/r/<name>/preview/<secret>/<folder>/iframe.html?id=<id>&viewMode=story`.
 */
frame: string | null, 
/**
 * Once ready, the app's route to the story in the whole preview:
 * `/f/<folder>/storybook?path=/story/<id>`, or `/storybook?path=..` for `main`.
 */
storybook: string | null, 
/**
 * When failed, why, as one sentence.
 */
error: string | null, };

/**
 * Which story: a repository of the list, and the story's link in a checkout.
 */
export type StoryArgs = { 
/**
 * The repository's name in the list.
 */
repository: string, 
/**
 * `<folder>:<path>#<export>`: a feature's folder or `main`, the stories file from the
 * repository's top level, and the export's name.
 */
id: string, };

/**
 * The story an agent's link names, by the core's rule: both fields are null for any other link.
 */
export type StoryHref = { 
/**
 * The stories file, from the repository's top level.
 */
path: string | null, 
/**
 * The export's name.
 */
export: string | null, };

/**
 * Which link: its address as an agent wrote it.
 */
export type StoryHrefArgs = { href: string, };

/**
 * Where a story is.
 */
export type StoryState = "none" | "starting" | "ready" | "missing" | "failed";

/** Every record, by the name a `sub` gives: its arguments, and its whole value. */
export type Records = {
  Devices: { args: null; value: Devices };
  Preview: { args: PreviewArgs; value: Preview };
  Story: { args: StoryArgs; value: Story };
  StoryHref: { args: StoryHrefArgs; value: StoryHref };
};

/** Every action, by the name a `call` gives: its input, and its output. */
export type Actions = {
  "devices.rename": { input: DevicesRename; output: null };
  "devices.revoke": { input: DevicesRevoke; output: null };
  "preview.restart": { input: PreviewRestart; output: Preview };
};
