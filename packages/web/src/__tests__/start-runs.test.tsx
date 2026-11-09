// The start dialogs' run strip (spec of Run options, US5 and SC-001): Tab reaches it, the map's keys
// move along it and open the picker, and the start keeps as the feature's own options only what the
// strip changed, so every value left alone follows the settings at each run.
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

/** The feature's own run options, as the server's record of it holds them. */
async function ownOptions(fetch: typeof globalThis.fetch, name: string) {
  const response = await fetch(`/r/${encodeURIComponent(name)}/fate`, {
    body: JSON.stringify({
      operations: [
        { id: "0", ids: [FOLDER], kind: "byId", select: ["runOptions"], type: "Feature" },
      ],
      version: 1,
    }),
    method: "POST",
  });
  const body = (await response.json()) as {
    results: Array<{ data: Array<{ runOptions: unknown }> }>;
  };
  return body.results[0]?.data[0]?.runOptions;
}

test("a feature started with Spec on Opus keeps only that pick", async () => {
  const repo = fixtureRepo();
  const fake = await twoRuntimes();
  const fetch = serverFetch(repo, fake.sessions);
  const { name } = await renderPage("/new?kind=feature", repo, { agent: fake, fetch });
  await type(
    await screen.findByRole("textbox", { name: "Write Proposal" }),
    "Dark mode: follow the system theme",
  );
  await click(await screen.findByRole("button", { name: "Start the feature" }));
  const dialog = await screen.findByRole("dialog", { name: "Name the feature" });
  await waitFor(() =>
    expect(fieldText(within(dialog).getByRole("textbox", { name: "Short name" }))).toBe(
      "dark-mode",
    ),
  );
  expect(within(dialog).getByText("Runs")).toBeTruthy();
  expect(within(dialog).getByText("defaults")).toBeTruthy();

  // Tab reaches the strip on its first step, its one tab stop.
  const strip = within(dialog).getByRole("group", { name: "How each step runs" });
  const stops = within(strip)
    .getAllByRole("button")
    .filter((button) => button.tabIndex === 0);
  expect(stops.map((stop) => stop.getAttribute("aria-label"))).toEqual(["Discovery"]);
  act(() => stops[0]!.focus());
  // The map's keys: → over the joint, then to Spec, and Enter opens the picker.
  act(() => press("ArrowRight"));
  const joint = document.activeElement;
  expect(joint?.getAttribute("aria-label")).toBe("Discovery to Spec");
  // Enter cuts the joint, a switch, and `r` puts it back to the default.
  act(() => press("Enter"));
  expect(joint?.getAttribute("aria-checked")).toBe("true");
  act(() => press("r"));
  expect(joint?.getAttribute("aria-checked")).toBe("false");
  act(() => press("ArrowRight"));
  expect(document.activeElement?.getAttribute("aria-label")).toBe("Spec");
  act(() => press("Enter"));
  await pickRow("Find a model", "Opus");
  await pickRow("Find an effort", "High");

  await waitFor(() => expect(within(dialog).getByText("Spec on Opus · High")).toBeTruthy());
  await click(within(dialog).getByRole("button", { name: "Start the feature" }));

  await waitFor(async () =>
    expect(await ownOptions(fetch, name)).toEqual({
      steps: [{ agent: "claude", effort: "high", model: "opus", step: "spec" }],
    }),
  );
});
