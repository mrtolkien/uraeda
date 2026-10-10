import { temporaryReadSpecs } from "uraeda-binding";
import { fixture } from "uraeda-binding/test-utils";
import { createApp } from "../app.ts";

export { fixture };

export const port = 4310;

/** The server's app, called in process, on a fixtures folder. */
export function testApp(specs = fixture("specs")) {
  return createApp({
    specs,
    port,
    allowOrigins: ["http://localhost:5173"],
    readSpecs: temporaryReadSpecs,
  });
}

/** Sends one native fate operation listing the spec folders. */
export async function listSpecFolders(app: ReturnType<typeof testApp>) {
  const response = await app.request("/fate", {
    method: "POST",
    headers: { "content-type": "application/json", host: `127.0.0.1:${port}` },
    body: JSON.stringify({
      operations: [{ id: "1", kind: "list", name: "specFolders", select: ["id", "name", "files"] }],
      version: 1,
    }),
  });
  const body = (await response.json()) as {
    results: Array<{ data: { items: Array<{ node: Record<string, unknown> }> } }>;
  };
  return body.results[0].data.items.map((item) => item.node);
}
