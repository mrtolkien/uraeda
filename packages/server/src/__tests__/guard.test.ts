import { expect, test } from "vite-plus/test";
import { port, testApp } from "./helpers.ts";

// The host is the URL's: @hono/node-server builds it from the request's `Host` header.
const cases: Array<[string, string, Record<string, string>, number, string?]> = [
  ["the server's address", `127.0.0.1:${port}`, {}, 200],
  ["localhost", `localhost:${port}`, {}, 200],
  ["another host", `evil.com:${port}`, {}, 403, "Forbidden host"],
  ["a host without its port", "127.0.0.1", {}, 403, "Forbidden host"],
  ["the server's origin", `localhost:${port}`, { origin: `http://localhost:${port}` }, 200],
  ["an allowed origin", `127.0.0.1:${port}`, { origin: "http://localhost:5173" }, 200],
  ["another origin", `127.0.0.1:${port}`, { origin: "https://evil.com" }, 403, "Forbidden origin"],
];

test.each(cases)("a request to %s", async (_, host, headers, status, body) => {
  const response = await testApp().request(`http://${host}/fate`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ operations: [], version: 1 }),
  });

  expect(response.status).toBe(status);
  if (body) {
    expect(await response.text()).toBe(body);
  }
});
