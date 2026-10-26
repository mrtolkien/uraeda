// US4: a change's session has the session's column, the files changed on its branch, and no plan's
// progress (US4.1). Its page is a feature's page (US3.1 of the feature page redesign). The sidebar
// tags its row "Change" (US4.4). Its session passes the UI checks at both sizes, in light and dark.
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

/** The session's column. */
const COLUMN = "The session's column";

/** The column, by its landmark. */
async function column() {
  return within(await screen.findByRole("complementary", { name: COLUMN }, LIVE));
}

describe("on the desktop", () => {
  atSize("desktop");

  // US3.1 of the feature page redesign: a change opens the same page as a feature.
  test("a change's page is a feature's page, with Fix and its session", async () => {
    await centred();
    await show(`/f/${CENTRED}`, "New session");

    expect(screen.getByRole("heading", { level: 1, name: CENTRED_TITLE })).toBeTruthy();
    const stages = within(screen.getByRole("list", { name: "Stages" }));
    expect(stages.getByText("Fix")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "New session" })).toHaveLength(1);
    expect(screen.queryByRole("textbox", { name: "Message Claude Code" })).toBeNull();
  });

  // US4.1
  test("a change's session has its column, without a plan's progress", async () => {
    await centred();
    await show(`/f/${CENTRED}/session`, CENTRED_TITLE);

    expect(screen.getByRole("heading", { level: 1, name: CENTRED_TITLE })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Message Claude Code" })).toBeTruthy();
    const aside = await column();
    await aside.findByText("No file changed yet.", undefined, LIVE);
    expect(aside.getByRole("tab", { name: "Activity" })).toBeTruthy();
    expect(aside.queryByRole("link", { name: /task \d+ of/ })).toBeNull();
  });

  // US1 of merge chats: one Sessions section holds changes and features, each card's name saying
  // its kind, which its icon shows.
  // Layout and look US2 (R14): changes and features share In progress, sessions have their own pane.
  test("the sidebar names a change's kind, in the one In progress section", async () => {
    await centred();
    await show(`/f/${CENTRED}/session`, CENTRED_TITLE);
    await startTurn("Carry on.", [{ text: "Investigating.", type: "text" }]);

    const nav = within(screen.getByRole("navigation", { name: "Navigation" }));
    const row = await nav.findByRole(
      "link",
      { name: new RegExp(`^centred-x, .+, ${CENTRED_TITLE}, change, Working`) },
      LIVE,
    );
    expect(row.getAttribute("href")).toBe(atRepo(`/f/${CENTRED}`));
    // Its slug, then its step on the line under it.
    expect(row.textContent).toMatch(/^centred-x \S/);
    const sessions = nav.getByRole("group", { name: "In progress" });
    expect(sessions.contains(row)).toBe(true);
    // No kind label: the one "Change" is its step, "change", on the line under its name (R17).
    expect(within(sessions).queryAllByText("Change")).toEqual([within(row).getByText("Change")]);
    // A feature's card, in the same section, names its kind too.
    const feature = nav.getByRole("link", { name: /^cli-tuis, / });
    expect(sessions.contains(feature)).toBe(true);
    expect(feature.getAttribute("aria-label")).toMatch(/, feature, /);
  });
});

const MODES = (["light", "dark"] as const).map((mode) => ({ mode }));

// The UI checks on a change's session, its column shown beside it on the desktop, its sheet open on
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
    await aside.findByText("On the branch · 1 file · +1 −0", undefined, LIVE);
    await drawn();
    await checkLayout();
    await checkLayout(screen.getByRole("complementary", { name: COLUMN }));
  } else {
    await userEvent.click(await screen.findByRole("button", { name: "Activity" }, LIVE));
    const open = await screen.findByRole("dialog", { name: "Activity" }, LIVE);
    await within(open).findByText("On the branch · 1 file · +1 −0", undefined, LIVE);
    await grown();
    await checkLayout();
  }
});
