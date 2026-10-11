import { act, cleanup, render } from "@testing-library/react";
import { createFateClient } from "react-fate/client";
import { afterEach, beforeEach } from "vite-plus/test";
import * as binding from "uraeda-binding";
import { fixture, fixtureRepo, git } from "uraeda-binding/test-utils";
import { createApp } from "uraeda-server";
import { App } from "../App.tsx";

export { fixture, fixtureRepo, git };

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
  const app = createApp({ repo, port, allowedHosts: [], allowOrigins: [], binding });
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
