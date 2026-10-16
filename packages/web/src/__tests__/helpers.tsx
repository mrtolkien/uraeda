import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { act, cleanup, configure, fireEvent, render, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach } from "vite-plus/test";
import { fixture, fixtureRepo, git, temporaryFolder } from "uraeda-binding/test-utils";
import { createApp, Hosts, livePreviews, type Previews } from "uraeda-server";
import { fakeSessions, testSettings, testSignIn } from "uraeda-server/testing";
import { App } from "../App.tsx";
import { ServerFetch } from "../attach/ServerFetch.tsx";
import { fateClients } from "../clients.ts";
import { forgetUnsaved } from "../fields/unsaved.ts";
import { forgetUndoToasts } from "../layout/useUndoToast.ts";
import { forgetSignedOut } from "../sign-in/signedOut.ts";

/** The core's binding, as one object: the server takes it whole. */
const binding = await import("uraeda-binding");

/** The binding the server runs on: the core's, or a fake spreading it. */
export type Binding = typeof binding;

export { fixture, fixtureRepo, git };

// Saves wait 400 ms for typing to stop, then go through git: a loaded CI runner took over 5 s to
// show them. A wait's bound is no duration check, and 10 s fails no loaded machine (R9, R14 of
// the testing review); the 20 s test timeout still stops a hang.
configure({ asyncUtilTimeout: 10_000 });

const port = 4310;
const origin = `http://127.0.0.1:${port}`;

/**
 * happy-dom's `Response`, as a browser's, drops `Set-Cookie`, which no page reads. The server in
 * process makes its answers with it too, and the tests' browsers keep the cookies they set.
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

/**
 * happy-dom has no EventSource: live views subscribe, and receive nothing, in these tests. The
 * server's own tests check live updates.
 */
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

beforeEach(() => {
  (globalThis as { EventSource?: unknown }).EventSource = SilentEventSource;
  // A test that failed leaves nothing for the next: its requests, or an Undo's error on screen.
  sent.length = 0;
  answers.length = 0;
  forgetUndoToasts();
  try {
    window.localStorage.clear();
  } catch {
    // No storage: nothing to clear.
  }
  // The unsaved text of the last test, in memory, goes with its storage.
  forgetUnsaved();
  // A page signed out in the last test loads signed in again.
  forgetSignedOut();
});

afterEach(cleanup);
afterEach(() => atWidth(1024));

/** Sets the day the core takes as today for a file's tests, and puts the machine's back after. */
export function today(date: string) {
  const before = process.env.URA_TODAY;
  beforeAll(() => {
    process.env.URA_TODAY = date;
  });
  afterAll(() => {
    if (before === undefined) {
      delete process.env.URA_TODAY;
    } else {
      process.env.URA_TODAY = before;
    }
  });
}

/** Gives the window a width, as a phone's (402) or a desktop's: happy-dom starts at 1024, wide. */
export function atWidth(width: number) {
  (
    window as unknown as { happyDOM: { setViewport(size: { width: number }): void } }
  ).happyDOM.setViewport({ width });
}

/** The requests the UI sent, for the tests that count them. */
export const sent: Array<string> = [];

/** The requests the server answered, by their body. */
const answers: Array<string> = [];

/** How many answers the server sent so far: `answered` can wait for one after them. */
export function answersSoFar() {
  return answers.length;
}

/**
 * Waits until the server answered a read of a type, `Agent` for one, after the `from` first
 * answers, and the page drew it: a part of a page that waits on its own read shows nothing until
 * then, so a test that checks something does not show waits for it first.
 */
export async function answered(type: string, from = 0) {
  await waitFor(() => {
    if (!answers.slice(from).some((body) => body.includes(`"type":"${type}"`))) {
      throw new Error(`No read of ${type} answered yet`);
    }
  });
  // React draws what the answer resumes in a task of its own: the act lasts until the next task.
  await act(() => new Promise((resolve) => setTimeout(resolve)));
}

/** Sessions on the fake agent, as `fakeSessions` gives them: `adapter` is the agent. */
export type Fake = ReturnType<typeof fakeSessions>;

const managers: Array<Fake["sessions"]> = [];

/** Sessions on the fake agent, checked, so the pages offer "Commit and start the agent". */
export async function fakeAgent({ installed = true } = {}): Promise<Fake> {
  const fake = fakeSessions({ installed });
  managers.push(fake.sessions);
  if (installed) {
    await fake.sessions.check();
  }
  return fake;
}

/** The name of the repository the last page rendered was on, in the list of its server. */
let current = "";

/** A path of the UI, `/priorities` for one, in the repository the last page rendered was on. */
export function atRepo(path: string): string {
  return `/r/${encodeURIComponent(current)}${path}`;
}

/**
 * Renders the UI at a path of a repository, `/priorities` for one, prefixed with the repository's
 * `/r/<name>`, with its requests sent to the server in process, whose list holds the repository.
 * `raw` renders the path as given, like `/` or `/r/old-site/`; `dataDir` gives the server the list
 * already in that data folder, the repository left out of it. Without `agent`, the agent is not
 * installed, and the pages keep their single buttons; `true` gives a new fake agent, which a test
 * can also build first with `fakeAgent`. `binding` gives the server a binding of its own, as one
 * whose call fails. `onSignedIn` replaces the sign-in screen's reload. `settings` gives the server's
 settings their config folder, a new empty one by default, and the host names of `--allowed-hosts`.
 */
export async function renderPage(
  path = "/",
  repo = fixtureRepo(),
  options: {
    agent?: boolean | Fake;
    binding?: Binding;
    dataDir?: string;
    fetch?: typeof globalThis.fetch;
    onSignedIn?: () => void;
    raw?: boolean;
    reload?: boolean;
    settings?: SettingsOptions;
  } = {},
) {
  const fake =
    typeof options.agent === "object"
      ? options.agent
      : await fakeAgent({ installed: options.agent === true });
  const fetch =
    options.fetch ??
    serverFetch(
      options.dataDir === undefined ? repo : null,
      fake.sessions,
      options.dataDir,
      options.binding,
      options.settings,
    );
  current = (await names.get(fetch)) ?? basename(repo);
  if (options.reload) {
    // A reload: the page goes, and its history entry, with its state, stays.
    cleanup();
  } else {
    window.history.replaceState(null, "", options.raw ? path : atRepo(path));
  }
  // The page suspends while fate loads: an awaited act lets React render the data.
  const rendered = await act(async () =>
    render(
      <ServerFetch fetch={fetch}>
        <App clientFor={fateClients({ fetch, origin })} onSignedIn={options.onSignedIn} />
      </ServerFetch>,
    ),
  );
  return { ...rendered, agent: fake.adapter, name: current, repo, sessions: fake.sessions };
}

/** The config folder of a test's server, and the host names of `--allowed-hosts`, when given. */
type SettingsOptions = Parameters<typeof testSettings>[0];

/** The hosts of the tests' apps, whose watches are closed after each test. */
const opened: Array<Promise<Hosts>> = [];
/** The Storybook runners of the tests' apps, stopped after each test. */
const runners: Array<Previews> = [];
/** The settings of the tests' apps, whose watches are closed after each test. */
const settled: Array<ReturnType<typeof testSettings>> = [];

/**
 * After each test, in order: the page goes, which may send its last saves; the server answers every
 * request it was sent, while its repository is still there; then its hosts' watches and the turns'
 * timers stop. A request left going would read the repository the file's end deletes, or a closed
 * host, and fail with no page left to show it.
 */
afterEach(async () => {
  cleanup();
  await settleRequests();
  for (const hosts of opened.splice(0)) {
    (await hosts).close();
  }
  for (const settings of settled.splice(0)) {
    (await settings).close();
  }
  // Turns left going keep their watchdog's timer.
  for (const sessions of managers.splice(0)) {
    sessions.close();
  }
  await Promise.all(runners.splice(0).map((runner) => runner.stopAll()));
});

/** The name of each server's repository, as its list holds it. */
const names = new WeakMap<typeof globalThis.fetch, Promise<string | undefined>>();

/** The requests started by the page, which refresh and teardown wait for. */
const pending = new Set<Promise<Response>>();

/** Waits until the server answered every request, those sent while it answered the others too. */
async function settleRequests() {
  do {
    // A request the page queued as it went is sent at the next turn of the event loop.
    await new Promise((resolve) => setImmediate(resolve));
    await Promise.allSettled(pending);
  } while (pending.size > 0);
}

/**
 * Waits until the page sent no request the server has not answered, and drew the answers: what the
 * page shows then is all it will show until something changes.
 */
export async function quiet() {
  await act(settleRequests);
}

/**
 * The server's app in process, as a `fetch`, on sessions whose agent is not installed by default,
 * with a list in a temporary data folder holding `repo`; or, given `dataDir`, the list already
 * there, which `repo` is added to unless it is null; on the core's binding, or `server`'s; on the
 * settings of `settings`, as `testSettings` takes them.
 */
export function serverFetch(
  repo: string | null,
  sessions?: Fake["sessions"],
  dataDir = temporaryFolder("uraeda-data"),
  server: Binding = binding,
  settings?: SettingsOptions,
): typeof globalThis.fetch {
  const { added, created } = serverApp(repo, sessions, dataDir, server, undefined, settings);
  return fetchOn(created, added);
}

/**
 * The server's fetch, holding every request whose body names `held` until `release`; `count` says
 * how many it was sent.
 */
export async function holding(repo: string, held: string) {
  const fake = await fakeAgent();
  const through = serverFetch(repo, fake.sessions);
  const gate = Promise.withResolvers<void>();
  let count = 0;
  const fetch: typeof globalThis.fetch = async (input, init) => {
    if (String(init?.body).includes(held)) {
      count++;
      await gate.promise;
    }
    return through(input, init);
  };
  return { count: () => count, fake, fetch, release: () => gate.resolve() };
}

/**
 * The server's app in process with sign-in, on a list holding `repo`, as `serverFetch` gives it:
 * `fetch`, a browser without a session, which keeps the cookies the server's answers set and sends
 * them back; the access key; and `device`, which gives another browser's `fetch` on the same server,
 * or another tab's of the browser `from`, its cookies as they are now.
 */
export function signInServer(repo = fixtureRepo()) {
  const dataDir = temporaryFolder("uraeda-data");
  const { key, options } = testSignIn(dataDir);
  const { added, created } = serverApp(repo, undefined, dataDir, binding, options);
  const device = (from?: typeof globalThis.fetch) =>
    fetchOn(created, added, new Map(from && jars.get(from)));
  return { device, fetch: device(), key };
}

/** The app of `serverFetch`, made once its list holds `repo`, and the repository's name there. */
function serverApp(
  repo: string | null,
  sessions: Fake["sessions"] | undefined,
  dataDir: string,
  server: Binding,
  signIn?: ReturnType<typeof testSignIn>["options"],
  settingsOptions?: SettingsOptions,
) {
  if (!sessions) {
    sessions = fakeSessions({ installed: false }).sessions;
    managers.push(sessions);
  }
  const added =
    repo === null
      ? Promise.resolve(undefined)
      : binding.addRepository(dataDir, repo).then(({ repository }) => repository.name);
  const hosts = added.then(() => Hosts.open({ binding: server, dataDir, sessions }));
  opened.push(hosts);
  const previews = livePreviews();
  runners.push(previews);
  // On a config folder of its own, empty unless given: no host name besides the server's own.
  const settings = testSettings(settingsOptions);
  settled.push(settings);
  const created = Promise.all([hosts, settings]).then(([hosts, settings]) =>
    createApp({
      allowOrigins: [],
      binding: server,
      dataDir,
      hosts,
      port,
      previews,
      sessions,
      settings,
      signIn,
    }),
  );
  return { added, created };
}

/** A browser's cookies, by name: those the server's answers set, and did not clear since. */
type Jar = Map<string, string>;

/** The cookies of each browser's `fetch`. */
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

/**
 * A `fetch` calling the app in process, its requests and answers recorded; with a jar, a browser's
 * cookies kept and sent back.
 */
function fetchOn(
  created: Promise<ReturnType<typeof createApp>>,
  added: Promise<string | undefined>,
  jar?: Jar,
): typeof globalThis.fetch {
  const send: typeof globalThis.fetch = async (input, init) => {
    const app = await created;
    // The UI's plain requests, like uploads, name a path of the page's own server.
    const url = new URL(
      typeof input === "object" && "url" in input ? input.url : input.toString(),
      origin,
    ).href;
    sent.push(typeof init?.body === "string" ? init.body : url);
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
    const response = await app.request(request);
    if (jar) {
      keep(jar, response);
    }
    const text = await response.text();
    answers.push(typeof init?.body === "string" ? init.body : url);
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
  names.set(fetch, added);
  if (jar) {
    jars.set(fetch, jar);
  }
  return fetch;
}

/**
 * Writes a list of repositories in a new data folder, as by hand, each opened a minute before the
 * one above it, all long ago, so a repository the tests open moves first, and returns the folder.
 */
export function listOf(repositories: Array<[name: string, path: string]>): string {
  const dataDir = temporaryFolder("uraeda-data");
  writeFileSync(
    join(dataDir, "repositories.json"),
    JSON.stringify({
      repositories: repositories.map(([name, path], index) => ({
        name,
        openedAt: `2000-01-01T10:${String(59 - index).padStart(2, "0")}:00Z`,
        path,
      })),
      version: 1,
    }),
  );
  return dataDir;
}

/**
 * A new home folder for each of the file's tests, as the server reads it, `HOME`, to write paths
 * under it with `~`: the folder of the current test, and the machine's put back after each.
 */
export function temporaryHome(): () => string {
  const before = process.env.HOME;
  let home = "";
  beforeEach(() => {
    home = temporaryFolder("uraeda-home");
    process.env.HOME = home;
  });
  afterEach(() => {
    process.env.HOME = before;
  });
  return () => home;
}

/** A copy of the fixture repository at a path, its parent folders made. */
export function repoAt(path: string): string {
  mkdirSync(dirname(path), { recursive: true });
  renameSync(fixtureRepo(), path);
  return path;
}

/**
 * Reads the page again, as when it comes back to the foreground, until `check` passes: live
 * updates do not reach these tests, so a run's later state is read this way. Each try lets the
 * requests start, then waits for their answers inside its act before checking the page.
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

/** A valid record of a finished feature. */
export function record(title: string) {
  return `---\nkind: feature\nfinished: 2026-10-11\n---\n\n# Record: ${title}\n\n> [!NOTE]\n>\n> The record of a merged feature, not instructions to follow.\n\n## What and why\n\nA thing.\n\n## Behaviour\n\n- It works.\n\n## Design\n\nA design.\n`;
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

/** Commits a mockup in a feature's `mockups/` folder, on the feature's branch. */
export function addMockup(
  repo: string,
  folder: string,
  name: string,
  html = "<!doctype html>\n<title>Mockup</title>\n<p>A mockup.</p>\n",
) {
  git(repo, "switch", "--quiet", folder);
  mkdirSync(join(repo, "specs", folder, "mockups"), { recursive: true });
  writeFileSync(join(repo, "specs", folder, "mockups", name), html);
  git(repo, "add", "--all");
  git(repo, "commit", "--quiet", "--no-verify", "--message", `docs: mockup ${name}`);
  git(repo, "switch", "--quiet", "main");
}
