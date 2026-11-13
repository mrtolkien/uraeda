// Run by `nsh test`, without a display: the app's answers to an extension page (`host.tsx`). The
// page itself runs in `uraeda.extension`, a native component the headless runner does not draw:
// the plan's four tests of pages run on GTK, in `crates/app/tests/extensions.rs`.
import { expect, test } from "nsh/test";
import type { Route } from "../store/routes";
import { type ExtensionHost, pageChannel } from "./host";

/** A store that keeps what a page asked of it, and answers every action with `{ done: true }`. */
function keeping() {
  const asked: unknown[] = [];
  const host: ExtensionHost = {
    server: () => ({ address: "http://127.0.0.1:4320", token: undefined }),
    read(name, args, seen) {
      asked.push({ args, name });
      seen({ error: undefined, value: undefined });
      return () => asked.push({ stopped: name });
    },
    call(name, input) {
      asked.push({ input, name });
      return Promise.resolve({ output: { done: true } } as never);
    },
  };
  return { asked, host };
}

test("a page reads and acts as its own extension only, whatever it names", async () => {
  const { asked, host } = keeping();
  const replies: unknown[] = [];
  const line = {
    reply: (id: number, answer: unknown) => replies.push({ id, ...(answer as object) }),
    send() {},
  };
  const page = pageChannel(host, { extension: "wiki", repo: "notes" }, line);

  // A page that names another extension, or another repository, is still read as itself.
  page.heard({
    data: { extension: "deploy", id: 0, name: "pages", repo: "uraeda" },
    id: null,
    name: "record",
  });
  page.heard({
    data: { extension: "deploy", input: { title: "Home" }, name: "save", repo: "uraeda" },
    id: 7,
    name: "call",
  });
  await Promise.resolve();

  expect(asked).toEqual([
    { args: { extension: "wiki", name: "pages", repo: "notes" }, name: "ExtensionRecord" },
    {
      input: { extension: "wiki", input: { title: "Home" }, name: "save", repo: "notes" },
      name: "extensions.act",
    },
  ]);
  expect(replies).toEqual([{ id: 7, value: { done: true } }]);

  // What it reads stops as it closes.
  page.close();
  expect(asked.at(-1)).toEqual({ stopped: "ExtensionRecord" });
});

test("a page opens its repository's pages and its own places, never the settings or another repository", () => {
  const { host } = keeping();
  const opened: Array<Route> = [];
  const page = pageChannel(
    host,
    { extension: "wiki", repo: "notes" },
    { reply() {}, send() {} },
    (route) => opened.push(route),
  );
  const go = (to: unknown) => page.heard({ data: { to }, id: null, name: "navigate" });

  // The repository's own work, and the extension's own place, each in the page's repository.
  go("/inbox");
  go("/r/notes/f/2026-10-06-recurring-tasks/spec.md");
  go("/r/notes/e/wiki/wiki/Home");
  // Never: the settings, where devices are revoked and extensions turned on; another repository;
  // another extension's place; an address that is not one.
  go("/r/notes/settings/sign-in");
  go("/settings");
  go("/r/uraeda/inbox");
  go("/r/notes/e/deploy/runs");
  go(42);
  expect(opened).toEqual([
    { page: "inbox", repo: "notes" },
    { folder: "2026-10-06-recurring-tasks", name: "spec.md", page: "file", repo: "notes" },
    { name: "wiki", page: "extension", repo: "notes", rest: "wiki/Home" },
  ]);
});

test("a page's malformed message reads nothing and calls nothing", async () => {
  const { asked, host } = keeping();
  const replies: Array<{ error?: string; id: number }> = [];
  const page = pageChannel(
    host,
    { extension: "wiki", repo: "notes" },
    { reply: (id, answer) => replies.push({ id, ...(answer as object) }), send() {} },
  );
  // A record with no number of its own, or no name; a call that names no action.
  page.heard({ data: { id: "first", name: "pages" }, id: null, name: "record" });
  page.heard({ data: { id: 1, name: 7 }, id: null, name: "record" });
  page.heard({ data: { id: 2 }, id: null, name: "record" });
  page.heard({ data: { input: {}, name: { not: "a name" } }, id: 9, name: "call" });
  page.heard({ data: null, id: 10, name: "call" });
  await Promise.resolve();
  expect(asked).toEqual([]);
  // A call is answered, with why: its page waits for it.
  expect(replies.map((reply) => [reply.id, typeof reply.error])).toEqual([
    [9, "string"],
    [10, "string"],
  ]);
});
