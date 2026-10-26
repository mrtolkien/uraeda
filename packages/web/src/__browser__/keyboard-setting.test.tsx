// The Keyboard section's switch in a real browser, at a phone's and a desktop's size (US5): the
// real section is reached and drawn, and the switch takes Space from the leader while the
// shortcuts are on, since a switch is a control that keeps it. The setting's effect on the keys is
// the settings tests'; the form's layout is `layout.test.tsx`'s. A small page declaring a leader
// key stands for the real pages, so a Space the registry took would show.
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import "../theme/built/uraeda.css";
import { cleanup, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, test } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { LeaderMenuHost } from "../keys/LeaderMenuHost.tsx";
import { KeysProvider, useKeys } from "../keys/registry.tsx";
import { RepositoryPathContext } from "../routes.tsx";
import type { ServerActions, ServerValues } from "../settings/ServerSettings.tsx";
import { SettingsView } from "../settings/SettingsView.tsx";

afterEach(cleanup);

const values = (on: boolean): ServerValues => ({
  file: "~/.config/uraeda/config.toml",
  keyboard: { singleKeyShortcuts: { inForce: on, saved: null, source: { kind: "default" } } },
  problem: null,
  runs: { buildInFreshSession: { inForce: true, saved: null, source: { kind: "default" } } },
  server: {
    allowedHosts: { inForce: [], saved: [], source: { kind: "default" } },
    openBrowser: { inForce: true, saved: null, source: { kind: "default" } },
    port: { inForce: 4310, saved: null, source: { kind: "default" } },
  },
});

const saved: Array<boolean> = [];
const done = async () => undefined;

/** The page: the section, its switch kept as the server would keep it, and a leader key. */
function Page() {
  const [on, setOn] = useState(true);
  useKeys([{ keys: "space n n", label: "Note", run: () => {} }]);
  const actions: ServerActions = {
    addHost: done,
    editHost: done,
    removeHost: done,
    setBuildInFreshSession: done,
    setOpenBrowser: done,
    setPort: done,
    setSingleKeyShortcuts: async (next) => (saved.push(next), setOn(next), undefined),
  };
  return <SettingsView category="keyboard" server={values(on)} serverActions={actions} />;
}

function show() {
  saved.length = 0;
  render(
    <KeysProvider>
      <RepositoryPathContext value="/fixture">
        <Page />
      </RepositoryPathContext>
      <LeaderMenuHost />
    </KeysProvider>,
  );
}

const shortcuts = () =>
  screen.getByRole<HTMLInputElement>("switch", { name: "Single-key shortcuts" });

test("the Keyboard section has the switch, on, and a click saves it and turns it off", async () => {
  show();
  expect(screen.getByRole("heading", { name: "Keyboard" })).toBeTruthy();
  expect(shortcuts().checked).toBe(true);

  await userEvent.click(shortcuts());

  expect(saved).toEqual([false]);
  expect(shortcuts().checked).toBe(false);
});

test("Space on the switch ticks it and is not the leader's, so the menu stays shut", async () => {
  show();
  // The window's listener of this test runs after the registry's: it sees what the registry did.
  const prevented: Array<boolean> = [];
  const record = (event: KeyboardEvent) => void prevented.push(event.defaultPrevented);
  window.addEventListener("keydown", record);
  shortcuts().focus();

  await userEvent.keyboard(" ");

  window.removeEventListener("keydown", record);
  expect(saved).toEqual([false]);
  expect(prevented).toEqual([false]);
  expect(screen.queryByRole("group", { name: "Space" })).toBeNull();
});
