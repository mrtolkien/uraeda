import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, cleanup, configure, fireEvent, render, waitFor } from "@testing-library/react";
import { createFateClient } from "react-fate/client";
import { afterEach, beforeEach } from "vite-plus/test";
import * as binding from "uraeda-binding";
import { fixture, fixtureRepo, git } from "uraeda-binding/test-utils";
import { createApp } from "uraeda-server";
import { fakeRunner } from "uraeda-server/testing";
import { App } from "../App.tsx";

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
  try {
    window.localStorage.clear();
  } catch {
    // No storage: nothing to clear.
  }
});

afterEach(cleanup);

/** The requests the UI sent, for the tests that count them. */
export const sent: Array<string> = [];

/** A runner on the fake agent, as `fakeRunner` gives it: `adapter` is the agent. */
export type Fake = ReturnType<typeof fakeRunner>;

const runners: Array<Fake["runner"]> = [];

afterEach(() => {
  // Runs left going keep their watchdog's timer.
  for (const runner of runners.splice(0)) {
    runner.close();
  }
});

/** A runner on the fake agent, checked, so the pages offer "Commit and continue". */
export async function fakeAgent({ installed = true } = {}): Promise<Fake> {
  const fake = fakeRunner({ installed });
  runners.push(fake.runner);
  if (installed) {
    await fake.runner.check();
  }
  return fake;
}

/**
 * Renders the UI at a path, on a repository, with its requests sent to the server in process.
 * Without `agent`, the agent is not installed, and the pages keep their single buttons; `true`
 * gives a new fake agent, which a test can also build first with `fakeAgent`.
 */
export async function renderPage(
  path = "/",
  repo = fixtureRepo(),
  options: { agent?: boolean | Fake; fetch?: typeof globalThis.fetch } = {},
) {
  const fake =
    typeof options.agent === "object"
      ? options.agent
      : await fakeAgent({ installed: options.agent === true });
  const fetch = options.fetch ?? serverFetch(repo, fake.runner);
  window.history.replaceState(null, "", path);
  const client = createFateClient({ url: `${origin}/fate`, fetch });
  // The page suspends while fate loads: an awaited act lets React render the data.
  const rendered = await act(async () => render(<App client={client} />));
  return { ...rendered, repo, agent: fake.adapter, runner: fake.runner };
}

function serverFetch(repo: string, runner: Fake["runner"]): typeof globalThis.fetch {
  const app = createApp({ repo, port, allowedHosts: [], allowOrigins: [], binding, runner });
  return async (input, init) => {
    const url = input instanceof Request ? input.url : input.toString();
    sent.push(typeof init?.body === "string" ? init.body : url);
    const response = await app.request(url, {
      method: init?.method,
      body: init?.body as string,
      headers: { "content-type": "application/json" },
    });
    return new Response(await response.text(), {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  };
}

/**
 * Reads the page again, as when it comes back to the foreground, until `check` passes: live
 * updates do not reach these tests, so a run's later state is read this way.
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

/** Types a value into a field, at once. */
export async function type(element: HTMLElement, value: string) {
  await act(async () => {
    fireEvent.change(element, { target: { value } });
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
