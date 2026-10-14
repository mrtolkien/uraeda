import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { act, cleanup, configure, fireEvent, render, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach } from "vite-plus/test";
import { fixture, fixtureRepo, git, temporaryFolder } from "uraeda-binding/test-utils";
import { createApp, Hosts } from "uraeda-server";
import { fakeSessions } from "uraeda-server/testing";
import { App } from "../App.tsx";
import { ServerFetch } from "../attach/ServerFetch.tsx";
import { fateClients } from "../clients.ts";
import { forgetUndoToasts } from "../layout/useUndoToast.ts";

/** The core's binding, as one object: the server takes it whole. */
const binding = await import("uraeda-binding");

export { fixture, fixtureRepo, git };

// Saves wait 400 ms for typing to stop, then go through git: slower machines, like CI's, need
// more than Testing Library's 1 s to see them.
configure({ asyncUtilTimeout: 5000 });

const port = 4310;
const origin = `http://127.0.0.1:${port}`;

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

afterEach(() => {
  // Turns left going keep their watchdog's timer.
  for (const sessions of managers.splice(0)) {
    sessions.close();
  }
});

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
 * can also build first with `fakeAgent`.
 */
export async function renderPage(
  path = "/",
  repo = fixtureRepo(),
  options: {
    agent?: boolean | Fake;
    dataDir?: string;
    fetch?: typeof globalThis.fetch;
    raw?: boolean;
    reload?: boolean;
  } = {},
) {
  const fake =
    typeof options.agent === "object"
      ? options.agent
      : await fakeAgent({ installed: options.agent === true });
  const fetch =
    options.fetch ??
    serverFetch(options.dataDir === undefined ? repo : null, fake.sessions, options.dataDir);
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
        <App clientFor={fateClients({ fetch, origin })} />
      </ServerFetch>,
    ),
  );
  return { ...rendered, agent: fake.adapter, name: current, repo, sessions: fake.sessions };
}

/** The hosts of the tests' apps, whose watches are closed after each test. */
const opened: Array<Promise<Hosts>> = [];

afterEach(async () => {
  for (const hosts of opened.splice(0)) {
    (await hosts).close();
  }
});

/** The name of each server's repository, as its list holds it. */
const names = new WeakMap<typeof globalThis.fetch, Promise<string | undefined>>();

/**
 * The server's app in process, as a `fetch`, on sessions whose agent is not installed by default,
 * with a list in a temporary data folder holding `repo`; or, given `dataDir`, the list already
 * there, which `repo` is added to unless it is null.
 */
export function serverFetch(
  repo: string | null,
  sessions?: Fake["sessions"],
  dataDir = temporaryFolder("uraeda-data"),
): typeof globalThis.fetch {
  if (!sessions) {
    sessions = fakeSessions({ installed: false }).sessions;
    managers.push(sessions);
  }
  const added =
    repo === null
      ? Promise.resolve(undefined)
      : binding.addRepository(dataDir, repo).then(({ repository }) => repository.name);
  const hosts = added.then(() => Hosts.open({ binding, dataDir, sessions }));
  opened.push(hosts);
  const created = hosts.then((hosts) =>
    createApp({
      allowedHosts: [],
      allowOrigins: [],
      binding,
      dataDir,
      hosts,
      port,
      sessions,
    }),
  );
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const app = await created;
    // The UI's plain requests, like uploads, name a path of the page's own server.
    const url = new URL(
      typeof input === "object" && "url" in input ? input.url : input.toString(),
      origin,
    ).href;
    sent.push(typeof init?.body === "string" ? init.body : url);
    // fate's requests are JSON; an upload's multipart body sets its own type, with its boundary.
    const response = await app.request(
      url,
      init?.body instanceof FormData
        ? { body: init.body, method: init.method }
        : {
            body: init?.body as string,
            headers: { "content-type": "application/json" },
            method: init?.method,
          },
    );
    const text = await response.text();
    answers.push(typeof init?.body === "string" ? init.body : url);
    return new Response(text, {
      headers: { "content-type": "application/json" },
      status: response.status,
    });
  };
  names.set(fetch, added);
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
 * updates do not reach these tests, so a run's later state is read this way. Each try waits a
 * moment inside its act, so the read's answer is most often drawn within it; a slower answer is
 * seen by a later try.
 */
export async function refreshUntil(check: () => void) {
  await waitFor(async () => {
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await new Promise((resolve) => setTimeout(resolve, 20));
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
