// Layout and look US3: home, centred, its core above the "Overview" line, problems when there are
// any, Needs you, then In progress beside Sessions; below it, the widgets: the priorities now, the
// usage, the inbox, and what is done. On the fixture repository.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { screen, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import {
  atRepo,
  atWidth,
  click,
  fakeAgent,
  fixture,
  fixtureRepo,
  git,
  read,
  refreshUntil,
  renderPage,
} from "./helpers.tsx";
import {
  addPlan,
  commitOnBranch,
  ELEVEN,
  expectLogged,
  temporaryFolder,
} from "uraeda-binding/test-utils";

/** The page's own content, without the navigation. */
async function main() {
  return within(await screen.findByRole("main"));
}

/** The page's features, loaded: a fixture feature waiting on the human, in Needs you. */
async function loaded() {
  const page = await main();
  await page.findAllByRole("link", { name: /^Web UI for the workflow files/ });
  return page;
}

/** A pane of home, by its title. */
async function pane(title: string) {
  return within(await (await main()).findByRole("region", { name: title }));
}

/** The titles of home's panes and its "Overview" line, in the page's order, without their counts. */
async function titles() {
  const page = await loaded();
  return page
    .getAllByRole("heading")
    .map((heading) => heading.textContent?.replace(/\s*· \d+$/, "") ?? "");
}

/** The rows of a pane, by the first part of their names, their titles. */
function rows(region: ReturnType<typeof within>) {
  return region
    .queryAllByRole("link")
    .map(
      (link: HTMLElement) => link.getAttribute("aria-label")?.split(", ")[0] ?? link.textContent,
    );
}

/** A pane's row, by its title. */
function row(region: ReturnType<typeof within>, title: string) {
  return region.getByRole("link", { name: new RegExp(`^${title}`) });
}

/** The fixture repository with `count` merged features more, dated before the fixture's. */
function withDone(count: number) {
  const repo = fixtureRepo();
  for (let day = 1; day <= count; day += 1) {
    const folder = join(repo, `specs/2026-09-0${day}-done-${day}`);
    mkdirSync(folder, { recursive: true });
    writeFileSync(
      join(folder, "proposal.md"),
      `# Done ${day}\n\n## What\n\nIt.\n\n## Why\n\nSo.\n`,
    );
  }
  git(repo, "add", "--all");
  git(repo, "commit", "--quiet", "--no-verify", "--message", "chore: done features");
  return repo;
}

/** The fixture with CLI TUIs' spec unreadable: its status, misspelled, stops the workflow. */
function withProblem() {
  const repo = fixtureRepo();
  const spec = "specs/2026-10-12-cli-tuis/spec.md";
  const text = readFileSync(fixture(`repo/branches/2026-10-12-cli-tuis/${spec}`), "utf8");
  commitOnBranch(repo, "2026-10-12-cli-tuis", {
    [spec]: text.replace("status: approved", "status: aproved"),
  });
  return repo;
}

/** The order of home: the core, the line, then the widgets. */
const ORDER = [
  "Needs you",
  "In progress",
  "Sessions",
  "Overview",
  "Priorities now",
  "Usage",
  "Inbox",
  "Recent",
];

/** US3, US3 more 1: without a problem, Needs you first, the core, then Overview, then the widgets. */
test("the core comes first, then the Overview line, then the widgets", async () => {
  await renderPage();

  expect(await titles()).toEqual(ORDER);
  expect((await main()).queryByRole("region", { name: "Problems" })).toBeNull();
  expect((await main()).queryByText(/^Agents|Recently done/)).toBeNull();
});

/** US3 1: a problem that stops the workflow, in a red Problems pane above Needs you. */
test("a feature whose spec cannot be read shows first, in Problems, with its problem", async () => {
  await renderPage("/", withProblem());

  expect((await titles())[0]).toBe("Problems");
  expect((await titles())[1]).toBe("Needs you");
  const problems = await pane("Problems");
  const tuis = row(problems, "CLI TUIs");
  expect(within(tuis).getByText(/status/)).toBeTruthy();
  expect(tuis.getAttribute("href")).toBe(atRepo("/f/2026-10-12-cli-tuis"));
  // Not as a row of what waits on the human, nor of what agents do.
  expect(rows(await pane("Needs you"))).not.toContain("CLI TUIs");
  expect(rows(await pane("In progress"))).not.toContain("CLI TUIs");
});

/** Problems decision: a note, like a plan's missing section, is no problem: the feature works on. */
test("a feature with a format note stays in progress, with no Problems pane", async () => {
  // A plan of the tests' utilities has no "## Waves": `ura check` finds the section missing.
  const repo = fixtureRepo();
  addPlan(repo, "2026-10-13-plan-review", ELEVEN);
  git(repo, "switch", "--quiet", "2026-10-13-plan-review");
  await renderPage("/", repo);

  await loaded();
  expect(rows(await pane("In progress"))).toContain("Plan review");
  expect((await main()).queryByRole("region", { name: "Problems" })).toBeNull();
});

/** US3 3: the whole title, the step and the round's size on a second line, and the action. */
test("Needs you shows each feature's full title, its step and line, and its action", async () => {
  await renderPage();
  await loaded();

  const needs = await pane("Needs you");
  const web = row(needs, "Web UI for the workflow files");
  expect(within(web).getByText("Web UI for the workflow files")).toBeTruthy();
  expect(
    within(web).getByText(
      "Questions · 3 questions and 1 follow-up on the web UI, about 35 minutes.",
    ),
  ).toBeTruthy();
  expect(within(web).getByText("Answer")).toBeTruthy();
  expect(web.getAttribute("href")).toBe(atRepo("/f/2026-10-11-web-ui/clarifications-01.md"));
  expect(within(row(needs, "Recurring tasks")).getByText("Review")).toBeTruthy();
});

/** US3 more 1 */
test("Needs you says so when nothing waits on the human", async () => {
  const repo = fixtureRepo();
  for (const branch of [
    "2026-10-06-recurring-tasks",
    "2026-10-11-web-ui",
    "2026-10-13-plan-review",
  ]) {
    git(repo, "branch", "--quiet", "-D", branch);
  }
  await renderPage("/", repo);

  expect(await (await pane("Needs you")).findByText("Nothing waits on you.")).toBeTruthy();
});

/** US3: In progress, what agents work on, with their step, opening the feature. */
test("In progress lists what agents work on, with their step", async () => {
  await renderPage();
  await loaded();

  const progress = await pane("In progress");
  const tuis = row(progress, "CLI TUIs");
  expect(within(tuis).getByText(/^Plan/)).toBeTruthy();

  await click(tuis);

  expect(window.location.pathname).toBe(atRepo("/f/2026-10-12-cli-tuis"));
});

/** US3: Sessions, beside In progress, the sessions without a workflow. */
test("Sessions says when no session runs, and lists a chat with its agent", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await renderPage("/", repo, { agent: fake });
  await loaded();
  expect((await pane("Sessions")).getByText("No session running.")).toBeTruthy();

  await fake.sessions.newChat(repo);

  await refreshUntil(async () => expect(rows(await pane("Sessions"))).toHaveLength(1));
  const chat = (await pane("Sessions")).getByRole("link");
  expect(chat.getAttribute("aria-label")).toContain("Fake agent");
});

/** US3: the priorities now, Ongoing first, each with its status; the link opens the priorities. */
test("Priorities now lists Now, the started entries with their status", async () => {
  await renderPage();
  await loaded();

  const priorities = await pane("Priorities now");
  expect(rows(priorities).slice(0, 4)).toHaveLength(4);
  const web = row(priorities, "Web UI for the workflow files");
  expect(within(web).getByText(/Answer questions/)).toBeTruthy();
  expect(web.getAttribute("href")).toBe(atRepo("/f/2026-10-11-web-ui"));
  // Next's entries stay on the priorities page.
  expect(priorities.queryByText("Claude Code runner (triggered manually)")).toBeNull();

  await click(priorities.getByRole("link", { name: "Open priorities" }));

  expect(window.location.pathname).toBe(atRepo("/priorities"));
});

/** R10: a running entry of another section shows in Priorities now. */
test("a running entry of Next shows in Priorities now", async () => {
  const repo = fixtureRepo();
  writeFileSync(
    join(repo, "specs/PRIORITIES.md"),
    read(repo)
      .replace("- [CLI TUIs](/specs/2026-10-12-cli-tuis/proposal.md)\n", "")
      .replace("## Next\n\n", "## Next\n\n- [CLI TUIs](/specs/2026-10-12-cli-tuis/proposal.md)\n"),
  );
  await renderPage("/", repo);
  await loaded();

  expect(rows(await pane("Priorities now"))).toContain("CLI TUIs");
});

/** US3: the usage of the 5 h window and of the week, as the agent last reported them. */
test("Usage shows the 5 h window and the week, and no week when none was reported", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const chat = await fake.sessions.newChat(repo);
  const resetsAt = new Date(2099, 0, 1, 18, 40).toISOString();
  fake.adapter.script([
    {
      fiveHour: { percentUsed: 43, resetsAt },
      type: "usage",
      week: { percentUsed: 20, resetsAt },
    },
  ]);
  await fake.sessions.settled((await fake.sessions.send(repo, chat.id, { text: "Hello" })).turn);
  await renderPage("/", repo, { agent: fake });
  await loaded();

  const usage = await pane("Usage");
  expect(await usage.findByText("5 h window")).toBeTruthy();
  expect(usage.getByText("43% used")).toBeTruthy();
  expect(usage.getByText("Week")).toBeTruthy();
  expect(usage.getByText("20% used")).toBeTruthy();
});

/** Review focus 6: a report without the weekly window keeps the 5 h one, and shows no week. */
test("Usage shows no week, never 0%, when the report has no weekly window", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const chat = await fake.sessions.newChat(repo);
  const resetsAt = new Date(2099, 0, 1, 18, 40).toISOString();
  fake.adapter.script([{ fiveHour: { percentUsed: 43, resetsAt }, type: "usage" }]);
  await fake.sessions.settled((await fake.sessions.send(repo, chat.id, { text: "Hello" })).turn);
  await renderPage("/", repo, { agent: fake });
  await loaded();

  const usage = await pane("Usage");
  expect(await usage.findByText("43% used")).toBeTruthy();
  expect(usage.queryByText("Week")).toBeNull();
  expect(usage.queryByText(/^0%/)).toBeNull();
});

test("Usage says when no run reported it", async () => {
  await renderPage();
  await loaded();

  expect(await (await pane("Usage")).findByText("No run reported usage yet.")).toBeTruthy();
});

/** US3: the inbox's three latest notes, each with its category, and the way to the inbox. */
test("Inbox shows the three latest notes with their category, and opens the inbox", async () => {
  await renderPage();
  await loaded();

  const inbox = await pane("Inbox");
  expect(rows(inbox).slice(0, 3)).toEqual([
    "We need a home icon",
    "We'll need a model selector for each step",
    "Specs are still way too long and hard to read",
  ]);
  expect(within(row(inbox, "We need a home icon")).getByText("Not sorted")).toBeTruthy();
  expect((await main()).queryByText(/Organize/)).toBeNull();

  await click(inbox.getByRole("link", { name: "10 notes to organize" }));

  expect(window.location.pathname).toBe(atRepo("/inbox"));
});

/** Edge case: an empty inbox. */
test("Inbox says when the inbox is empty", async () => {
  const repo = fixtureRepo();
  writeFileSync(join(repo, "specs/INBOX.md"), "# Inbox\n\n## UI\n");
  await renderPage("/", repo);
  await loaded();

  expect((await pane("Inbox")).getByText("The inbox is empty.")).toBeTruthy();
  expect((await pane("Inbox")).getByRole("link", { name: "Open the inbox" })).toBeTruthy();
});

/** US3: Recent, the done items, the five latest, then all of them on Show all. */
test("Recent lists the five latest done items, and Show all (7) lists all seven", async () => {
  await renderPage("/", withDone(5));
  await loaded();

  const recent = await pane("Recent");
  // Latest first: a folder's name starts with its date.
  expect(rows(recent)).toEqual([
    "Stack decision",
    "CLI core features",
    "Done 5",
    "Done 4",
    "Done 3",
  ]);

  await click(recent.getByRole("button", { name: "Show all (7)" }));

  expect(rows(recent)).toHaveLength(7);
  expect(rows(recent).at(-1)).toBe("Done 1");
  expect(recent.queryByRole("button", { name: /Show all/ })).toBeNull();
});

/** The column's Done "…" opens home at #done, every done item listed. */
test("at #done, Recent lists all seven", async () => {
  await renderPage("/#done", withDone(5));
  await loaded();

  const recent = await pane("Recent");
  expect(rows(recent)).toHaveLength(7);
  expect(recent.queryByRole("button", { name: /Show all/ })).toBeNull();
  expect(document.getElementById("done")?.textContent).toContain("Recent");
});

/** US3 more 2 */
test("on a phone, the panes come in the same order", async () => {
  atWidth(402);
  await renderPage();

  expect(await titles()).toEqual(ORDER);
});

test("says how to set Uraeda up in a repository without specs/", async () => {
  const repo = temporaryFolder("uraeda-bare");
  git(repo, "init", "--quiet", "--initial-branch", "main");
  writeFileSync(join(repo, "README.md"), "# Bare\n");

  await renderPage("/", repo);

  expect(
    await screen.findByText(`No specs/ folder in ${repo}. Set Uraeda up with ura init.`),
  ).toBeTruthy();
});

test("says when the server cannot be reached, with a way to try again", async () => {
  // React reports the error its boundary caught: expected here, so kept from the log.
  const logged = expectLogged(
    console,
    "error",
    /Failed to fetch.*The above error occurred in the <InRepository> component/s,
  );
  await renderPage("/", undefined, {
    fetch: () => Promise.reject(new TypeError("Failed to fetch")),
  });

  expect(await screen.findByText("Could not reach the Uraeda server.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  expect(logged).toHaveBeenCalledWith(
    expect.any(String),
    new TypeError("Failed to fetch"),
    "The above error occurred in the <InRepository> component.",
    expect.stringContaining("ServerErrorBoundary"),
  );
});

test("reads the page again when it comes back to the foreground", async () => {
  const { repo } = await renderPage();
  await loaded();
  const priorities = await pane("Priorities now");
  row(priorities, "Plan review");
  writeFileSync(
    join(repo, "specs/PRIORITIES.md"),
    read(repo).replace("[Plan review]", "[Plan reviews]"),
  );

  // No live update reaches these tests: the page shows the change only by reading it again.
  await refreshUntil(() => expect(row(priorities, "Plan reviews")).toBeTruthy());
});
