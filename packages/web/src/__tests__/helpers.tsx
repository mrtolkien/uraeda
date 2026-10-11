import { act, cleanup, render } from "@testing-library/react";
import { createFateClient } from "react-fate/client";
import { afterEach } from "vite-plus/test";
import { dirname } from "node:path";
import * as binding from "uraeda-binding";
import { fixture } from "uraeda-binding/test-utils";
import { createApp } from "uraeda-server";
import { App } from "../App.tsx";

export { fixture };

const port = 4310;

afterEach(cleanup);

/** Renders the UI on a fixtures folder, with its requests sent to the server's app in process. */
export async function renderPage(
  specs = fixture("specs"),
  fetch: typeof globalThis.fetch = serverFetch(specs),
) {
  const client = createFateClient({ url: `http://127.0.0.1:${port}/fate`, fetch });
  // The page suspends while fate loads: an awaited act lets React render the data.
  return await act(async () => render(<App client={client} />));
}

function serverFetch(specs: string): typeof globalThis.fetch {
  const app = createApp({
    repo: dirname(specs),
    port,
    allowedHosts: [],
    allowOrigins: [],
    binding,
  });
  return async (input, init) => {
    const response = await app.request(input instanceof Request ? input.url : input.toString(), {
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
