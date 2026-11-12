// The web form of `uraeda.extension`: an extension's page in a browser, where the Linux host's
// native view does not exist. It takes the view's props, gives its events, and takes its commands,
// so `ExtensionPlace` draws either the same way, and answers the page with the same rules
// (`pageChannel` in `host.tsx`): this file carries the channel, and decides nothing of what a page
// may read or do.
//
// - **The page** is fetched by the app, with the session's cookie, from `GET /extensions/{name}/page`,
//   and verified in the app's WebAssembly under the key `GET /extensions/key` gives, by the rule the
//   Linux view follows (`crates/app/src/page_trust.rs`): signed under that key, for its own
//   extension, and no older than a build already run.
// - **It runs** in Native Shell's player, in a frame of its own, `extension.html`, which the web
//   build writes beside the app's page (`app/web/frame.html`). On this machine, the app at
//   `127.0.0.1` or `localhost`, the frame is at the extension's own host, `<name>.localhost` on the
//   server's port: Chromium runs each site in a process of its own, so a page that never stops
//   holds its own thread alone, not the app's, nor another extension's. Elsewhere, behind a proxy's
//   host name, the frame is sandboxed without an origin: its process is apart from the app's, but
//   shared by every extension's frame. Either way the frame has no session's cookie and none of the
//   app's storage. A frame runs one page: a new version gets a new frame.
// - **The channel** is `postMessage` between the frame and the app's page. A message counts only
//   from the frame's origin, with the secret the app gave that frame, and of its current load; its
//   shape is checked, and its name is one the package grants. The frame takes the app's messages
//   from its parent at the app's origin alone.
// - **What broke** is told by `PageWatch` (`crates/app/src/page_watch.rs`), the Linux view's rules.
//   A browser cuts off no call: a page that never stops answers no ping, is named after 5 s, then
//   its frame is taken away, which ends it.
import { cleanup, effect, signal, untracked, View, WebView, type WebViewRef } from "nsh";
import { PageWatch, verifyPage } from "uraeda/native";
import type { PageMessage, PageProblem, ProblemKind } from "./host";
import type { Declarations, PageParams } from "./page";

/** What `ExtensionPlace` gives a page's view, the native one's props and events. */
export type PageViewProps = {
  server: string;
  token?: string;
  name: string;
  version?: number;
  params: PageParams;
  onReady?: (drawn: { declarations: Declarations; version: number }) => void;
  onProblem?: (problem: PageProblem) => void;
  onMessage?: (message: PageMessage) => void;
  ref?: (view: PageViewRef) => void;
  style?: { flex?: number };
};

/** The view's commands: `send`, `{ name, data }`, and `reply`, `{ id, value }` or `{ id, error }`. */
export type PageViewRef = { command(name: string, args: Record<string, unknown>): void };

/** A page fetched and verified, to run. */
type Verified = { source: string; capabilities: string; build: number };

/** Where a page's frame is, and the origin its messages come from. */
type Home = { src?: string; html?: string; origin: string };

/** How long a frame's player has to start, its runtime downloaded and compiled. */
const PLAYER_START = 20_000;

/** How often the watch ticks, as the Linux view's: `PING_MS` of `page_watch.rs`. */
const TICK = 500;

/** The messages the app answers for the page; the others are the watch's. */
const ANSWERED = new Set(["record", "call", "navigate"]);

/** The window of the app's page, which the frames post to: the app's own realm is a frame of it. */
type Posted = { data: unknown; origin: string };
type Top = {
  addEventListener(kind: "message", listener: (event: Posted) => void): void;
  removeEventListener(kind: "message", listener: (event: Posted) => void): void;
};
const top = (globalThis as unknown as { top: Top }).top;

/** A secret no other frame can guess. */
function secret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** The frame's page, fetched once, for frames sandboxed without an origin. */
let framePage: Promise<string> | undefined;

/** Where the page of `name` runs, for its load `load`, named by `named`. */
async function home(server: string, name: string, load: number, named: object): Promise<Home> {
  const app = new URL(server);
  const loopback = ["127.0.0.1", "localhost"].includes(app.hostname);
  const label = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(name);
  const said = JSON.stringify({ ...named, app: app.origin });
  if (loopback && label) {
    const origin = `http://${name}.localhost:${app.port}`;
    return { origin, src: `${origin}/extension.html?load=${load}#${encodeURIComponent(said)}` };
  }
  framePage ??= fetch(`${server}/extension.html`).then((answer) => {
    if (answer.ok) return answer.text();
    throw new Error(`/extension.html answered ${answer.status}`);
  });
  const page = await framePage;
  const first = `<script>window.uraedaFrame = ${said};</script>`;
  const html = page.replace("<head>", `<head>\n${first}<!-- ${name}, load ${load} -->`);
  return { html, origin: "null" };
}

/** The body of a signed-in `GET` of `path`, answered 200. */
async function got(server: string, path: string): Promise<Response> {
  const answer = await fetch(`${server}${path}`);
  if (answer.ok) return answer;
  throw new Error(`${path} answered ${answer.status}: ${(await answer.text()).trim()}`);
}

/** Fetches the page of `name`, and verifies it: the key first, then the page. */
/** A problem of a page not run yet, from what failed. */
function unrun(kind: ProblemKind, error: unknown): PageProblem {
  return { kind, message: error instanceof Error ? error.message : String(error), version: 0 };
}

async function fetched(server: string, name: string): Promise<Verified | PageProblem> {
  let key: string;
  let bytes: Uint8Array;
  try {
    key = await (await got(server, "/extensions/key")).text();
    const page = await got(server, `/extensions/${encodeURIComponent(name)}/page`);
    bytes = new Uint8Array(await page.arrayBuffer());
  } catch (error) {
    return unrun("unreachable", error);
  }
  try {
    return verifyPage(server, key, name, bytes);
  } catch (error) {
    return unrun("untrusted", error);
  }
}

/** A frame's message, once checked. */
export type FrameSaid =
  | { here: true }
  | { failed: string }
  | { post: string; data: unknown }
  | { call: string; id: number; data: unknown };

/** What a frame is: the origin its messages come from, its secret, and its page's load. */
export type FrameOf = { origin: string; secret: string; load: number };

/**
 * What a message posted to the app's page says, when it is the frame `of`'s: from its origin,
 * with its secret, of its load, and in a shape a frame sends. Anything else says nothing.
 */
export function frameSaid(posted: Posted, of: FrameOf): FrameSaid | undefined {
  if (posted.origin !== of.origin || typeof posted.data !== "string") return undefined;
  let message: unknown;
  try {
    message = JSON.parse(posted.data);
  } catch {
    return undefined;
  }
  if (typeof message !== "object" || message === null) return undefined;
  const said = message as Record<string, unknown>;
  if (said.secret !== of.secret) return undefined;
  if (said.here === true) return { here: true };
  // A player that failed before it ran a page names no load.
  if (typeof said.failed === "string" && (said.load === null || said.load === of.load)) {
    return { failed: said.failed };
  }
  if (said.load !== of.load) return undefined;
  if (typeof said.post === "string") return { data: said.data ?? null, post: said.post };
  if (typeof said.call === "string" && Number.isInteger(said.id) && (said.id as number) >= 0) {
    return { call: said.call, data: said.data ?? null, id: said.id as number };
  }
  return undefined;
}

/** The names a package grants its page, `{ "host": [...] }`: the channel's, as the server signs. */
function granted(capabilities: string): ReadonlySet<string> {
  try {
    const host = (JSON.parse(capabilities) as { host?: unknown }).host;
    return new Set(Array.isArray(host) ? host.filter((name) => typeof name === "string") : []);
  } catch {
    return new Set();
  }
}

/** A frame shown: what it is, the page it runs, and where. */
type Shown = { of: FrameOf; page: Verified; home: Home };

/** Now, on the browser's steady clock, which the watch reads its times on. */
const now = () => performance.now();

/** One page of an extension, in a frame of its own: the web's `uraeda.extension`. */
export function ExtensionFrame(props: PageViewProps) {
  const watch = new PageWatch();
  const shown = signal<Shown | undefined>(undefined);
  let frame: WebViewRef | undefined;
  let rights: ReadonlySet<string> = new Set();
  /** The page's calls the app answers: the app's number, to the load and the frame's number. */
  const calls = new Map<number, { load: number; id: number }>();
  let nextCall = 0;
  let load = 0;
  /** Events for the page before its frame runs it, sent once it does. */
  let early: Array<{ event: string; data: unknown }> = [];
  let ran = false;
  let live = true;
  let started: ReturnType<typeof setTimeout> | undefined;

  // Native Shell's `postMessage` reaches the frame shown, and takes no origin: not a window's.
  // oxlint-disable-next-line unicorn/require-post-message-target-origin
  const post = (message: unknown) => frame?.postMessage(JSON.stringify(message));
  const problem = (kind: ProblemKind, message: string) =>
    props.onProblem?.({ kind, message, version: shown()?.page.build ?? 0 });
  const send = (event: string, data: unknown) => {
    if (ran) post({ data, event });
    else early.push({ data, event });
  };
  /** Takes the frame away: its page stops with it, whatever it was doing. */
  const cut = () => {
    clearTimeout(started);
    shown.set(undefined);
    frame = undefined;
    ran = false;
  };

  const act = (said: ReturnType<PageWatch["tick"]>) => {
    if (said.show) send("show", null);
    if (said.ready != null) {
      const version = shown()?.page.build ?? 0;
      props.onReady?.({ declarations: said.ready as Declarations, version });
    }
    if (said.problemKind != null) {
      problem(said.problemKind as ProblemKind, said.problem ?? "");
      if (said.problemKind === "stopped") cut();
    }
    if (said.ping != null) send("ping", said.ping);
  };

  /** What the page asked, through its frame. */
  const asked = (page: Shown, name: string, data: unknown, id: number | undefined) => {
    if (!rights.has(name)) {
      const refused = { code: "ERR_ACCESS_DENIED", error: `${name} is not granted to the page` };
      if (id !== undefined) post({ reply: id, ...refused });
    } else if (ANSWERED.has(name)) {
      let numbered: number | null = null;
      if (id !== undefined) {
        numbered = nextCall++;
        calls.set(numbered, { id, load: page.of.load });
      }
      props.onMessage?.({ data, id: numbered, name });
    } else {
      act(watch.heard(name, data, now()));
      if (id !== undefined) post({ reply: id, value: null });
    }
  };

  const heard = (posted: Posted) => {
    const page = shown();
    const said = page && frameSaid(posted, page.of);
    if (!live || said === undefined || page === undefined) return;
    if ("here" in said) {
      clearTimeout(started);
      watch.loading(page.page.build, now());
      const { source, capabilities } = page.page;
      post({ run: { capabilities, load: page.of.load, params: props.params, source } });
      ran = true;
      for (const { event, data } of early.splice(0)) post({ data, event });
    } else if ("failed" in said) {
      problem("load", said.failed);
      cut();
    } else if ("post" in said) {
      asked(page, said.post, said.data, undefined);
    } else {
      asked(page, said.call, said.data, said.id);
    }
  };
  top.addEventListener("message", heard);

  props.ref?.({
    command(name, args) {
      if (name === "send" && typeof args.name === "string") send(args.name, args.data ?? null);
      if (name === "reply" && typeof args.id === "number") {
        const call = calls.get(args.id);
        calls.delete(args.id);
        if (call === undefined || call.load !== shown()?.of.load) return;
        if (typeof args.error === "string") post({ error: args.error, reply: call.id });
        else post({ reply: call.id, value: args.value ?? null });
      }
    },
  });

  // The page again, each time its version or what it is asked to draw changes, as the Linux view
  // loads it again: in a new frame, since a frame runs one page.
  let loaded = "";
  const loadAgain = async (name: string, version: number | undefined, params: PageParams) => {
    const key = JSON.stringify({ name, params, version });
    if (!live || key === loaded || props.server === "" || name === "") return;
    loaded = key;
    const page = await fetched(props.server, name);
    if (!live || loaded !== key) return;
    if ("kind" in page) {
      props.onProblem?.(page);
      return;
    }
    const of = { load: load + 1, origin: "", secret: secret() };
    let placed: Home;
    try {
      placed = await home(props.server, name, of.load, { secret: of.secret });
    } catch (error) {
      problem("unreachable", String(error));
      return;
    }
    if (!live || loaded !== key) return;
    cut();
    load = of.load;
    early = [];
    rights = granted(page.capabilities);
    shown.set({ home: placed, of: { ...of, origin: placed.origin }, page });
    const waited = `its frame's player did not start within ${PLAYER_START / 1000} s`;
    started = setTimeout(() => problem("stopped", waited), PLAYER_START);
  };
  effect(() => {
    const [name, version, params] = [props.name, props.version, props.params];
    untracked(() => void loadAgain(name, version, params));
  });
  const ticking = setInterval(() => {
    if (ran) act(watch.tick(now()));
  }, TICK);
  cleanup(() => {
    live = false;
    top.removeEventListener("message", heard);
    clearInterval(ticking);
    clearTimeout(started);
  });

  return (
    <View style={{ flex: props.style?.flex ?? 1 }}>
      <Each key={(page: Shown) => page.of.secret} of={shown() ? [shown() as Shown] : []}>
        {(page) => (
          <WebView
            baseUrl={page().home.html === undefined ? undefined : `${props.server}/`}
            html={page().home.html}
            javaScriptEnabled
            ref={(view: WebViewRef) => {
              frame = view;
            }}
            scrollable={false}
            src={page().home.src}
            style={{ flex: 1 }}
          />
        )}
      </Each>
    </View>
  );
}
