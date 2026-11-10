// The Jobs place (US4): each job a card with its next run and its last one, the first selected; the
// keys act on the selected card as its bar says: `j` and `k` move, Enter opens, `r` runs now, `p`
// pauses or resumes, `d` deletes after the shared confirmation, and `a` adds. A refusal shows under
// its card, never in a toast. The real list over fixed jobs, in the key registry and the app's
// confirmation, with no server: the jobs' data is the Jobs record's.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import type { JobRow } from "uraeda-server/fate";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { ConfirmHost } from "../fields/Confirm.tsx";
import type { RunSession } from "../jobs/facts.ts";
import { type JobsHandlers, JobsPlace } from "../jobs/JobsPage.tsx";
import { KeysProvider } from "../keys/registry.tsx";
import { RepositoryContext } from "../routes.tsx";
import { atWidth } from "./helpers.tsx";

beforeEach(() => atWidth(1440));
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

/** Thursday 12 November 2026, 10:30. */
const NOW = new Date(2026, 10, 12, 10, 30);
/** The zone `NOW` is local to, which the times read in. */
const ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

const at = (day: number, hour: number) => new Date(2026, 10, day, hour).toISOString();

const BASE: Pick<
  JobRow,
  "agent" | "effort" | "history" | "last" | "model" | "prompt" | "repositories"
> = {
  agent: null,
  effort: null,
  history: [],
  last: null,
  model: null,
  prompt: "Go.",
  repositories: ["uraeda"],
};

const RUN = {
  at: at(12, 3),
  due: at(12, 3),
  folder: "2026-11-12-upgrade",
  id: "1",
  outcome: "started" as const,
  reason: null,
  session: "s1",
  title: "Upgrade three dependencies",
  trigger: "schedule" as const,
};

const JOBS: ReadonlyArray<JobRow> = [
  {
    ...BASE,
    history: [RUN],
    last: RUN,
    name: "Dependencies",
    next: { at: null, text: null, why: "change-open" },
    on: true,
    problem: null,
    reportOnly: false,
    schedule: { hour: 3, kind: "daily", minute: 0 },
    scheduleText: "daily 03:00",
  },
  {
    ...BASE,
    name: "Persona walkthrough",
    next: { at: null, text: null, why: "paused" },
    on: false,
    problem: null,
    reportOnly: true,
    schedule: { hour: 5, kind: "weekdays", minute: 0 },
    scheduleText: "weekdays 05:00",
  },
  {
    ...BASE,
    name: "Code quality",
    next: { at: null, text: null, why: "problem" },
    on: true,
    problem: "Not running: the schedule “dayly 06:00” is not understood",
    reportOnly: false,
    schedule: null,
    scheduleText: "dayly 06:00",
  },
  {
    ...BASE,
    name: "Performance pass",
    next: { at: at(16, 4), text: null, why: null },
    on: true,
    problem: null,
    reportOnly: false,
    schedule: { day: 1, hour: 4, kind: "weekly", minute: 0 },
    scheduleText: "monday 04:00",
  },
];

const SESSIONS: ReadonlyMap<string, RunSession> = new Map([
  [
    "s1",
    {
      done: false,
      label: "Needs you",
      status: "needs-you",
      step: { kind: "pull-request", label: "PR ready" },
    },
  ],
]);

type Spies = { [K in keyof JobsHandlers]: ReturnType<typeof vi.fn> };

function spies(): Spies {
  return {
    onAdd: vi.fn(),
    onOpen: vi.fn(),
    onRemove: vi.fn(async () => undefined),
    onRun: vi.fn(async () => undefined),
    onSetOn: vi.fn(async () => undefined),
  };
}

function show(handlers: Spies, extra?: ReactNode, jobs = JOBS, enabled = true) {
  render(
    <RepositoryContext.Provider value="uraeda">
      <KeysProvider>
        <ConfirmHost>
          <JobsPlace
            enabled={enabled}
            handlers={handlers as JobsHandlers}
            jobs={jobs}
            now={NOW}
            problem={null}
            sessions={SESSIONS}
            zone={ZONE}
          />
          {extra}
        </ConfirmHost>
      </KeysProvider>
    </RepositoryContext.Provider>,
  );
}

const press = (key: string) => fireEvent.keyDown(document.body, { key });

/** The card of the job, its list item. */
const card = (name: string) => document.querySelector<HTMLElement>(`[data-row-key="${name}"]`)!;

/** The selected card's name. */
const selected = () =>
  document.querySelector<HTMLElement>("[data-row-key][aria-current='true']")?.dataset.rowKey;

test("each card names its schedule, its next run, and its last run, in words", () => {
  show(spies());
  const first = card("Dependencies");
  expect(within(first).getByText("Every day at 3:00")).toBeTruthy();
  expect(within(first).getByText("Waits for that change to close")).toBeTruthy();
  expect(
    within(first).getByText("Today at 3:00 · started “Upgrade three dependencies”, PR ready"),
  ).toBeTruthy();
  expect(card("Persona walkthrough").textContent).toContain("Report only");
  expect(within(card("Persona walkthrough")).getByText("Paused")).toBeTruthy();
  expect(within(card("Persona walkthrough")).getByText("Never ran")).toBeTruthy();
  // US4 3: a schedule that is not understood, in the card's words, and as written.
  expect(within(card("Code quality")).getByText("dayly 06:00")).toBeTruthy();
  expect(
    within(card("Code quality")).getByText(
      "Not running: the schedule “dayly 06:00” is not understood",
    ),
  ).toBeTruthy();
  expect(within(card("Performance pass")).getByText("Monday 16 November at 4:00")).toBeTruthy();
  expect(selected()).toBe("Dependencies");
});

test("a card shows the problem of a job that still runs here beneath its next run (review 05, 3)", () => {
  const [, paused, , ahead] = JOBS;
  const missing = "“notes” is not in Uraeda's list.";
  show(spies(), undefined, [
    { ...ahead, problem: missing },
    { ...paused, problem: missing },
  ]);
  const running = card("Performance pass");
  expect(within(running).getByText("Monday 16 November at 4:00")).toBeTruthy();
  expect(within(running).getByText(missing)).toBeTruthy();
  const stopped = card("Persona walkthrough");
  expect(within(stopped).getByText("Paused")).toBeTruthy();
  expect(within(stopped).getByText(missing)).toBeTruthy();
});

test("the last run is the record's, though 50 skipped times have pushed it out of the history", () => {
  const [deps] = JOBS;
  const skipped = { ...RUN, id: "2", outcome: "skipped" as const, reason: "change-open" as const };
  show(spies(), undefined, [{ ...deps, history: [skipped] }]);
  expect(
    within(card("Dependencies")).getByText(
      "Today at 3:00 · started “Upgrade three dependencies”, PR ready",
    ),
  ).toBeTruthy();
});

test("j and k move the selection, and the bar shows under the selected card", () => {
  show(spies());
  press("j");
  expect(selected()).toBe("Persona walkthrough");
  press("j");
  press("j");
  expect(selected()).toBe("Performance pass");
  press("k");
  expect(selected()).toBe("Code quality");
  expect(within(card("Code quality")).getByRole("button", { name: /run now/ })).toBeTruthy();
  expect(within(card("Dependencies")).queryByRole("button", { name: /run now/ })).toBeNull();
});

test("Enter opens the selected job, and a opens a new one", () => {
  const handlers = spies();
  show(handlers);
  press("j");
  press("Enter");
  expect(handlers.onOpen).toHaveBeenCalledWith("Persona walkthrough");
  press("a");
  expect(handlers.onAdd).toHaveBeenCalledTimes(1);
});

test("r runs the selected job now, even paused (US4 more 3), and its refusal shows under it", async () => {
  const handlers = spies();
  handlers.onRun.mockResolvedValueOnce("“Persona walkthrough” still runs here.");
  show(handlers);
  press("j");
  press("r");
  expect(handlers.onRun).toHaveBeenCalledWith("Persona walkthrough");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("“Persona walkthrough” still runs here.");
  expect(card("Persona walkthrough").contains(alert)).toBe(true);
  // Dismissed, it goes.
  fireEvent.click(within(alert).getByRole("button", { name: "Dismiss" }));
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
});

test("p pauses a job that runs and resumes one that does not; the switch does the same", () => {
  const handlers = spies();
  show(handlers);
  press("p");
  expect(handlers.onSetOn).toHaveBeenLastCalledWith("Dependencies", false);
  press("j");
  press("p");
  expect(handlers.onSetOn).toHaveBeenLastCalledWith("Persona walkthrough", true);
  fireEvent.click(
    within(card("Performance pass")).getByRole("switch", {
      name: "Performance pass runs on its schedule",
    }),
  );
  expect(handlers.onSetOn).toHaveBeenLastCalledWith("Performance pass", false);
});

test("d asks the shared confirmation, and deletes only on a yes (US4 more 1)", async () => {
  const handlers = spies();
  show(handlers);
  press("d");
  const dialog = await screen.findByRole("dialog", { name: "Delete the job “Dependencies”?" });
  expect(dialog.textContent).toContain("Its prompt leaves config.toml, and its sessions stay.");
  fireEvent.click(within(dialog).getByRole("button", { name: /Keep/ }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(handlers.onRemove).not.toHaveBeenCalled();

  press("d");
  const again = await screen.findByRole("dialog", { name: "Delete the job “Dependencies”?" });
  await act(async () => {
    fireEvent.click(within(again).getByRole("button", { name: /Delete/ }));
  });
  await waitFor(() => expect(handlers.onRemove).toHaveBeenCalledWith("Dependencies"));
});

test("with every job off, the banner says so, over the same cards", () => {
  show(spies(), undefined, JOBS, false);
  expect(screen.getByText("Scheduled jobs are off.")).toBeTruthy();
  expect(card("Dependencies")).toBeTruthy();
});

test("with no job, the page says what goes in it, and a still adds", () => {
  const handlers = spies();
  show(handlers, undefined, []);
  expect(screen.getByText(/No job yet/)).toBeTruthy();
  press("a");
  expect(handlers.onAdd).toHaveBeenCalledTimes(1);
});
