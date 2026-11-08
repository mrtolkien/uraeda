// The registry's order and its rule over keys: Uraeda's places before yours, and a key kept by the
// first extension that claims it.
import { expect, test } from "vite-plus/test";
import { pageApi } from "./pageApi.ts";
import { createRegistry } from "./registry.ts";

const Nothing = () => null;
const place = (id: string, title: string) => ({
  component: Nothing,
  icon: "uraeda:list",
  id,
  title,
});
const all = () => true;
const run = () => {};

// Break: yours sorted before Uraeda's, or Uraeda's by name.
test("places keep the built-ins' order, then yours by name", () => {
  const registry = createRegistry();
  pageApi("wiki", registry, { title: "Wiki" }).place(place("wiki", "Wiki"));
  pageApi("deploy", registry, { title: "Deploy" }).place(place("deploy", "Deploy"));
  pageApi("priorities", registry, { order: 2, title: "Priorities" }).place(
    place("priorities", "Priorities"),
  );
  pageApi("inbox", registry, { order: 1, title: "Inbox" }).place(place("inbox", "Inbox"));

  expect(registry.list("place", all).map((one) => one.id)).toEqual([
    "inbox",
    "priorities",
    "deploy",
    "wiki",
  ]);
  // Yours open under /e/<name>/, the built-ins where they gave.
  expect(registry.list("place", all).at(-1)?.path).toBe("/e/wiki/wiki");
  // An extension off here lists nothing.
  expect(registry.list("place", (name) => name !== "inbox").map((one) => one.id)).not.toContain(
    "inbox",
  );
});

// Break: a clash reaching the key registry, which throws outside production and blanks the page.
test("the first loaded keeps a key", () => {
  const registry = createRegistry();
  const deploy = pageApi("deploy", registry, { title: "Deploy" });
  deploy.key({ keys: "space y", label: "Deploy", run });
  const wiki = pageApi("wiki", registry, { title: "Wiki" });
  wiki.key({ keys: "y", label: "Wiki", run });
  // A sequence the held key starts is the same press.
  wiki.key({ keys: "y w", label: "Wiki's page", run });

  expect(registry.list("key", all).map((key) => key.label)).toEqual(["Deploy"]);
  expect(registry.clashes()).toEqual([
    { extension: "wiki", keys: "space y", takenBy: "Deploy" },
    { extension: "wiki", keys: "space y w", takenBy: "Deploy" },
  ]);

  // Deploy unloads: the key is nobody's until wiki loads again.
  deploy.remove();
  expect(registry.list("key", all)).toEqual([]);
  wiki.remove();
  pageApi("wiki", registry, { title: "Wiki" }).key({ keys: "y", label: "Wiki", run });
  expect(registry.list("key", all).map((key) => key.label)).toEqual(["Wiki"]);
  expect(registry.clashes()).toEqual([]);
});

test("a place's leader key is a key like any other", () => {
  const registry = createRegistry();
  pageApi("deploy", registry, { title: "Deploy" }).key({
    keys: "w",
    label: "Deploy",
    run,
  });
  pageApi("wiki", registry, { title: "Wiki" }).place({ ...place("wiki", "Wiki"), key: "w" });

  // The place stays, without its key.
  const [wiki] = registry.list("place", all);
  expect(wiki.id).toBe("wiki");
  expect(wiki.key).toBeUndefined();
  expect(registry.clashes()).toEqual([{ extension: "wiki", keys: "space w", takenBy: "Deploy" }]);
});
