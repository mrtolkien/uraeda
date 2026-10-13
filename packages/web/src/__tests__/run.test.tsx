// US8: the agent's runs at both widths. The feature page lists the runs, and a run's view shows its
// log; the pane beside the feature page and the log following its end are in the browser tests.
import { act, fireEvent, screen, within } from "@testing-library/react";
import * as binding from "uraeda-binding";
import { expect, test } from "vite-plus/test";
import {
  atWidth,
  click,
  type Fake,
  fakeAgent,
  fixtureRepo,
  renderPage,
  today,
} from "./helpers.tsx";

const CLI = "2026-10-12-cli-tuis";
const WEB_UI = "2026-10-11-web-ui";

today("2026-10-12");

type Steps = Parameters<Fake["adapter"]["script"]>[0];

/** Scripts a run of the fake agent, starts it as "Start the agent" does, and waits for its end. */
async function seedRun(fake: Fake, repo: string, steps: Steps, folder = CLI) {
  fake.adapter.script(steps);
  const id = await fake.runner.start(repo, folder, { trigger: "manual" });
  await fake.runner.settled(id);
  return id;
}

/** A run that failed on Plan while a `Bash` call was going on, after auto mode blocked one. */
const FAILED: Steps = [
  { type: "text", text: "Reading **the answers**" },
  { type: "toolStart", id: "a", name: "Read", input: { file_path: "spec.md" } },
  { type: "toolEnd", id: "a", isError: false, output: "# Spec" },
  { type: "toolStart", id: "b", name: "Bash", input: { command: "vp run ready" } },
  {
    type: "result",
    ok: false,
    costUsd: 0.42,
    errors: ["The tests failed."],
    denials: [{ tool: "Bash", input: { command: "gh pr create --draft" } }],
  },
];

test("US8 1: the feature page shows the run's state and its row, and no log", async () => {
  atWidth(402);
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await seedRun(fake, repo, FAILED);

  await renderPage(`/f/${CLI}`, repo, { agent: fake });

  const agent = within(await screen.findByRole("region", { name: "Agent" }));
  expect(await agent.findByText("Failed on Plan")).toBeTruthy();
  expect(agent.getByText("The tests failed.")).toBeTruthy();
  expect(agent.getByText("Bash: gh pr create --draft")).toBeTruthy();
  expect(agent.getByRole("button", { name: "Allow and continue" })).toBeTruthy();
  expect(agent.getByRole("button", { name: "Try again" })).toBeTruthy();
  const runs = within(agent.getByRole("list", { name: "Runs" }));
  expect(runs.getByRole("link", { name: /Plan · Failed on Plan/ })).toBeTruthy();
  expect(screen.queryByRole("log", { name: "Run log" })).toBeNull();
  expect(screen.queryByText("the answers")).toBeNull();
});

test("US8 2: a run's row opens its view as a page, and Back returns", async () => {
  atWidth(402);
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const id = await seedRun(fake, repo, FAILED);
  await renderPage(`/f/${CLI}`, repo, { agent: fake });

  await click(await screen.findByRole("link", { name: /Plan · Failed on Plan/ }));

  expect(window.location.pathname).toBe(`/f/${CLI}/runs/${id}`);
  const log = await screen.findByRole("log", { name: "Run log" });
  expect(within(log).getByText("the answers").tagName).toBe("STRONG");
  expect(screen.getByRole("heading", { level: 1, name: "Plan" })).toBeTruthy();
  expect(screen.getByText("Failed on Plan")).toBeTruthy();
  // A page of its own: the feature's files are not beside it.
  expect(screen.queryByRole("list", { name: "Files" })).toBeNull();

  // Back is answered later, by a popstate event: the page draws what follows within the act.
  await act(async () => {
    const back = new Promise((resolve) =>
      window.addEventListener("popstate", resolve, { once: true }),
    );
    window.history.back();
    await back;
  });
  expect(window.location.pathname).toBe(`/f/${CLI}`);
  expect(await screen.findByRole("list", { name: "Runs" })).toBeTruthy();
});

test("US8 4: an opened group of tool calls stays open on a reload", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const id = await seedRun(fake, repo, FAILED);
  await renderPage(`/f/${CLI}/runs/${id}`, repo, { agent: fake });
  const log = await screen.findByRole("log", { name: "Run log" });
  // The group's row ends with its count of calls; each call's own row is inside it.
  const group = await within(log).findByRole("button", { expanded: false, name: /2$/ });

  await act(async () => {
    fireEvent.click(group);
  });
  expect(within(log).getByRole("button", { expanded: true })).toBeTruthy();

  await renderPage(window.location.pathname, repo, { agent: fake, reload: true });
  const again = await screen.findByRole("log", { name: "Run log" });
  expect(await within(again).findByRole("button", { expanded: true })).toBeTruthy();
});

test("US8 6: a call the failed run left going shows as failed, not running", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const id = await seedRun(fake, repo, FAILED);

  await renderPage(`/f/${CLI}/runs/${id}`, repo, { agent: fake });

  const log = await screen.findByRole("log", { name: "Run log" });
  await within(log).findAllByText("vp run ready");
  expect(log.textContent).toContain("Not finished: the run ended.");
  expect(log.textContent).not.toContain("Running");
});

test("a run's address that names no run of the feature says so", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  // Review focus 6: a run of another feature, waiting on the human now, is not this one's.
  const { mainRoot } = await binding.nextStep(repo, WEB_UI);
  const other = fake.runner.cache.startRun({
    repo: mainRoot,
    folder: WEB_UI,
    sessionId: "3f2c0000-0000-4000-8000-000000000000",
    newSession: true,
    trigger: "manual",
    step: "discovery",
    allowed: null,
    startedAt: "2026-10-12T09:00:00.000Z",
  })!;
  fake.runner.cache.appendEvent(other, { kind: "text", text: "Asked." });
  fake.runner.cache.endRun(other, { state: "done" });

  await renderPage(`/f/${CLI}/runs/${other}`, repo, { agent: fake });

  expect(await screen.findByText(`No run ${other} in ${CLI}.`)).toBeTruthy();
  expect(screen.getByRole("link", { name: "Open the feature" })).toBeTruthy();
  expect(screen.queryByText("Asked.")).toBeNull();
});

test("a run's address in a feature that does not exist says the feature is missing", async () => {
  await renderPage("/f/2026-01-01-nothing/runs/1", fixtureRepo(), { agent: true });

  expect(await screen.findAllByText("No feature 2026-01-01-nothing.")).not.toHaveLength(0);
  expect(screen.queryByText("No run 1 in 2026-01-01-nothing.")).toBeNull();
});
