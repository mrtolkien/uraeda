// A job's page and a new job's (US5): the form saves each field as it is left, or on Enter for a
// line, through `onSave`, which answers the refusal in words, shown under its field with the typed
// text kept; a new job is added by one button once its name and prompt are filled, with Daily at
// 03:00 and this repository ticked; a name no job has reads as the app's missing page. The real
// components over fixed jobs, in the key registry, with no server: the data is the Jobs record's.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { JobHistory, skippedWords } from "../jobs/JobHistory.tsx";
import { JobPageView, NewJobPageView } from "../jobs/JobPage.tsx";
import { atWidth, fieldText, type } from "./helpers.tsx";
import { around, common, INPUT, JOB, NOW, open, ZONE } from "./job-page-fixtures.tsx";

beforeEach(() => atWidth(1440));
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

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
  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith({ ...INPUT, name: "Upgrades" }, "Dependencies"),
  );
});

test("a time is saved on Enter, and a field left unchanged saves nothing", async () => {
  const { onSave } = open();
  await leave(field("Name"));
  expect(onSave).not.toHaveBeenCalled();
  await type(field("Time"), "04:30");
  await act(async () => void fireEvent.keyDown(field("Time"), { key: "Enter" }));
  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith({ ...INPUT, schedule: "daily 04:30" }, "Dependencies"),
  );
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

test("picking Weekly writes the first day, then Wednesday and 04:00 write the schedule", async () => {
  const { onSave, rerender } = open();
  fireEvent.click(screen.getByRole("radio", { name: "Weekly" }));
  await waitFor(() =>
    expect(onSave).toHaveBeenLastCalledWith({ ...INPUT, schedule: "monday 03:00" }, "Dependencies"),
  );
  // The file now holds it: the day's picker shows, and the time is typed.
  rerender({
    ...JOB,
    schedule: { day: 1, hour: 3, kind: "weekly", minute: 0 },
    scheduleText: "monday 03:00",
  });
  fireEvent.click(await screen.findByRole("radio", { name: "Wed" }));
  await waitFor(() =>
    expect(onSave).toHaveBeenLastCalledWith(
      { ...INPUT, schedule: "wednesday 03:00" },
      "Dependencies",
    ),
  );
  rerender({
    ...JOB,
    schedule: { day: 3, hour: 3, kind: "weekly", minute: 0 },
    scheduleText: "wednesday 03:00",
  });
  await type(field("Time"), "04:00");
  await leave(field("Time"));
  await waitFor(() =>
    expect(onSave).toHaveBeenLastCalledWith(
      { ...INPUT, schedule: "wednesday 04:00" },
      "Dependencies",
    ),
  );
});

test("Hourly has no time, and writes `hourly`", async () => {
  const { onSave } = open();
  fireEvent.click(screen.getByRole("radio", { name: "Hourly" }));
  await waitFor(() =>
    expect(onSave).toHaveBeenLastCalledWith({ ...INPUT, schedule: "hourly" }, "Dependencies"),
  );
});

test("unticking the last repository is refused under the repositories", async () => {
  const onSave = vi.fn(async () => "A job runs in one repository at least.");
  open(onSave, { ...JOB, repositories: ["uraeda"] });
  fireEvent.click(screen.getByRole("checkbox", { name: "uraeda" }));
  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith({ ...INPUT, repositories: [] }, "Dependencies"),
  );
  expect(await screen.findByText("A job runs in one repository at least.")).toBeTruthy();
  // The file keeps its value: the box is ticked again.
  expect((screen.getByRole("checkbox", { name: "uraeda" }) as HTMLInputElement).checked).toBe(true);
});

test("Report only is saved at once", async () => {
  const { onSave } = open();
  fireEvent.click(screen.getByRole("switch", { name: "Report only" }));
  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith({ ...INPUT, reportOnly: true }, "Dependencies"),
  );
});

test("Default takes the agent, the model, and the effort off the job", async () => {
  const { onSave } = open();
  fireEvent.click(screen.getByRole("button", { name: "Default" }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  const saved = onSave.mock.calls[0]?.[0] as Record<string, unknown>;
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
function added(
  onSave = vi.fn(async (_input: unknown, _was: string): Promise<string | undefined> => undefined),
) {
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
  const onSave = vi.fn(
    async (_input: unknown, _was: string) => "A job named “Dependencies” exists already.",
  );
  added(onSave);
  await type(field("Name"), "Dependencies");
  await type(field("Prompt"), "Upgrade the dependencies.");
  fireEvent.click(screen.getByRole("checkbox", { name: "notes" }));
  fireEvent.click(addButton());
  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith(
      {
        name: "Dependencies",
        prompt: "Upgrade the dependencies.",
        reportOnly: false,
        repositories: ["uraeda", "notes"],
        schedule: "daily 03:00",
      },
      "",
    ),
  );
  expect(await screen.findByText("A job named “Dependencies” exists already.")).toBeTruthy();
  // The form keeps what was typed.
  expect(fieldText(field("Name"))).toBe("Dependencies");
});

const RUN = {
  at: new Date(2026, 10, 10, 3).toISOString(),
  blockedBy: null,
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
      blockedBy: { folder: "2026-11-10-upgrade-three", title: "Upgrade three dependencies" },
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

test("a skipped time names the change the record says blocked it, or says a change is open", () => {
  const skipped = { ...RUN, outcome: "skipped" as const, reason: "change-open" as const };
  // The change's own title, not the run's session's, and no run's folder is read for it.
  expect(
    skippedWords({
      ...skipped,
      blockedBy: { folder: "2026-11-09-other", title: "Upgrade three dependencies" },
      title: "Dependencies",
    }),
  ).toBe("Skipped: the change “Upgrade three dependencies” is still open.");
  expect(skippedWords(skipped)).toBe("Skipped: a change it started is still open.");
  expect(skippedWords({ ...skipped, reason: "working" })).toBe(
    "Skipped: its last run still works.",
  );
});

test("a started run with no card says its session is gone", () => {
  render(
    around(
      <JobHistory now={NOW} renderCard={() => null} runs={[{ ...RUN, title: null }]} zone={ZONE} />,
    ),
  );
  expect(screen.getByText("Its session is gone.")).toBeTruthy();
});
