import { expect, test } from "vite-plus/test";
import { port, testApp } from "./helpers.ts";

const tailnet = "mac.tail1234.ts.net";

// The host is the URL's: @hono/node-server builds it from the request's `Host` header.
const cases: Array<[string, string, Record<string, string>, number, string?]> = [
  ["the server's address", `127.0.0.1:${port}`, {}, 200],
  ["localhost", `localhost:${port}`, {}, 200],
  ["another host", `evil.com:${port}`, {}, 403, "Forbidden host"],
  ["a host without its port", "127.0.0.1", {}, 403, "Forbidden host"],
  ["the server's origin", `localhost:${port}`, { origin: `http://localhost:${port}` }, 200],
  ["an allowed origin", `127.0.0.1:${port}`, { origin: "http://localhost:5173" }, 200],
  ["another origin", `127.0.0.1:${port}`, { origin: "https://evil.com" }, 403, "Forbidden origin"],
  // US6.1 and US6.2
  ["an allowed host, from its own origin", tailnet, { origin: `https://${tailnet}` }, 200],
  ["an allowed host, with the port", `${tailnet}:${port}`, {}, 200],
  ["a host not listed", "evil.example", {}, 403, "Forbidden host"],
  ["an origin not listed", tailnet, { origin: "https://evil.example" }, 403, "Forbidden origin"],
  // A browser's cross-site POST without an Origin header, as some requests are sent.
  [
    "another site, without an origin",
    `127.0.0.1:${port}`,
    { "sec-fetch-site": "cross-site" },
    403,
    "Forbidden site",
  ],
  [
    "a sibling site, without an origin",
    `127.0.0.1:${port}`,
    { "sec-fetch-site": "same-site" },
    403,
  ],
  [
    "its own page, without an origin",
    `127.0.0.1:${port}`,
    { "sec-fetch-site": "same-origin" },
    200,
  ],
  ["a typed address, without an origin", `127.0.0.1:${port}`, { "sec-fetch-site": "none" }, 200],
  [
    "an allowed origin, from another site",
    `127.0.0.1:${port}`,
    { origin: "http://localhost:5173", "sec-fetch-site": "same-site" },
    200,
  ],
];

test.each(cases)("a request to %s", async (_, host, headers, status, body) => {
  const { app } = await testApp(undefined, { allowedHosts: [tailnet] });
  const response = await app.request(`http://${host}/fate`, {
    body: JSON.stringify({ operations: [], version: 1 }),
    headers: { "content-type": "application/json", ...headers },
    method: "POST",
  });

  expect(response.status).toBe(status);
  if (body) {
    expect(await response.text()).toBe(body);
  }
});
