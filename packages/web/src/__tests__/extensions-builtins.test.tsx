// Uraeda's own parts as built-in extensions (US5): the inbox turned off in config.toml, for every
// repository or for others only, leaves the navigation, home, the New page, and the leader's keys,
// and its page says it is off, with a button that turns it on here.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { expect, test } from "vite-plus/test";
import { navigate } from "../routeHistory.ts";
import { atRepo, fixtureRepo, quiet, renderPage } from "./helpers.tsx";

/** A config folder whose settings file turns the inbox on in `on` alone. */
function inboxOn(on: ReadonlyArray<string>, config = temporaryFolder("uraeda-config")) {
  writeFileSync(
    join(config, "config.toml"),
    `[extensions.inbox]\non = [${on.map((name) => JSON.stringify(name)).join(", ")}]\n`,
  );
  return config;
}

const press = (key: string) => fireEvent.keyDown(document.body, { key });

/** The navigation column's link to the inbox, if any. */
const inboxLink = () =>
  within(screen.getByRole("navigation", { name: "Navigation" })).queryByRole("link", {
    name: /^Inbox/,
  });

/** A pane titled Inbox, on home or the New page. */
const inboxPane = () => screen.queryByRole("heading", { name: /^Inbox/ });

async function goTo(path: string) {
  await act(async () => navigate(atRepo(path)));
  await waitFor(() => expect(window.location.pathname).toBe(atRepo(path)));
  await quiet();
}

// Break: a list still reading the old literal, or the inbox's key left bound.
test.each([
  ["every repository", []],
  ["this repository", ["other"]],
])("a built-in turned off leaves every list (%s)", async (_, on) => {
  const repo = fixtureRepo();
  const config = inboxOn(on);
  const { name } = await renderPage("/", repo, { config });
  await screen.findByRole("navigation", { name: "Navigation" });
  await quiet();
  expect(inboxLink()).toBeNull();
  expect(screen.getByRole("heading", { name: /^Priorities now/ })).toBeTruthy();
  expect(inboxPane()).toBeNull();

  press(" ");
  press("i");
  await quiet();
  expect(window.location.pathname).toBe(atRepo("/"));

  await goTo("/new");
  expect(await screen.findByRole("heading", { name: /^Priorities/ })).toBeTruthy();
  expect(inboxPane()).toBeNull();

  // A link to it says it is off here, and turns it on here.
  await goTo("/inbox");
  expect(await screen.findByText("Inbox is off here")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Turn it on here" }));
  await waitFor(() => expect(inboxLink()).toBeTruthy());
  expect(screen.queryByText("Inbox is off here")).toBeNull();

  // In a repository it is on in, the inbox shows.
  cleanup();
  await renderPage("/", repo, { config: inboxOn([name], config) });
  await screen.findByRole("navigation", { name: "Navigation" });
  await quiet();
  expect(inboxLink()).toBeTruthy();
  expect(inboxPane()).toBeTruthy();
});
