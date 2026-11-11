// Run by `nsh test`, without a display: the app's answers to an extension page (`host.tsx`). The
// page itself runs in `uraeda.extension`, a native component the headless runner does not draw:
// the plan's four tests of pages run on GTK, in `crates/app/tests/extensions.rs`.
import { expect, test } from "nsh/test";
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
