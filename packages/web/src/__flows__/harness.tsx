// What the web flows share: the real app in happy-dom, on the real server in process, over one
// repository for the whole file. A flow file calls `startApp()` once, at its top: the repository and
// the server are made before its first test and closed after its last, and each test renders the
// page it needs against them. Tests of one file take their turn on the repository, so each uses
// the feature or the line of its own, or follows the one before it on purpose.
import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { act, cleanup, configure, fireEvent, render, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach } from "vite-plus/test";
import { fixtureRepo, git, temporaryFolder } from "uraeda-binding/test-utils";
import { createApp, Hosts, livePreviews, type Previews } from "uraeda-server";
import { fakeSessions, testSettings, testSignIn } from "uraeda-server/testing";
import { App } from "../App.tsx";
import { ServerFetch } from "../attach/ServerFetch.tsx";
import { fateClients } from "../clients.ts";
import { forgetUnsaved } from "../fields/unsaved.ts";
import { forgetUndoToasts } from "../layout/useUndoToast.ts";
import { forgetSignedOut } from "../sign-in/signedOut.ts";

export { fixtureRepo, git };

/** The core's binding, as one object: the server takes it whole. */
const binding = await import("uraeda-binding");

/** The binding the server runs on: the core's, or a fake spreading it. */
export type Binding = typeof binding;

// Saves wait 400 ms for typing to stop, then go through git: a loaded machine took seconds to show
// them. A wait's bound is no duration check; the test timeout still stops a hang.
configure({ asyncUtilTimeout: 10_000 });

const port = 4310;
const origin = `http://127.0.0.1:${port}`;

/**
 * happy-dom's `Response`, as a browser's, drops `Set-Cookie`, which no page reads. The server in
 * process makes its answers with it too, and a signed-in flow keeps the cookies it sets.
 */
const PageResponse = globalThis.Response;
globalThis.Response = class ServerResponse extends PageResponse {
  constructor(body?: BodyInit | null, init?: ResponseInit) {
    super(body, init);
    for (const line of new Headers(init?.headers).getSetCookie()) {
      this.headers.append("set-cookie", line);
    }
  }
} as typeof Response;

/** happy-dom has no EventSource: live views receive nothing, and a flow reads again to see more. */
class SilentEventSource {
  readyState = 0;
  url: string;
  constructor(url: string) {
    this.url = url;
  }
  addEventListener() {}
  removeEventListener() {}
  close() {}
}

/** Sessions on the fake agent, as `fakeSessions` gives them: `adapter` is the agent. */
export type Fake = ReturnType<typeof fakeSessions>;

/** The config folder of the server, and the host names of `--allowed-hosts`, when given. */
export type SettingsOptions = Parameters<typeof testSettings>[0];

/** What a flow file asks of its app. */
export type AppOptions = {
  /** The fake agent is installed and found: the pages offer to start it. */
  agent?: boolean;
  /** The server's binding, as one whose call fails. */
  binding?: Binding;
  /** Makes the repository; the fixture repository by default. */
  repo?: () => string;
  settings?: SettingsOptions;
  /** The server asks for the access key, as `signIn` of `createApp` does. */
  signIn?: boolean;
};

/** The requests the page sent and the server answered, for the flows that wait on one. */
const answers: Array<string> = [];
/** The requests started by the page, which refresh and teardown wait for. */
const pending = new Set<Promise<Response>>();

/** The app of a flow file, filled before its first test. */
export type Flow = {
  agent: Fake["adapter"];
  /** The cookies' `fetch` of another browser on the same server, with a signed-in jar. */
  device: (from?: typeof globalThis.fetch) => typeof globalThis.fetch;
  fetch: typeof globalThis.fetch;
  /** The access key, when the app signs in. */
  key: string;
  name: string;
  /** The page at a path of the repository, `/priorities` for one. */
  open: (path?: string, options?: OpenOptions) => Promise<ReturnType<typeof render>>;
  /** The address of a path of the repository's pages. */
  path: (path: string) => string;
  repo: string;
  sessions: Fake["sessions"];
};

/** What `open` takes beyond the path. */
export type OpenOptions = {
  /** Another `fetch`, as another browser's. */
  fetch?: typeof globalThis.fetch;
  /** Replaces the sign-in screen's reload. */
  onSignedIn?: () => void;
  /** Renders the path as given, like `/` or `/r/old-site/`. */
  raw?: boolean;
  /** A reload: the page goes, and its history entry, with its state, stays. */
  reload?: boolean;
};

/** The fake agent as installed or not. */
async function agentOf(installed: boolean): Promise<Fake> {
  const fake = fakeSessions({ installed });
  if (installed) {
    await fake.sessions.check();
  }
  return fake;
}

/**
 * Makes the repository, the server over it, and the fake agent for this file's tests, and closes
 * them after the last. Returns the handle the tests read, which is filled by the first test.
 */
export function startApp(options: AppOptions = {}): Flow {
  const flow = {} as Flow;
  const closers: Array<() => Promise<void> | void> = [];
  beforeAll(async () => {
    const repo = options.repo ? options.repo() : fixtureRepo();
    const dataDir = temporaryFolder("uraeda-data");
    const fake = await agentOf(options.agent === true);
    const signIn = options.signIn ? testSignIn(dataDir) : undefined;
    const { repository } = await binding.addRepository(dataDir, repo);
    const hosts = await Hosts.open({
      binding: options.binding ?? binding,
      dataDir,
      sessions: fake.sessions,
    });
    const previews: Previews = livePreviews();
    const settings = await testSettings(options.settings);
    const created = createApp({
      allowOrigins: [],
      binding: options.binding ?? binding,
      dataDir,
      hosts,
      port,
      previews,
      sessions: fake.sessions,
      settings,
      signIn: signIn?.options,
    });
    closers.push(
      () => hosts.close(),
      () => settings.close(),
      () => fake.sessions.close(),
      () => previews.stopAll(),
    );
    const device = (from?: typeof globalThis.fetch) =>
      fetchOn(created, new Map(from && jars.get(from)));
    Object.assign(flow, {
      agent: fake.adapter,
      device,
      fetch: options.signIn ? device() : fetchOn(created),
      key: signIn?.key ?? "",
      name: repository.name,
      path: (path: string) => `/r/${encodeURIComponent(repository.name)}${path}`,
      repo,
      sessions: fake.sessions,
    });
    flow.open = (path = "/", opened = {}) => openPage(flow, path, opened);
  }, 60_000);
  beforeEach(() => {
    (globalThis as { EventSource?: unknown }).EventSource = SilentEventSource;
    answers.length = 0;
    forgetUndoToasts();
    try {
      window.localStorage.clear();
    } catch {
      // No storage: nothing to clear.
    }
    forgetUnsaved();
    forgetSignedOut();
    atWidth(1024);
  });
  // The page goes, which may send its last saves; the server answers every request it was sent
  // while its repository is still there.
  afterEach(async () => {
    cleanup();
    await settleRequests();
  });
  afterAll(async () => {
    for (const close of closers.splice(0)) {
      await close();
    }
  }, 60_000);
  return flow;
}

/** Renders the app at a path, its requests sent to the server of the file. */
async function openPage(flow: Flow, path: string, options: OpenOptions) {
  const fetch = options.fetch ?? flow.fetch;
  if (options.reload) {
    cleanup();
  } else {
    window.history.replaceState(null, "", options.raw ? path : flow.path(path));
  }
  // The page suspends while fate loads: an awaited act lets React render the data.
  return act(async () =>
    render(
      <ServerFetch fetch={fetch}>
        <App clientFor={fateClients({ fetch, origin })} onSignedIn={options.onSignedIn} />
      </ServerFetch>,
    ),
  );
}

/** Gives the window a width, as a phone's (402) or a desktop's: happy-dom starts at 1024, wide. */
export function atWidth(width: number) {
  (
    window as unknown as { happyDOM: { setViewport(size: { width: number }): void } }
  ).happyDOM.setViewport({ width });
}

/** The phone's width and a desktop's, which the layout adapts to. */
export const PHONE = 402;
export const DESKTOP = 1440;

/** Waits until the server answered every request, those sent while it answered the others too. */
async function settleRequests() {
  do {
    // A request the page queued as it went is sent at the next turn of the event loop.
    await new Promise((resolve) => setImmediate(resolve));
    await Promise.allSettled(pending);
  } while (pending.size > 0);
}

/** Waits until the page sent no request the server has not answered, and drew the answers. */
export async function quiet() {
  await act(settleRequests);
}

/** A browser's cookies, by name: those the server's answers set, and did not clear since. */
type Jar = Map<string, string>;
const jars = new WeakMap<typeof globalThis.fetch, Jar>();

/** Keeps the cookies an answer sets in the jar, and forgets those it clears. */
function keep(jar: Jar, response: Response) {
  for (const line of response.headers.getSetCookie()) {
    const [pair, ...attributes] = line.split(";");
    const [name, value] = pair.split("=");
    const cleared = value === "" || attributes.some((part) => /^\s*max-age=0$/i.test(part));
    if (cleared) {
      jar.delete(name.trim());
    } else {
      jar.set(name.trim(), value);
    }
  }
}

/** The requests the app answers while `gate` holds those whose body names `held`. */
let gate: { held: string; open: Promise<void>; seen: number } | undefined;

/**
 * Holds every request whose body names `held`, a write for one, until `release`: what the page
 * shows while a write runs is what it shows until then. `seen` says how many it was sent.
 */
export function holding(held: string) {
  const opened = Promise.withResolvers<void>();
  const hold = { held, open: opened.promise, seen: 0 };
  gate = hold;
  afterEachRelease(() => {
    opened.resolve();
    if (gate === hold) {
      gate = undefined;
    }
  });
  return {
    release() {
      opened.resolve();
      if (gate === hold) {
        gate = undefined;
      }
    },
    seen: () => hold.seen,
  };
}

/** A release to run once the test ends, so a test that fails never leaves a request held. */
function afterEachRelease(release: () => void) {
  releases.push(release);
}
const releases: Array<() => void> = [];
afterEach(() => {
  for (const release of releases.splice(0)) {
    release();
  }
});

/** A `fetch` calling the app in process, its answers recorded; with a jar, a browser's cookies. */
function fetchOn(created: ReturnType<typeof createApp>, jar?: Jar): typeof globalThis.fetch {
  const send: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(
      typeof input === "object" && "url" in input ? input.url : input.toString(),
      origin,
    ).href;
    const body = typeof init?.body === "string" ? init.body : url;
    if (gate && body.includes(gate.held)) {
      gate.seen += 1;
      await gate.open;
    }
    // fate's requests are JSON; an upload's multipart body sets its own type, with its boundary.
    const request = new Request(
      url,
      init?.body !== undefined && init.body !== null && typeof init.body !== "string"
        ? { body: init.body, method: init.method }
        : {
            body: init?.body as string,
            headers: { "content-type": "application/json" },
            method: init?.method,
          },
    );
    // Set once made: happy-dom's `Request`, as a browser's, drops a `Cookie` header it is given.
    if (jar && jar.size > 0) {
      request.headers.set("cookie", [...jar].map(([name, value]) => `${name}=${value}`).join("; "));
    }
    const response = await created.request(request);
    if (jar) {
      keep(jar, response);
    }
    const text = await response.text();
    answers.push(body);
    return new Response(response.status === 204 ? null : text, {
      headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
      status: response.status,
    });
  };
  const fetch: typeof globalThis.fetch = (input, init) => {
    const response = send(input, init);
    pending.add(response);
    void response.then(
      () => pending.delete(response),
      () => pending.delete(response),
    );
    return response;
  };
  if (jar) {
    jars.set(fetch, jar);
  }
  return fetch;
}

/**
 * Reads the page again, as when it comes back to the foreground, until `check` passes: live
 * updates do not reach these flows, so a later state is read this way.
 */
export async function refreshUntil(check: () => void) {
  await waitFor(async () => {
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await new Promise((resolve) => setTimeout(resolve, 20));
      await settleRequests();
    });
    check();
  });
}

/** Taps an element, and lets React draw what follows. */
export async function click(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

/** Types a value into a field, at once: a form field, or an editable text like the composer's. */
export async function type(element: HTMLElement, value: string) {
  await act(async () => {
    if (element.getAttribute("contenteditable") === "true") {
      element.textContent = value;
      fireEvent.input(element);
    } else {
      fireEvent.change(element, { target: { value } });
    }
  });
}

/** A file of the repository, `PRIORITIES.md` by default. */
export function read(repo: string, path = "specs/PRIORITIES.md") {
  return readFileSync(join(repo, path), "utf8");
}

/** The last commit's subject in the repository's checkout. */
export function lastCommit(repo: string) {
  return git(repo, "log", "-1", "--format=%s").trim();
}

/** The repository's name in the server's list: the folder's own name. */
export function nameOf(repo: string) {
  return basename(repo);
}
