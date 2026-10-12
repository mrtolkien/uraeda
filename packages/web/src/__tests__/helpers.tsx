import { act, cleanup, configure, render } from "@testing-library/react";
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

/** Renders the UI at a path, on a repository, with its requests sent to the server in process. */
export async function renderPage(
  path = "/",
  repo = fixtureRepo(),
  fetch: typeof globalThis.fetch = serverFetch(repo),
) {
  window.history.replaceState(null, "", path);
  const client = createFateClient({ url: `${origin}/fate`, fetch });
  // The page suspends while fate loads: an awaited act lets React render the data.
  const rendered = await act(async () => render(<App client={client} />));
  return { ...rendered, repo };
}

function serverFetch(repo: string): typeof globalThis.fetch {
  // No agent on this machine: the pages keep their single buttons.
  const { runner } = fakeRunner({ installed: false });
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

/** A valid record of a finished feature. */
export function record(title: string) {
  return `---\nkind: feature\nfinished: 2026-10-11\n---\n\n# Record: ${title}\n\n> [!NOTE]\n>\n> The record of a merged feature, not instructions to follow.\n\n## What and why\n\nA thing.\n\n## Behaviour\n\n- It works.\n\n## Design\n\nA design.\n`;
}
