// A job's page and a new job's (US5): the form saves each field as it is left, or on Enter for a
// line, through `onSave`, which answers the refusal in words, shown under its field with the typed
// text kept; a new job is added by one button once its name and prompt are filled, with Daily at
// 03:00 and this repository ticked; a name no job has reads as the app's missing page. The real
// components over fixed jobs, in the key registry, with no server: the data is the Jobs record's.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { FateClient } from "react-fate";
import type { JobRow } from "uraeda-server/fate";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { fateClients } from "../clients.ts";
import { ConfirmHost } from "../fields/Confirm.tsx";
import { JobHistory, skippedWords } from "../jobs/JobHistory.tsx";
import { JobPageView, NewJobPageView } from "../jobs/JobPage.tsx";
import { KeysProvider } from "../keys/registry.tsx";
import { RepositoryContext } from "../routes.tsx";
import { atWidth, fieldText, type } from "./helpers.tsx";

beforeEach(() => atWidth(1440));
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

/** Thursday 12 November 2026, 10:30. */
const NOW = new Date(2026, 10, 12, 10, 30);
/** The zone `NOW` is local to, which the times read in. */
const ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

const JOB: JobRow = {
  agent: "claude",
  effort: "high",
  history: [],
  model: "opus",
  name: "Dependencies",
  next: { at: new Date(2026, 10, 13, 3).toISOString(), why: null },
  on: true,
  problem: null,
  prompt: "Upgrade the dependencies.",
  reportOnly: false,
  repositories: ["uraeda", "notes"],
  schedule: { hour: 3, kind: "daily", minute: 0 },
  scheduleText: "daily 03:00",
};

const RUNTIMES = [
  {
    defaults: { effort: "high", model: "opus" },
    icon: "uraeda:harness-claude" as const,
    kind: "claude",
    models: [
      {
        efforts: [
          { id: "high", name: "High" },
          { id: "low", name: "Low" },
        ],
        id: "opus",
        name: "Opus",
      },
    ],
    name: "Claude Code",
  },
];

/** What a job writes: the form's input for the job as the file holds it. */
const INPUT = {
  agent: "claude",
  effort: "high",
  model: "opus",
  name: "Dependencies",
  prompt: "Upgrade the dependencies.",
  reportOnly: false,
  repositories: ["uraeda", "notes"],
  schedule: "daily 03:00",
};

/** The agent picker reads the fate client, which only its open steps ask anything of. */
const client = fateClients({ fetch: async () => new Response("{}") })("uraeda");

function around(children: ReactNode) {
  return (
    <RepositoryContext.Provider value="uraeda">
      <FateClient client={client}>
        <KeysProvider>
          <ConfirmHost>{children}</ConfirmHost>
        </KeysProvider>
      </FateClient>
    </RepositoryContext.Provider>
  );
}

const common = {
  now: NOW,
  repositories: ["uraeda", "notes", "dotfiles"],
  repository: "uraeda",
  runtimes: RUNTIMES,
  zone: ZONE,
};

/** An open job's page over `job`, its writes spied; `rerender` shows it again with another job. */
function open(
  onSave = vi.fn(async (_input: unknown): Promise<string | undefined> => undefined),
  job: JobRow = JOB,
) {
  const onRun = vi.fn(async (): Promise<string | undefined> => undefined);
  const view = (shown: JobRow | undefined) =>
    around(
      <JobPageView
        {...common}
        handlers={{ onRun, onSave }}
        job={shown}
        name="Dependencies"
        renderCard={() => null}
      />,
    );
  const { rerender } = render(view(job));
  return { onRun, onSave, rerender: (next: JobRow) => rerender(view(next)) };
}

const field = (name: string) => screen.getByRole("textbox", { name });

/** Leaves the field, as a tap elsewhere does. */
const leave = (element: HTMLElement) => act(async () => void fireEvent.focusOut(element));

test("an open job's form shows what the file holds", () => {
  open();
  expect(fieldText(field("Name"))).toBe("Dependencies");
  expect(fieldText(field("Prompt"))).toBe("Upgrade the dependencies.");
  expect(fieldText(field("Time"))).toBe("03:00");
  expect((screen.getByRole("checkbox", { name: "uraeda" }) as HTMLInputElement).checked).toBe(true);
  expect((screen.getByRole("checkbox", { name: "dotfiles" }) as HTMLInputElement).checked).toBe(
    false,
  );
  // Each field saves as it is left: no button, but Run now by the title.
  expect(screen.queryByRole("button", { name: "Add the job" })).toBeNull();
  expect(screen.getByRole("button", { name: "Run now" })).toBeTruthy();
  expect(screen.getByText(/Every day at 3:00/)).toBeTruthy();
});

test("a name is saved as it is left, the rest of the job as the file holds it", async () => {
  const { onSave } = open();
  await type(field("Name"), "Upgrades");
  expect(onSave).not.toHaveBeenCalled();
  await leave(field("Name"));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith({ ...INPUT, name: "Upgrades" }));
});

test("a time is saved on Enter, and a field left unchanged saves nothing", async () => {
  const { onSave } = open();
  await leave(field("Name"));
  expect(onSave).not.toHaveBeenCalled();
  await type(field("Time"), "04:30");
  await act(async () => void fireEvent.keyDown(field("Time"), { key: "Enter" }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith({ ...INPUT, schedule: "daily 04:30" }));
});

test("a refusal shows under its field with the typed text, and clears as it is edited", async () => {
  const onSave = vi.fn(async () => "A time is from 00:00 to 23:59.");
  open(onSave);
  await type(field("Time"), "25:00");
  await leave(field("Time"));
  expect(await screen.findByText("A time is from 00:00 to 23:59.")).toBeTruthy();
  expect(fieldText(field("Time"))).toBe("25:00");
  await type(field("Time"), "02:00");
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
});

test("picking Weekly writes the first day, then Monday and 04:00 write the schedule", async () => {
  const { onSave, rerender } = open();
  fireEvent.click(screen.getByRole("radio", { name: "Weekly" }));
  await waitFor(() =>
    expect(onSave).toHaveBeenLastCalledWith({ ...INPUT, schedule: "monday 03:00" }),
  );
  // The file now holds it: the day's picker shows, and the time is typed.
  rerender({
    ...JOB,
    schedule: { day: 1, hour: 3, kind: "weekly", minute: 0 },
    scheduleText: "monday 03:00",
  });
  fireEvent.click(await screen.findByRole("radio", { name: "Wed" }));
  await waitFor(() =>
    expect(onSave).toHaveBeenLastCalledWith({ ...INPUT, schedule: "wednesday 03:00" }),
  );
  await type(field("Time"), "04:00");
  await leave(field("Time"));
  await waitFor(() =>
    expect(onSave).toHaveBeenLastCalledWith({ ...INPUT, schedule: "monday 04:00" }),
  );
});

test("Hourly has no time, and writes `hourly`", async () => {
  const { onSave } = open();
  fireEvent.click(screen.getByRole("radio", { name: "Hourly" }));
  await waitFor(() => expect(onSave).toHaveBeenLastCalledWith({ ...INPUT, schedule: "hourly" }));
});

test("unticking the last repository is refused under the repositories", async () => {
  const onSave = vi.fn(async () => "A job runs in one repository at least.");
  open(onSave, { ...JOB, repositories: ["uraeda"] });
  fireEvent.click(screen.getByRole("checkbox", { name: "uraeda" }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith({ ...INPUT, repositories: [] }));
  expect(await screen.findByText("A job runs in one repository at least.")).toBeTruthy();
  // The file keeps its value: the box is ticked again.
  expect((screen.getByRole("checkbox", { name: "uraeda" }) as HTMLInputElement).checked).toBe(true);
});

test("Report only is saved at once", async () => {
  const { onSave } = open();
  fireEvent.click(screen.getByRole("switch", { name: "Report only" }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith({ ...INPUT, reportOnly: true }));
});

test("Default takes the agent, the model, and the effort off the job", async () => {
  const { onSave } = open();
  fireEvent.click(screen.getByRole("button", { name: "Default" }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  const [saved] = onSave.mock.calls[0] as [Record<string, unknown>];
  expect(saved).toEqual({
    name: "Dependencies",
    prompt: "Upgrade the dependencies.",
    reportOnly: false,
    repositories: ["uraeda", "notes"],
    schedule: "daily 03:00",
  });
  expect("agent" in saved || "model" in saved || "effort" in saved).toBe(false);
});

test("a job with no agent of its own offers no Default", () => {
  open(undefined, { ...JOB, agent: null, effort: null, model: null });
  expect(screen.queryByRole("button", { name: "Default" })).toBeNull();
});

test("Run now runs the job, and a refusal shows by the title", async () => {
  const { onRun } = open();
  onRun.mockResolvedValueOnce("“Dependencies” still runs here.");
  fireEvent.click(screen.getByRole("button", { name: "Run now" }));
  expect(await screen.findByText("“Dependencies” still runs here.")).toBeTruthy();
});

test("a name that no job has reads as the app's missing page", () => {
  open(undefined, JOB);
  cleanup();
  render(
    around(
      <JobPageView
        {...common}
        handlers={{ onRun: async () => undefined, onSave: async () => undefined }}
        job={undefined}
        name="Nobody"
        renderCard={() => null}
      />,
    ),
  );
  expect(screen.getByText("No job “Nobody” here.")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Open Jobs" })).toBeTruthy();
  expect(screen.queryByRole("textbox")).toBeNull();
});

/** A new job's page, its add spied. */
function added(onSave = vi.fn(async (_input: unknown): Promise<string | undefined> => undefined)) {
  render(around(<NewJobPageView {...common} onSave={onSave} />));
  return onSave;
}

const addButton = () => screen.getByRole("button", { name: "Add the job" }) as HTMLButtonElement;

test("a new job starts Daily at 03:00 in this repository, and needs a name and a prompt", async () => {
  added();
  expect(fieldText(field("Time"))).toBe("03:00");
  expect((screen.getByRole("checkbox", { name: "uraeda" }) as HTMLInputElement).checked).toBe(true);
  expect((screen.getByRole("checkbox", { name: "notes" }) as HTMLInputElement).checked).toBe(false);
  expect(screen.getByRole("radio", { name: "Daily" }).getAttribute("aria-checked")).toBe("true");
  expect(screen.queryByRole("button", { name: "Run now" })).toBeNull();
  expect(addButton().disabled).toBe(true);
  await type(field("Name"), "Dependencies");
  expect(addButton().disabled).toBe(true);
  await type(field("Prompt"), "Upgrade the dependencies.");
  expect(addButton().disabled).toBe(false);
});

test("a new job is added with its form as written, and a refusal shows under its field", async () => {
  const onSave = vi.fn(async (_input: unknown) => "A job named “Dependencies” exists already.");
  added(onSave);
  await type(field("Name"), "Dependencies");
  await type(field("Prompt"), "Upgrade the dependencies.");
  fireEvent.click(screen.getByRole("checkbox", { name: "notes" }));
  fireEvent.click(addButton());
  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith({
      name: "Dependencies",
      prompt: "Upgrade the dependencies.",
      reportOnly: false,
      repositories: ["uraeda", "notes"],
      schedule: "daily 03:00",
    }),
  );
  expect(await screen.findByText("A job named “Dependencies” exists already.")).toBeTruthy();
  // The form keeps what was typed.
  expect(fieldText(field("Name"))).toBe("Dependencies");
});

const RUN = {
  at: new Date(2026, 10, 10, 3).toISOString(),
  due: new Date(2026, 10, 10, 3).toISOString(),
  folder: "2026-11-10-upgrade-three",
  id: "1",
  outcome: "started" as const,
  reason: null,
  session: "s1",
  title: "Upgrade three dependencies",
  trigger: "schedule" as const,
};

test("the history says each time, its card, and what a skipped time was for", () => {
  const runs = [
    {
      ...RUN,
      at: new Date(2026, 10, 11, 3).toISOString(),
      folder: null,
      id: "3",
      outcome: "skipped" as const,
      reason: "change-open" as const,
      session: null,
      title: null,
    },
    {
      ...RUN,
      at: new Date(2026, 10, 11, 1).toISOString(),
      folder: null,
      id: "4",
      outcome: "skipped" as const,
      reason: "working" as const,
      session: null,
      title: null,
    },
    {
      ...RUN,
      at: new Date(2026, 10, 9, 17, 42).toISOString(),
      due: null,
      folder: null,
      id: "2",
      title: "Dependencies",
      trigger: "manual" as const,
    },
    RUN,
  ];
  render(
    around(
      <JobHistory
        now={NOW}
        renderCard={(run) => <span>{`card of ${run.session}`}</span>}
        runs={runs}
        zone={ZONE}
      />,
    ),
  );
  const items = screen.getAllByRole("listitem");
  expect(items).toHaveLength(4);
  // Newest first, as the record gives them.
  expect(
    within(items[0]).getByText("Skipped: the change “Upgrade three dependencies” is still open."),
  ).toBeTruthy();
  expect(within(items[0]).getByText("Yesterday at 3:00")).toBeTruthy();
  expect(within(items[1]).getByText("Skipped: its last run still works.")).toBeTruthy();
  expect(within(items[2]).getByText("card of s1")).toBeTruthy();
  expect(within(items[2]).getByText("Started by “Run now”.")).toBeTruthy();
  expect(within(items[3]).queryByText("Started by “Run now”.")).toBeNull();
});

test("a skipped time names the change of the run before it, or says a change is open", () => {
  const skipped = { ...RUN, outcome: "skipped" as const, reason: "change-open" as const };
  expect(skippedWords(skipped, [RUN])).toBe(
    "Skipped: the change “Upgrade three dependencies” is still open.",
  );
  expect(skippedWords(skipped, [])).toBe("Skipped: a change it started is still open.");
  expect(skippedWords({ ...skipped, reason: "working" }, [RUN])).toBe(
    "Skipped: its last run still works.",
  );
});
