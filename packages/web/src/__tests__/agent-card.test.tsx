// A sub-agent's card: its title, its time, its line, and its facts, each present once; a link
// whole when it has a page, named in full words; and a fact that is unknown left out, with no
// separator standing alone.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vite-plus/test";
import { AgentCard, AgentCards, lasted, Times, timesText, Unit } from "../runs/AgentCard.tsx";
import { atWidth } from "./helpers.tsx";

beforeEach(() => atWidth(1440));
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

const STARTED = "2026-10-17T15:09:00";
const NOW = new Date("2026-10-17T15:21:40").getTime();
const ENDED = { at: new Date("2026-10-17T15:17:00").getTime() };

test("how long it ran: to its end, to now while it runs, and nothing when its end is unknown", () => {
  expect(lasted(STARTED, ENDED, NOW)).toBe("8 min");
  expect(lasted(STARTED, "running", NOW)).toBe("12 min");
  expect(lasted(STARTED, "unknown", NOW)).toBeUndefined();
  // From an hour on, in hours, never in hundreds of minutes.
  expect(lasted(STARTED, "running", new Date("2026-10-17T17:14:00").getTime())).toBe("2 h 05 min");
});

test("its times in words: its start, then its end, that it runs, or nothing more", () => {
  expect(timesText(STARTED, ENDED, NOW)).toBe("started 15:09, ended 15:17");
  expect(timesText(STARTED, "running", NOW)).toBe("started 15:09, still running");
  expect(timesText(STARTED, "unknown", NOW)).toBe("started 15:09");
});

test("a start on another day than now reads with its day", () => {
  const later = new Date("2026-10-18T09:00:00").getTime();
  expect(timesText(STARTED, ENDED, later)).toBe("started Oct 17, 15:09, ended 15:17");
});

test("a card with a page is one link, named in full words, holding every part", () => {
  render(
    <AgentCards label="Sub-sessions" order={["one"]}>
      <AgentCard
        duration="8 min"
        href="/sessions/one"
        isWorking={false}
        line={<Unit>Implementer</Unit>}
        mark={null}
        name="Done, Implementer, Task 4"
        rowKey="one"
        title="Task 4"
      >
        <Times ending={ENDED} now={NOW} startedAt={STARTED} />
      </AgentCard>
    </AgentCards>,
  );
  const links = screen.getAllByRole("link");
  expect(links).toHaveLength(1);
  const [link] = links;
  expect(link!.getAttribute("aria-label")).toBe("Done, Implementer, Task 4");
  expect(link!.getAttribute("href")).toBe("/sessions/one");
  for (const text of ["Task 4", "8 min", "Implementer", "15:09", "15:17"]) {
    expect(link!.textContent).toContain(text);
  }
  expect(link!.textContent).not.toContain("·");
  expect(screen.getByRole("list", { name: "Sub-sessions" })).toBeTruthy();
});

test("a card without a page is no link, and says that it runs", () => {
  render(
    <AgentCards label="The session's sub-agents" order={["one"]}>
      <AgentCard isWorking mark={null} rowKey="one" title="Find the due date">
        <Times ending="running" now={NOW} startedAt={STARTED} />
      </AgentCard>
    </AgentCards>,
  );
  expect(screen.queryByRole("link")).toBeNull();
  const item = screen.getByRole("listitem");
  expect(item.textContent).toContain("Find the due date");
  expect(item.textContent).toContain("15:09");
  expect(item.textContent).toContain("running");
});

test("an end that is unknown shows the start alone", () => {
  render(<Times ending="unknown" now={NOW} startedAt={STARTED} />);
  expect(document.body.textContent).toBe("15:09");
});
