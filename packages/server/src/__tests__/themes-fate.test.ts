// The `Themes` record on every endpoint, and the live update a theme file's change sends.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, vi } from "vite-plus/test";
import { live } from "../fate.ts";
import { byIdAt, testApp } from "./helpers.ts";

const SELECT = ["id", "files", "folder", "themes"];

type Opened = Awaited<ReturnType<typeof testApp>>;

/** The `Themes` record, as the endpoint of `name` gives it: the global one for null. */
async function record(opened: Opened, name: string | null = null) {
  const [read] = await byIdAt(opened.app, name, "Themes", ["themes"], SELECT);
  return read;
}

test("the record is read on the global endpoint and a repository's", async () => {
  const opened = await testApp();

  const global = await record(opened);
  const hosted = await record(opened, opened.name);

  expect(global).toEqual({ ...opened.themes.current(), id: "themes" });
  expect(global.themes.map((theme: { id: string }) => theme.id)).toContain("catppuccin-mocha");
  expect(hosted).toEqual(global);
});

test("a theme file written sends the update, and the record reads it", async () => {
  const opened = await testApp();
  const update = vi.spyOn(live, "update");
  const from = update.mock.calls.length;
  const heard = () =>
    update.mock.calls
      .slice(from)
      .map(([type, id]) => `${String(type)} ${String(id)}`)
      .filter((call) => call.startsWith("Themes "));

  mkdirSync(join(opened.configDir, "themes"));
  writeFileSync(
    join(opened.configDir, "themes", "ember.toml"),
    'name = "Ember"\nextends = "catppuccin-mocha"\n',
  );
  await vi.waitFor(() => expect(heard()).toEqual(["Themes themes"]), {
    interval: 10,
    timeout: 10_000,
  });

  const ids = (await record(opened, opened.name)).themes.map((theme: { id: string }) => theme.id);
  expect(ids).toContain("ember");
});
