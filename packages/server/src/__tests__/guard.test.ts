import { expect, test } from "vite-plus/test";
import { port, testApp } from "./helpers.ts";

const cases: Array<[string, Record<string, string>, number, string?]> = [
  ["the server's address", { host: `127.0.0.1:${port}` }, 200],
  ["localhost", { host: `localhost:${port}` }, 200],
  ["another host", { host: `evil.com:${port}` }, 403, "Forbidden host"],
  ["a host without its port", { host: "127.0.0.1" }, 403, "Forbidden host"],
  ["the server's origin", { host: `localhost:${port}`, origin: `http://localhost:${port}` }, 200],
  ["an allowed origin", { host: `127.0.0.1:${port}`, origin: "http://localhost:5173" }, 200],
  [
    "another origin",
    { host: `127.0.0.1:${port}`, origin: "https://evil.com" },
    403,
    "Forbidden origin",
  ],
];

test.each(cases)("a request from %s", async (_, headers, status, body) => {
  const response = await testApp().request("/fate", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ operations: [], version: 1 }),
  });

  expect(response.status).toBe(status);
  if (body) {
    expect(await response.text()).toBe(body);
  }
});
