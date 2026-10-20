// US7: home as a control hub, its counts, then its cards, on the fixture repository.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { screen, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import {
  atRepo,
  atWidth,
  click,
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

/** A count of home's top, by its name or its place: its whole text, its number included. */
async function count(name: string | number) {
  const page = await main();
  if (typeof name === "number") {
    return (await page.findAllByRole("group"))[name]?.textContent;
  }
  return (await page.findByRole("group", { name })).textContent;
}

/**
 * The card of what waits on the human, which comes first: found by its place and its rows' actions,
 * not by its heading's words, which a rename changes.
 */
async function needsCard() {
  const page = await main();
  await page.findAllByRole("link", { name: /Web UI for the workflow files/ });
  return within((await page.findAllByRole("region"))[0]);
}

/** A card of home, by its heading, which names it: its heading and its rows. */
async function card(title: string | RegExp) {
  return within(await (await main()).findByRole("region", { name: title }));
}

/** The names of the links of a card's list, in order. */
function links(list: HTMLElement) {
  return within(list)
    .getAllByRole("link")
    .map((link) => link.textContent);
}

/** A list's row holding a link named `name`: its link, and the row with its badge and line. */
function row(list: HTMLElement, name: RegExp) {
  const link = within(list).getByRole("link", { name });
  return { link, row: within(link.closest("li") as HTMLElement) };
}

/** The headings of home's cards, in the page's order. */
async function headings() {
  const page = await main();
  await needsCard();
  return page.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
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

/** US7 1 */
test("shows the four counts, then the cards in their order", async () => {
  await renderPage();

  // The tests' fixture: three features at a gate and one agent's, where Storybook's, with its
  // checkouts of the story embeds, has four and four (R15).
  expect(await count(0)).toMatch(/^\D+3\D/);
  expect(await count("Agents")).toMatch(/^Agents1/);
  // The four entries of Now are started, so none waits.
  expect(await count("Now")).toMatch(/^Now04 ongoing/);
  expect(await count("Inbox")).toMatch(/^Inbox10/);
  expect(await headings()).toEqual([
    expect.any(String),
    expect.stringMatching(/^Agents at work/),
    "Recently done",
    expect.stringMatching(/^Priorities/),
    expect.stringMatching(/^Inbox/),
  ]);
  const decisions = (await main()).getByRole("link", { name: /Constitution and decisions/ });
  expect(decisions.getAttribute("href")).toBe(atRepo("/decisions"));
});

/** US7 1: what needs the human, by action, with the block's line. */
test("Needs you lists what waits on the human, by action", async () => {
  await renderPage();

  const needs = await needsCard();
  const list = needs.getByRole("list");
  const web = row(list, /Web UI for the workflow files/).row;
  expect(web.getByText("Answer")).toBeTruthy();
  expect(
    web.getByText("3 questions and 1 follow-up on the web UI, about 35 minutes."),
  ).toBeTruthy();
  expect(row(list, /Recurring tasks/).row.getByText("Review")).toBeTruthy();
});

/** US7 1: the agents at work, with their step. */
test("Agents at work lists what agents work on, with their step", async () => {
  await renderPage();

  const agents = await card(/^Agents at work/);
  const tuis = row(agents.getByRole("list", { name: "Agents at work" }), /CLI TUIs/);
  expect(tuis.row.getByText("Plan")).toBeTruthy();

  await click(tuis.link);

  expect(window.location.pathname).toBe(atRepo("/f/2026-10-12-cli-tuis"));
});

/** US7 2 */
test("Priorities lists Now, the started entries with their step", async () => {
  await renderPage();

  const priorities = await card(/^Priorities/);
  expect(priorities.getByRole("radio", { name: "Now" }).getAttribute("aria-checked")).toBe("true");
  const now = priorities.getByRole("list", { name: "Now" });
  expect(links(now)).toHaveLength(4);
  const web = row(now, /Web UI for the workflow files/);
  expect(web.row.getByText("Answer questions")).toBeTruthy();
  expect(web.link.getAttribute("href")).toBe(atRepo("/f/2026-10-11-web-ui"));
  expect(priorities.queryByText("Claude Code runner (triggered manually)")).toBeNull();
});

/** R10: a running entry of another section shows in Now, and not in its own section. */
test("a running entry of Next shows first in Now", async () => {
  const repo = fixtureRepo();
  writeFileSync(
    join(repo, "specs/PRIORITIES.md"),
    read(repo)
      .replace("- [CLI TUIs](/specs/2026-10-12-cli-tuis/proposal.md)\n", "")
      .replace("## Next\n\n", "## Next\n\n- [CLI TUIs](/specs/2026-10-12-cli-tuis/proposal.md)\n"),
  );
  await renderPage("/", repo);

  const priorities = await card(/^Priorities/);
  const now = priorities.getByRole("list", { name: "Now" });
  expect(links(now)).toContain("CLI TUIs");
  await click(priorities.getByRole("radio", { name: "Next" }));
  const next = priorities.getByRole("list", { name: "Next" });
  expect(links(next).join()).not.toContain("CLI TUIs");
});

/** US7 3 */
test("Next lists Next's entries, drafts marked, and stays chosen after a reload", async () => {
  const { repo } = await renderPage();

  await click((await card(/^Priorities/)).getByRole("radio", { name: "Next" }));

  const next = (await card(/^Priorities/)).getByRole("list", { name: "Next" });
  const runner = row(next, /Claude Code runner/).link;
  expect(runner.getAttribute("href")).toBe(
    atRepo("/priorities/claude-code-runner-triggered-manually"),
  );
  const listener = row(next, /Git listener process/);
  expect(listener.row.getByText("Draft")).toBeTruthy();
  expect(listener.link.getAttribute("href")).toBe(atRepo("/priorities/git-listener"));
  expect(window.localStorage.getItem("uraeda:home:priorities")).toBe("next");

  await renderPage("/", repo, { reload: true });

  const again = await card(/^Priorities/);
  expect(again.getByRole("radio", { name: "Next" }).getAttribute("aria-checked")).toBe("true");
  expect(again.getByRole("list", { name: "Next" })).toBeTruthy();
});

/** US7 4 */
test("the Priorities title opens the priorities, the Inbox title the inbox", async () => {
  await renderPage();
  const page = await main();

  const title = await page.findByRole("heading", { level: 2, name: /^Priorities, open/ });
  const priorities = within(title).getByRole("link", { name: /^Priorities, open/ });
  expect(priorities.getAttribute("href")).toBe(atRepo("/priorities"));
  // The inbox's title, with its count, as the link's name.
  const inbox = within(page.getByRole("heading", { name: /^Inbox/ })).getByRole("link");
  expect(inbox.textContent).toMatch(/^Inbox10/);
  expect(inbox.getAttribute("href")).toBe(atRepo("/inbox"));

  await click(priorities);

  expect(window.location.pathname).toBe(atRepo("/priorities"));
});

/** US7 5 */
test("the Inbox card shows the categories, the three latest notes, and no Organize link", async () => {
  await renderPage();

  const inbox = await card(/^Inbox/);
  expect(inbox.getByText("Not sorted 3")).toBeTruthy();
  expect(inbox.getByText("UI 5")).toBeTruthy();
  expect(inbox.getByText("CLI 2")).toBeTruthy();
  expect(links(inbox.getByRole("list", { name: "Latest notes" }))).toEqual([
    "We need a home icon",
    "We'll need a model selector for each step",
    "Specs are still way too long and hard to read",
  ]);
  expect((await main()).queryByRole("link", { name: /Organize/ })).toBeNull();
  expect((await main()).queryByText(/Organize/)).toBeNull();
});

/** US7 6 */
test("Recently done lists the five latest, and Show all (7) lists all seven", async () => {
  await renderPage("/", withDone(5));

  const done = await card("Recently done");
  const list = done.getByRole("list", { name: "Recently done" });
  // Latest first: a folder's name starts with its date.
  expect(links(list)).toEqual([
    "Stack decision",
    "CLI core features",
    "Done 5",
    "Done 4",
    "Done 3",
  ]);

  await click(done.getByRole("button", { name: "Show all (7)" }));

  expect(links(list)).toHaveLength(7);
  expect(links(list).at(-1)).toBe("Done 1");
  expect(done.queryByRole("button", { name: /Show all/ })).toBeNull();
});

/** R19: the sidebar's "All done features and changes" opens home at #done, every one listed. */
test("at #done, Recently done lists all seven", async () => {
  await renderPage("/#done", withDone(5));

  const done = await card("Recently done");

  expect(links(done.getByRole("list", { name: "Recently done" }))).toHaveLength(7);
  expect(done.queryByRole("button", { name: /Show all/ })).toBeNull();
});

/** US7 7 */
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

  const first = within((await (await main()).findAllByRole("region"))[0]);
  expect(await first.findByText("Nothing waits on you.")).toBeTruthy();
  expect(await count(0)).toMatch(/^\D+0\D/);
});

/** US7 8 */
test("on a phone, the counts and the cards come in the same order", async () => {
  atWidth(402);
  try {
    await renderPage();

    const counts = (await (await main()).findAllByRole("group")).map((group) =>
      group.getAttribute("aria-label"),
    );
    expect(counts).toEqual([expect.any(String), "Agents", "Now", "Inbox"]);
    expect(await headings()).toEqual([
      expect.any(String),
      expect.stringMatching(/^Agents at work/),
      "Recently done",
      expect.stringMatching(/^Priorities/),
      expect.stringMatching(/^Inbox/),
    ]);
  } finally {
    atWidth(1024);
  }
});

/** Edge case: an empty inbox. */
test("the Inbox card says when the inbox is empty, its count 0", async () => {
  const repo = fixtureRepo();
  writeFileSync(join(repo, "specs/INBOX.md"), "# Inbox\n\n## UI\n");
  await renderPage("/", repo);

  expect((await card(/^Inbox/)).getByText("The inbox is empty.")).toBeTruthy();
  expect(await count("Inbox")).toMatch(/^Inbox0/);
});

/** Edge case: an empty section of the priorities. */
test("the Priorities card says when Next is empty", async () => {
  const repo = fixtureRepo();
  writeFileSync(
    join(repo, "specs/PRIORITIES.md"),
    read(repo).replace(
      "- Claude Code runner (triggered manually)\n- [Git listener process](drafts/git-listener.md)\n\n",
      "",
    ),
  );
  await renderPage("/", repo);

  await click((await card(/^Priorities/)).getByRole("radio", { name: "Next" }));

  expect((await card(/^Priorities/)).getByText("Nothing in Next.")).toBeTruthy();
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
  const priorities = await card(/^Priorities/);
  priorities.getByRole("link", { name: /Plan review/ });
  writeFileSync(
    join(repo, "specs/PRIORITIES.md"),
    read(repo).replace("[Plan review]", "[Plan reviews]"),
  );

  // No live update reaches these tests: the page shows the change only by reading it again.
  await refreshUntil(() =>
    expect(priorities.getByRole("link", { name: /Plan reviews/ })).toBeTruthy(),
  );
});

/** US6 1 */
test("a feature with a format note stays under Agents at work", async () => {
  // A plan of the tests' utilities has no "## Waves": `ura check` finds the section missing.
  const repo = fixtureRepo();
  addPlan(repo, "2026-10-13-plan-review", ELEVEN);
  git(repo, "switch", "--quiet", "2026-10-13-plan-review");
  await renderPage("/", repo);

  const agents = await card(/^Agents at work/);
  expect(row(agents.getByRole("list", { name: "Agents at work" }), /Plan review/)).toBeTruthy();
  expect((await main()).queryByText("Fix")).toBeNull();
});

/** US6 2 */
test("a spec whose status cannot be read needs a fix", async () => {
  const repo = fixtureRepo();
  const spec = "specs/2026-10-12-cli-tuis/spec.md";
  const text = readFileSync(fixture(`repo/branches/2026-10-12-cli-tuis/${spec}`), "utf8");
  commitOnBranch(repo, "2026-10-12-cli-tuis", {
    [spec]: text.replace("status: approved", "status: aproved"),
  });
  await renderPage("/", repo);

  const needs = await needsCard();
  const tuis = row(needs.getByRole("list"), /CLI TUIs/);
  expect(tuis.row.getByText("Fix")).toBeTruthy();
});
