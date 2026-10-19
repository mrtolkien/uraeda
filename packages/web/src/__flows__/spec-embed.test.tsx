// Flow: the story embedded in the spec page, the web UI's half of the stack decision's preview rule:
// a preview is sandboxed apart from Uraeda's origin, so a story's frame can run its scripts and
// never act as the app. The server's half, the proxy, is in the server's flows.
import { get } from "node:http";
import { cleanup, screen, waitFor } from "@testing-library/react";
import { addStoryFeature, STORY_FEATURE } from "uraeda-binding/test-utils";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { fixtureRepo, startApp } from "./harness.tsx";

const app = startApp({
  repo: () => {
    const repo = fixtureRepo();
    addStoryFeature(repo);
    return repo;
  },
});

/**
 * A `fetch` over Node's http for the server in process, which reads the Storybook's index at
 * 127.0.0.1: happy-dom's own `fetch` refuses a read of another origin, as the page's would.
 */
function nodeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return new Promise((resolve, reject) => {
    const request = get(String(input), (response) => {
      const chunks: Array<Buffer> = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () =>
        resolve(new Response(Buffer.concat(chunks), { status: response.statusCode })),
      );
    });
    request.on("error", reject);
    init?.signal?.addEventListener("abort", () => request.destroy(new Error("aborted")));
  });
}

const pageFetch = globalThis.fetch;
beforeAll(() => {
  globalThis.fetch = nodeFetch;
});
afterAll(() => {
  globalThis.fetch = pageFetch;
});

test("a story's live frame is sandboxed: it runs scripts and is never the app's own origin", async () => {
  // The server starts the feature's Storybook when the page asks; the page shows the frame once
  // it runs, which a page opened again reads.
  await waitFor(async () => {
    cleanup();
    await app.open(`/f/${STORY_FEATURE}/spec.md`);
    await screen.findAllByRole("figure");
    expect(document.querySelectorAll("figure iframe").length).toBeGreaterThan(0);
  });

  for (const frame of document.querySelectorAll("figure iframe")) {
    const sandbox = frame.getAttribute("sandbox") ?? "";
    expect(sandbox).toContain("allow-scripts");
    expect(sandbox).not.toContain("allow-same-origin");
  }
});

test("the feature's whole Storybook page is sandboxed the same way", async () => {
  await waitFor(async () => {
    cleanup();
    await app.open(`/f/${STORY_FEATURE}/storybook`);
    await screen.findByRole("main");
    expect(document.querySelectorAll("iframe").length).toBeGreaterThan(0);
  });

  for (const frame of document.querySelectorAll("iframe")) {
    const sandbox = frame.getAttribute("sandbox") ?? "";
    expect(sandbox).toContain("allow-scripts");
    expect(sandbox).not.toContain("allow-same-origin");
  }
});
