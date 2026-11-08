// The registry's order and its rule over keys: Uraeda's places before yours, and a key kept by the
// first extension on here that claims it.
import { expect, test } from "vite-plus/test";
import { pageApi } from "./pageApi.ts";
import { createRegistry } from "./registry.ts";
import { clashesIn } from "./useContributions.ts";

const Nothing = () => null;
const place = (id: string, title: string) => ({
  component: Nothing,
  icon: "uraeda:list",
  id,
  title,
});
const all = () => true;
const run = () => {};
const inboxOff = (name: string) => name !== "inbox";
const inRepo1 = (name: string) => name !== "wiki";
const inRepo2 = (name: string) => name !== "deploy";

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
  expect(registry.clashes(all)).toEqual([
    { extension: "wiki", keys: "space y", takenBy: "Deploy" },
    { extension: "wiki", keys: "space y w", takenBy: "Deploy" },
  ]);

  // Deploy unloads: wiki, which kept its claims, has `y`, which starts its own `y w`.
  deploy.remove();
  expect(registry.list("key", all).map((key) => key.label)).toEqual(["Wiki"]);
  expect(registry.clashes(all)).toEqual([
    { extension: "wiki", keys: "space y w", takenBy: "Wiki" },
  ]);
});

// Break: clashes decided once at registration, against every extension whatever its on-state.
test("a key off here is free for another, and each repository settles its own", () => {
  const registry = createRegistry();
  pageApi("inbox", registry, { order: 1, title: "Inbox" }).place({
    ...place("inbox", "Inbox"),
    key: "i",
  });
  pageApi("mail", registry, { title: "Mail" }).key({ keys: "i", label: "Mail", run });
  // The built-in inbox off here: its replacement has `i`.
  expect(registry.list("key", inboxOff).map((key) => key.label)).toEqual(["Mail"]);
  expect(registry.clashes(inboxOff)).toEqual([]);
  // On, the inbox registered first keeps it.
  expect(registry.list("key", all)).toEqual([]);
  expect(registry.list("place", all)[0].key).toBe("i");
  expect(registry.clashes(all)).toEqual([{ extension: "mail", keys: "space i", takenBy: "Inbox" }]);

  // Deploy on only in one repository, wiki only in another: each has `y` there.
  pageApi("deploy", registry, { title: "Deploy" }).key({ keys: "y", label: "Deploy", run });
  pageApi("wiki", registry, { title: "Wiki" }).key({ keys: "y", label: "Wiki", run });
  expect(registry.list("key", inRepo1).map((key) => key.label)).toEqual(["Deploy"]);
  expect(registry.list("key", inRepo2).map((key) => key.label)).toEqual(["Wiki"]);
  expect(registry.clashes(inRepo2)).toEqual([
    { extension: "mail", keys: "space i", takenBy: "Inbox" },
  ]);
  // The settings page reports each clash with where it happens, when not everywhere.
  const on: Record<string, (name: string) => boolean> = {
    repo1: inRepo1,
    repo2: inRepo2,
    repo3: inboxOff,
  };
  expect(clashesIn(registry.snapshot(), ["repo1", "repo2", "repo3"], (repo) => on[repo])).toEqual([
    { extension: "mail", keys: "space i", repositories: ["repo1", "repo2"], takenBy: "Inbox" },
    { extension: "wiki", keys: "space y", repositories: ["repo3"], takenBy: "Deploy" },
  ]);
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
  expect(registry.clashes(all)).toEqual([
    { extension: "wiki", keys: "space w", takenBy: "Deploy" },
  ]);
});
