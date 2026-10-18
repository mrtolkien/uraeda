// US4: a change's session has a column of its own: its step, its round or its pull request, the
// files changed on its branch, and its files (US4.1–US4.3). Its page is a feature's page (US3.1 of
// the feature page redesign). The sidebar tags its row "Change" (US4.4), and the phone's progress
// line names its round (US4.5). Its session passes the UI checks at both sizes, in light and dark.
import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import {
  agent,
  atRepo,
  atSize,
  checkLayout,
  drawn,
  grown,
  LIVE,
  show,
  startTurn,
  colorScheme,
} from "./helpers.tsx";

const CENTRED = "2026-10-16-centred-x";
const CENTRED_TITLE = "Centre the x in failure circles";
const LOGO = "2026-10-16-header-logo";
const LOGO_TITLE = "A home logo in the header";

/** A round of one question, waiting on the human. */
const ROUND = `---
status: awaiting-human
---

# Clarifications, round 01: ${LOGO_TITLE}

> [!IMPORTANT]
>
> 1 question on the header, about 2 minutes.

## Context

The [proposal](proposal.md) asks for a logo in the header.

## Q1: Does the logo replace the repository's name at 402 px?

Why it matters: the header has no room for both.

- **A (recommended). The logo replaces the name.**
  - [pro] it fits.
- **B. The name stays, without a logo.**
  - [con] no logo on phones.

**Answer:**
`;

/** The record of the finished change, its pull request #31. */
const RECORD = `---
kind: change
finished: 2026-10-16
pull-request: https://github.com/o/r/pull/31
---

# Record: ${CENTRED_TITLE}

> [!NOTE]
>
> The record of a merged change, not instructions to follow.

## What and why

The x sat low in its circle.

## Behaviour

- The x is centred.

## Design

The glyph is centred on its box.
`;

afterEach(() => {});

/** The change `centred-x`, with only its proposal. */
async function centred() {
  await agent.addChange(CENTRED, { "proposal.md": `# ${CENTRED_TITLE}\n` });
}

/** The change `header-logo`, waiting on its first round. */
async function headerLogo() {
  await agent.addChange(LOGO, {
    "clarifications-01.md": ROUND,
    "proposal.md": `# ${LOGO_TITLE}\n`,
  });
}

/** The column, by its landmark. */
async function column() {
  return within(await screen.findByRole("complementary", { name: "Progress" }, LIVE));
}

/** The column's section headings, in order. */
function headings() {
  const aside = screen.getByRole("complementary", { name: "Progress" });
  return within(aside)
    .getAllByRole("heading", { level: 2 })
    .map((heading) => heading.textContent);
}

describe("on the desktop", () => {
  atSize("desktop");

  // US3.1 of the feature page redesign: a change opens the same page as a feature.
  test("a change's page is a feature's page, with Fix and its session", async () => {
    await centred();
    await show(`/f/${CENTRED}`, "Open the session");

    expect(screen.getByRole("heading", { level: 1, name: CENTRED_TITLE })).toBeTruthy();
    const stages = within(screen.getByRole("list", { name: "Stages" }));
    expect(stages.getByText("Fix")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Open the session" })).toHaveLength(1);
    expect(screen.queryByRole("textbox", { name: "Message Claude Code" })).toBeNull();
  });

  // US4.1
  test("a change's session has its column", async () => {
    await centred();
    await show(`/f/${CENTRED}/session`, CENTRED_TITLE);

    expect(screen.getByRole("heading", { level: 1, name: CENTRED_TITLE })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Message Claude Code" })).toBeTruthy();
    const aside = await column();
    await aside.findByText("Nothing outside the change's folder yet.", undefined, LIVE);
    expect(headings()).toEqual(["Change", "Changed on the branch", "Files"]);
    expect(aside.getByText("The agent is working.")).toBeTruthy();
    const files = aside.getByRole("list", { name: "Files" });
    expect(within(files).getByRole("link", { name: "proposal.md" }).getAttribute("href")).toBe(
      atRepo(`/f/${CENTRED}/proposal.md`),
    );
    expect(aside.queryByText("Feature page")).toBeNull();
    expect(aside.queryByText("No plan yet.")).toBeNull();
  });

  // US4.2
  test("a change waiting on a round links it from its column", async () => {
    await headerLogo();
    await show(`/f/${LOGO}/session`, LOGO_TITLE);

    const aside = await column();
    await aside.findByText("1 question", undefined, LIVE);
    expect(headings()[0]).toBe("Answer questions");
    expect(aside.getByRole("link", { name: "Questions, round 01" }).getAttribute("href")).toBe(
      atRepo(`/f/${LOGO}/clarifications-01.md`),
    );
    expect(aside.getByText("Nothing outside the change's folder yet.")).toBeTruthy();
  });

  // US4.3
  test("a finished change links its pull request", async () => {
    await centred();
    await agent.commitOnBranch(`change/${CENTRED}`, {
      [`specs/changes/${CENTRED}/proposal.md`]: null,
      [`specs/done/${CENTRED}.md`]: RECORD,
    });
    await show(`/f/${CENTRED}/session`, CENTRED_TITLE);

    const aside = await column();
    const link = await aside.findByRole("link", { name: "Pull request #31" }, LIVE);
    expect(link.getAttribute("href")).toBe("https://github.com/o/r/pull/31");
    expect(headings()[0]).toBe("Pull request state unknown");
    const files = aside.getByRole("list", { name: "Files" });
    expect(
      within(files)
        .getAllByRole("link")
        .map((row) => row.textContent),
    ).toEqual([`${CENTRED}.md`]);
  });

  // US4.4: the tag is for Needs you, where changes and features share a section; the Changes
  // section needs none, and the name says it.
  test("the sidebar names a change, in its own section", async () => {
    await centred();
    await show(`/f/${CENTRED}/session`, CENTRED_TITLE);
    await startTurn("Carry on.", [{ text: "Investigating.", type: "text" }]);

    const nav = within(screen.getByRole("navigation", { name: "Side navigation" }));
    const row = await nav.findByRole(
      "link",
      { name: new RegExp(`^centred-x, ${CENTRED_TITLE}, change, .+, Working`) },
      LIVE,
    );
    expect(row.getAttribute("href")).toBe(atRepo(`/f/${CENTRED}`));
    expect(row.textContent).toBe("centred-x");
    const changes = nav.getByRole("group", { name: "Changes" });
    expect(changes.contains(row)).toBe(true);
    expect(within(changes).queryByText("Change")).toBeNull();
    // A feature's name has no kind.
    const feature = nav.getByRole("link", { name: /^cli-tuis, / });
    expect(feature.getAttribute("aria-label")).not.toMatch(/change|feature/);
  });
});

describe("on the phone", () => {
  atSize("phone");

  // US4.5
  test("the phone's line names the round and its questions", async () => {
    await headerLogo();
    await show(`/f/${LOGO}/session`, LOGO_TITLE);

    const line = await screen.findByRole("button", { name: "Answer questions · 1 question" }, LIVE);
    expect(screen.queryByRole("region", { name: "Progress" })).toBeNull();
    await userEvent.click(line);
    const open = within(await screen.findByRole("region", { name: "Progress" }, LIVE));
    expect(open.getByRole("link", { name: "Questions, round 01" })).toBeTruthy();
  });
});

const MODES = (["light", "dark"] as const).map((mode) => ({ mode }));

// The UI checks on a change's session, its column shown beside it on the desktop, its line open on
// the phone, with a round and a file changed on its branch.
test.each(MODES)("a change's session, in $mode", async ({ mode }) => {
  await colorScheme(mode);
  await headerLogo();
  await agent.commitOnBranch(`change/${LOGO}`, {
    "packages/web/src/Header.tsx": "// The header.\n",
  });
  await show(`/f/${LOGO}/session`, LOGO_TITLE);
  expect(document.documentElement.getAttribute("data-theme")).toBe(mode);
  if (window.innerWidth >= 768) {
    const aside = await column();
    await aside.findByText("1 question", undefined, LIVE);
    await aside.findByText("Changed on the branch", undefined, LIVE);
    await drawn();
    await checkLayout();
    await checkLayout(screen.getByRole("complementary", { name: "Progress" }));
  } else {
    await userEvent.click(
      await screen.findByRole("button", { name: "Answer questions · 1 question" }, LIVE),
    );
    const open = await screen.findByRole("region", { name: "Progress" }, LIVE);
    await within(open).findByText("Changed on the branch", undefined, LIVE);
    await grown();
    await checkLayout();
  }
});
