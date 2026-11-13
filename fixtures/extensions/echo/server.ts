// A record that counts, an action that adds to it, one that answers late, and a route.
import type { ServerApi } from "uraeda/server";
import { shout } from "./lib/shout";

/** What the record `counter` holds. */
type Counter = { count: number; greeting: unknown; repository: string; version: number };

export default function activate(api: ServerApi) {
  let count = 0;
  const counter = api.record("counter", (repository): Counter => {
    const { greeting } = api.settings(repository);
    return { count, greeting, repository, version: 1 };
  });
  api.action("add", (input: { by: number }, repository) => {
    count += input.by;
    counter.changed(repository);
    return { count, shouted: shout(`added ${input.by}`) };
  });
  api.action(
    "later",
    (input: { ms: number }) =>
      new Promise((resolve) => {
        setTimeout(() => resolve("late"), input.ms);
      }),
  );
  api.action("refuse", () => {
    throw new Error("not today");
  });
  api.route(
    "/x/echo/hello",
    (request, repository) =>
      Response.json({
        method: request.method,
        name: request.query.name ?? null,
        repository,
      }),
    "GET",
  );
  // What reached it: its path and every header, answered with headers of its own.
  api.route(
    "/x/echo/headers",
    (request) =>
      Response.json(
        { headers: Object.fromEntries(request.headers.entries()), path: request.path },
        {
          headers: {
            "clear-site-data": '"cookies"',
            "set-cookie": "uraeda=taken; Path=/",
            "x-echo": "kept",
          },
        },
      ),
    "GET",
  );
}
