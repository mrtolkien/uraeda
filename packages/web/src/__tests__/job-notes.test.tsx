// The schedule row's note on a job's page: the schedule in words, then the next run's words, each
// sentence ending in one full stop, whether the text is a fragment ("Next run tomorrow at 3:00") or
// a sentence of the server's, which ends in its own.
import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vite-plus/test";
import { atWidth } from "./helpers.tsx";
import { JOB, open } from "./job-page-fixtures.tsx";

beforeEach(() => atWidth(1440));
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

const note = () => screen.getByText(/^Every day at 3:00\./).textContent;

test("a sentence of the server's gets no second full stop", () => {
  open(undefined, {
    ...JOB,
    next: {
      at: null,
      text: "Not running here: Claude Code is off in this repository.",
      why: "agent-off",
    },
  });
  expect(note()).toBe(
    "Every day at 3:00. Not running here: Claude Code is off in this repository.",
  );
});

test("a problem that is a sentence of its own ends once, as a note too", () => {
  open(undefined, {
    ...JOB,
    next: { at: null, text: null, why: "paused" },
    problem: "“notes” is not in Uraeda's list.",
  });
  expect(note()).toBe("Every day at 3:00. Paused. “notes” is not in Uraeda's list.");
});

test("a fragment of the core's problem gets its full stop", () => {
  open(undefined, {
    ...JOB,
    next: { at: null, text: null, why: "problem" },
    problem: "Not running: the schedule “dayly 06:00” is not understood",
    schedule: null,
    scheduleText: "dayly 06:00",
  });
  expect(screen.getByText(/Not running: the schedule/).textContent).toBe(
    "Not running: the schedule “dayly 06:00” is not understood.",
  );
});

test("the next run's words are lowered after `Next run` only for Today, Tomorrow, and Yesterday", () => {
  // NOW is Thursday 12 November 2026, 10:30 (the fixtures'), so Monday is beyond tomorrow.
  open(undefined, {
    ...JOB,
    next: { at: new Date(2026, 10, 16, 4).toISOString(), text: null, why: null },
    schedule: { day: 1, hour: 4, kind: "weekly", minute: 0 },
    scheduleText: "monday 04:00",
  });
  expect(screen.getByText(/^Every Monday at 4:00\./).textContent).toBe(
    "Every Monday at 4:00. Next run Monday 16 November at 4:00.",
  );
});

test("a run tomorrow reads `Next run tomorrow at 3:00`", () => {
  open();
  expect(note()).toBe("Every day at 3:00. Next run tomorrow at 3:00.");
});
