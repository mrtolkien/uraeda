// Flow: a flag in force (decision settings: a flag overrides for one run, and is never written into
// the file). With `--allowed-hosts` given, the page says so, a name added is still saved to the
// file, and removing this browser's own name cuts nothing off, so it asks nothing.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterAll, expect, test } from "vite-plus/test";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { click, startApp, type } from "./harness.tsx";

const MAC = "mac.tail1234.ts.net";
const BUILD = "build.tail1234.ts.net";
const LAPTOP = "laptop.tail1234.ts.net";

const dir = temporaryFolder("uraeda-config");
const FILE = join(dir, "config.toml");
writeFileSync(FILE, `[server]\nallowed_hosts = ["${MAC}"]\n`);
const app = startApp({ settings: { allowedHosts: [BUILD], dir } });

const ORIGIN = window.location.href;
const atHost = (url: string) =>
  (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(url);
afterAll(() => atHost(ORIGIN));

test("the page says the flag is in force, a name added is saved, and this browser's own is removed without asking", async () => {
  atHost(`http://${MAC}:4310/`);
  await app.open("/settings/server");
  expect((await screen.findAllByText(/--allowed-hosts/)).length).toBeGreaterThan(0);

  await click(await screen.findByRole("button", { name: /Add a host name/ }));
  const field = screen.getByRole("textbox", { name: "New host name" });
  await type(field, LAPTOP);
  await act(async () => {
    fireEvent.keyDown(field, { key: "Enter" });
  });

  await screen.findByRole("button", { name: LAPTOP });
  const written = readFileSync(FILE, "utf8");
  expect(written).toContain(LAPTOP);
  // The flag's names are for this run only: they are never written into the file.
  expect(written).not.toContain(BUILD);

  await click(screen.getByRole("button", { name: `Remove ${MAC}` }));
  await waitFor(() => expect(readFileSync(FILE, "utf8")).not.toContain(MAC));
  expect(screen.queryByRole("dialog")).toBeNull();
});
