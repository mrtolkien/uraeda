// The start dialogs' run map (spec of Run options, US5 and SC-001): the settings' map, drawn in the
// dialog, a change's with its fix and its reviewers alone. Tab reaches it, its keys move along it
// and open the picker there as they do on a page, and the start keeps as the feature's own options
// only what the map changed, so every value left alone follows the settings at each run. And the
// feature page's map: drawn once the settings are read, without holding the page, and saved in the
// edits' order.
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { FakeAdapter } from "uraeda-server/testing";
import {
  click,
  fakeAgent,
  fieldText,
  fixtureRepo,
  renderPage,
  serverFetch,
  today,
  type,
} from "./helpers.tsx";

today("2026-10-16");

const FOLDER = "2026-10-16-dark-mode";

const EFFORTS = ["low", "medium", "high"].map((id) => ({
  id,
  name: id.charAt(0).toUpperCase() + id.slice(1),
}));

/** The fake agent first, then a second runtime, `claude`, listing Sonnet, its default, and Opus. */
async function twoRuntimes() {
  const fake = await fakeAgent();
  const claude = new FakeAdapter();
  claude.modelList = {
    defaults: { effort: "medium", model: "sonnet" },
    models: [
      { efforts: EFFORTS, id: "sonnet", name: "Sonnet" },
      { efforts: EFFORTS, id: "opus", name: "Opus" },
    ],
  };
  fake.sessions.runtimes.register("claude", claude);
  await fake.sessions.check();
  await fake.sessions.runtimes.refreshModels();
  return fake;
}

/** Presses `key` where the focus is. */
function press(key: string) {
  fireEvent.keyDown(document.activeElement ?? document.body, { key });
}

/** Picks the row `name` of the key picker open, `label` its filter's name: typed, then Enter. */
async function pickRow(label: string, name: string) {
  const field = await screen.findByRole("combobox", { name: label });
  await type(field, name);
  await waitFor(() =>
    expect(screen.getAllByRole("option")[0]?.textContent).toMatch(new RegExp(name)),
  );
  await act(async () => {
    fireEvent.keyDown(field, { key: "Enter" });
  });
  await waitFor(() => expect(screen.queryByRole("combobox", { name: label })).toBeNull());
}

/** The own run options of the feature `folder`, as the server's record of it holds them. */
async function ownOptions(fetch: typeof globalThis.fetch, name: string, folder = FOLDER) {
  const response = await fetch(`/r/${encodeURIComponent(name)}/fate`, {
    body: JSON.stringify({
      operations: [
        { id: "0", ids: [folder], kind: "byId", select: ["runOptions"], type: "Feature" },
      ],
      version: 1,
    }),
    method: "POST",
  });
  const body = (await response.json()) as {
    results: Array<{ data: Array<{ runOptions: { own: unknown } }> }>;
  };
  return body.results[0]?.data[0]?.runOptions.own;
}

/** The start dialog `title` of the New page for `kind`, opened on `text` typed in its composer `box`. */
async function startDialog(kind: "feature" | "change", box: string, text: string, title: string) {
  const repo = fixtureRepo();
  const fake = await twoRuntimes();
  const fetch = serverFetch(repo, fake.sessions);
  const { name } = await renderPage(`/new?kind=${kind}`, repo, { agent: fake, fetch });
  await type(await screen.findByRole("textbox", { name: box }), text);
  await click(await screen.findByRole("button", { name: `Start the ${kind}` }));
  const dialog = await screen.findByRole("dialog", { name: title });
  await waitFor(() =>
    expect(fieldText(within(dialog).getByRole("textbox", { name: "Short name" }))).not.toBe(""),
  );
  return { dialog, fetch, name };
}

/** The map's places that take the focus by Tab: its cursor's, alone. */
const stopsOf = (map: HTMLElement) =>
  within(map)
    .getAllByRole("button")
    .concat(within(map).queryAllByRole("switch"))
    .filter((button) => button.tabIndex === 0)
    .map((stop) => stop.getAttribute("aria-label"));

test("a feature started with Spec on Opus keeps only that pick", async () => {
  const { dialog, fetch, name } = await startDialog(
    "feature",
    "Write Proposal",
    "Dark mode: follow the system theme",
    "Name the feature",
  );
  expect(fieldText(within(dialog).getByRole("textbox", { name: "Short name" }))).toBe("dark-mode");
  expect(within(dialog).getByText("How each step runs")).toBeTruthy();

  // The dialog draws the settings' map, whole: its six steps, the implementers, the reviewers.
  const map = within(dialog).getByRole("group", { name: "How each step runs" });
  for (const place of ["Discovery", "Spec", "Plan", "Build", "Review", "Comments"]) {
    expect(within(map).getByRole("button", { name: place })).toBeTruthy();
  }
  expect(within(map).getByRole("button", { name: "Implementers" })).toBeTruthy();
  // Tab reaches the map on its first step, its one tab stop.
  expect(stopsOf(map)).toEqual(["Discovery"]);
  act(() => within(map).getByRole("button", { name: "Discovery" }).focus());
  // The map's keys, heard in the dialog: → over the joint, then to Spec.
  act(() => press("ArrowRight"));
  const joint = document.activeElement;
  expect(joint?.getAttribute("aria-label")).toMatch(/^Discovery to Spec:/);
  // Enter cuts the joint, a switch, and `r` puts it back to the default.
  act(() => press("Enter"));
  expect(joint?.getAttribute("aria-checked")).toBe("true");
  act(() => press("r"));
  expect(joint?.getAttribute("aria-checked")).toBe("false");
  act(() => press("ArrowRight"));
  expect(document.activeElement?.getAttribute("aria-label")).toBe("Spec");
  // Enter on a step opens its picker, and starts nothing: the dialog stays, the page too.
  act(() => press("Enter"));
  await pickRow("Find a model", "Opus");
  await pickRow("Find an effort", "High");
  expect(window.location.pathname).toMatch(/\/new$/);

  await waitFor(() =>
    expect(within(map).getByRole("button", { name: "Spec" }).textContent).toMatch(/Opus/),
  );
  await click(within(dialog).getByRole("button", { name: "Start the feature" }));

  await waitFor(async () =>
    expect(await ownOptions(fetch, name)).toEqual({
      steps: [{ agent: "claude", effort: "high", model: "opus", step: "spec" }],
    }),
  );
});

test("a change's dialog draws what a change runs: its fix and its reviewers", async () => {
  const { dialog } = await startDialog(
    "change",
    "Message Claude Code",
    "Centre the x in failure circles",
    "Name the change",
  );
  expect(within(dialog).getByText("How the change runs")).toBeTruthy();
  const map = within(dialog).getByRole("group", { name: "How each step runs" });
  const places = () =>
    within(map)
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label"));
  expect(places()).toEqual(["Fix", "Reviewer 1", "Add a reviewer"]);
  expect(within(map).queryAllByRole("switch")).toEqual([]);

  // ↓ goes from the fix to its reviewers and along them, `a` adds one, `d` removes the one selected.
  expect(stopsOf(map)).toEqual(["Fix"]);
  act(() => within(map).getByRole("button", { name: "Fix" }).focus());
  act(() => press("ArrowRight"));
  expect(document.activeElement?.getAttribute("aria-label")).toBe("Fix");
  act(() => press("ArrowDown"));
  expect(document.activeElement?.getAttribute("aria-label")).toBe("Reviewer 1");
  act(() => press("a"));
  expect(places()).toEqual(["Fix", "Reviewer 1", "Reviewer 2", "Add a reviewer"]);
  act(() => press("ArrowDown"));
  expect(document.activeElement?.getAttribute("aria-label")).toBe("Reviewer 2");
  act(() => press("d"));
  expect(places()).toEqual(["Fix", "Reviewer 1", "Add a reviewer"]);
  act(() => press("ArrowUp"));
  expect(document.activeElement?.getAttribute("aria-label")).toBe("Fix");
});

/**
 * `fetch`, holding each request whose body `holds` until `release`: each request held as it is
 * made, never sent to the server before then.
 */
function holding(fetch: typeof globalThis.fetch, holds: (body: string) => boolean) {
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  const held: typeof globalThis.fetch = async (input, init) => {
    if (typeof init?.body === "string" && holds(init.body)) {
      await released;
    }
    return fetch(input, init);
  };
  return { fetch: held, release };
}

/** The feature page's map of `2026-10-12-cli-tuis`, at its plan. */
const PLANNING = "2026-10-12-cli-tuis";

/** The joint of the map named `name`, "Build to Review". */
const joint = (name: string) => screen.getByRole("switch", { name: new RegExp(`^${name}:`) });

test("the feature page draws its map once the settings are read, the page drawn meanwhile", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const settings = holding(serverFetch(repo, fake.sessions), (body) => body.includes("Settings"));
  await renderPage(`/f/${PLANNING}`, repo, { agent: fake, fetch: settings.fetch });

  await screen.findByRole("heading", { name: /CLI TUIs/i });
  expect(screen.queryByRole("group", { name: "How each step runs" })).toBeNull();

  settings.release();
  await screen.findByRole("group", { name: "How each step runs" });
});

test("the feature page's map saves its edits in order: the last one stays", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const server = serverFetch(repo, fake.sessions);
  let saves = 0;
  // The first save is held before the server reads it, as a slow request would be.
  const first = holding(server, (body) => body.includes("feature.setRunOptions") && saves++ === 0);
  const { name } = await renderPage(`/f/${PLANNING}`, repo, { agent: fake, fetch: first.fetch });
  await screen.findByRole("group", { name: "How each step runs" });

  await click(joint("Build to Review"));
  await click(joint("Review to Comments"));
  first.release();

  await waitFor(async () =>
    expect(await ownOptions(server, name, PLANNING)).toEqual({
      steps: [
        { newSession: true, step: "review" },
        { newSession: true, step: "comments" },
      ],
    }),
  );
  await waitFor(() => expect(joint("Build to Review").getAttribute("aria-checked")).toBe("true"));
  expect(joint("Review to Comments").getAttribute("aria-checked")).toBe("true");
});
