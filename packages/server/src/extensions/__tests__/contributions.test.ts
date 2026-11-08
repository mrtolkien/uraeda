// An extension's record, action, or route that never answers holds none of Uraeda's requests: each
// is given 10 s, on fake timers, then answers with an error, a refusal, or a 504.
import { Hono } from "hono";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { Contributions } from "../contributions.ts";

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** A promise that never settles. */
const never = () => new Promise<never>(() => {});

/** Settles `promise` once 10 s passed on the fake clock, and only then. */
async function after10s<T>(promise: Promise<T>): Promise<T> {
  let settled = false;
  void promise.finally(() => (settled = true)).catch(() => {});
  await vi.advanceTimersByTimeAsync(9999);
  expect(settled).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  return promise;
}

test("a record that never answers reads as its error after 10 s", async () => {
  const contributions = new Contributions();
  contributions.addRecord("wiki", "pages", never);

  expect(await after10s(contributions.read("wiki/pages", "uraeda"))).toEqual({
    error: "wiki: no answer in 10 s",
    id: "wiki/pages",
    value: "null",
  });
  expect(process.stderr.write).toHaveBeenCalledWith("uraeda: wiki: no answer in 10 s\n");
});

test("an action that never answers is refused after 10 s", async () => {
  const contributions = new Contributions();
  contributions.addAction("wiki", "publish", never);

  const acting = contributions.act("wiki", "publish", "{}", "uraeda");
  const refused = expect(acting).rejects.toThrow("refused: wiki: no answer in 10 s");
  await after10s(acting.catch(() => {}));
  await refused;
});

test("a route that never answers answers 504 after 10 s", async () => {
  const contributions = new Contributions();
  contributions.addRoute("wiki", { handler: never, path: "/x/wiki/slow" });
  const app = new Hono();
  app.all("/x/wiki/*", async (c) => (await contributions.answer(c, "wiki", c.req.path, null))!);

  const response = await after10s(Promise.resolve(app.request("/x/wiki/slow")));
  expect(response.status).toBe(504);
  expect(await response.text()).toBe("wiki: no answer in 10 s");
});
