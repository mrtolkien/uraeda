// The page checks of the UI checks decision: every page a UI decision governs, and every overlay
// that opens over one, at a phone's size and a desktop's, in light and dark. Each is read for what
// the human reads: no text cut, nothing scrolling the page sideways, and no WCAG 2.1 A or AA
// violation. A page is a row of the table: a new page is one more row, and its name is the only
// wording here.
import { screen, within } from "@testing-library/react";
import { describe, expect, test } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { FEATURE_PAGES } from "../../.storybook/checkouts.ts";
import { forgetSignedOut } from "../sign-in/signedOut.ts";
import {
  agent,
  atSize,
  checkAccessible,
  checkPage,
  colorScheme,
  commands,
  drawn,
  grown,
  LIVE,
  opened,
  show,
  startTurn,
} from "./helpers.tsx";

const MODES = ["light", "dark"] as const;
const narrow = () => window.innerWidth < 768;

const CLI = "2026-10-12-cli-tuis";
const LOGO = "2026-10-16-header-logo";

/** What a case does once its page is up, and the region it checks, the whole document by default. */
type Step = () => Promise<HTMLElement | void>;

type Page = {
  /** After it opens: opens an overlay, or a fold, and gives the region to check besides the page. */
  after?: Step;
  /** Before the page opens: what the repository holds, or the browser. */
  before?: () => Promise<void>;
  name: string;
  path: string;
  /** The page starts the agent's turn, which a second theme could not start again: a test each. */
  turn?: true;
};

/** The side navigation: on the phone, its drawer, opened first. */
async function navigation() {
  if (narrow()) {
    await userEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    return within(await screen.findByRole("dialog"));
  }
  return within(screen.getByRole("navigation", { name: "Side navigation" }));
}

/** Opens every closed fold of the page, so the checks reach what it holds. */
async function openFolds() {
  const main = screen.getByRole("main");
  for (let left = 10; left > 0; left -= 1) {
    const closed = within(main).queryAllByRole("button", { expanded: false });
    if (closed.length === 0) {
      return;
    }
    await userEvent.click(closed[0]!);
  }
}

const unfolded: Step = async () => {
  await openFolds();
};

const FIXTURE_PAGES: Array<Page> = [
  { name: "home", path: "/" },
  {
    after: unfolded,
    name: "a round of questions",
    path: "/f/2026-10-11-web-ui/clarifications-01.md",
  },
  { after: unfolded, name: "a spec under review", path: "/f/2026-10-06-recurring-tasks/spec.md" },
  { name: "a plan under review", path: "/f/2026-10-13-plan-review/plan.md" },
  { name: "a task view", path: "/priorities/claude-code-runner-triggered-manually" },
  { name: "the priorities", path: "/priorities" },
  { name: "a feature waiting on an agent", path: `/f/${CLI}` },
  { name: "a feature's new session", path: `/f/${CLI}/session` },
  { name: "a new chat", path: "/chats/new" },
  { name: "a new change", path: "/changes/new" },
  { name: "the settings", path: "/settings" },
  { name: "the Server settings", path: "/settings/server" },
  { name: "the Sign-in settings", path: "/settings/sign-in" },
  { name: "the decisions", path: "/decisions" },
  { name: "a decision open", path: "/decisions/ui-behaviour" },
  { name: "the inbox", path: "/inbox" },
  { name: "a note's view", path: "/inbox/in-failures-the-x-is-not-centered-in-the-circle" },
];

/** A round of one question, waiting on the human. */
const ROUND = `---
status: awaiting-human
---

# Clarifications, round 01: A home logo in the header

> [!IMPORTANT]
>
> 1 question on the header, about 2 minutes.

## Context

The [proposal](proposal.md) asks for a logo in the header.

## Q1: Does the logo replace the repository's name?

Why it matters: the header has no room for both.

- **A (recommended). The logo replaces the name.**
  - [pro] it fits.
- **B. The name stays, without a logo.**
  - [con] no logo on phones.

**Answer:**
`;

/** Every state of the feature page `gh` does not decide: one feature each, from Storybook's fixture. */
const FEATURE_STATES: Array<Page> = Object.entries(FEATURE_PAGES)
  // The pull request's page waits on `gh`, which a test does not run.
  .filter(([state]) => state !== "pullRequest")
  .map(([state, folder]) => ({
    after: unfolded,
    before: () => commands.addFeaturePages(),
    name: `a feature page, ${state}`,
    path: `/f/${folder}`,
  }));

const STATES: Array<Page> = [
  ...FEATURE_STATES,
  {
    before: () => commands.writeRepo("# Inbox\n", "specs/INBOX.md"),
    name: "the empty inbox",
    path: "/inbox",
  },
  {
    after: async () => {
      await checkOpen();
      await userEvent.click(screen.getByRole("link", { name: "Answer it" }));
      await screen.findByRole("heading", { level: 1 });
    },
    before: async () =>
      commands.writeRepo(await commands.fixtureText("INBOX-TRIAGE.md"), "specs/INBOX-TRIAGE.md"),
    name: "the inbox with a triage waiting, then its answering view",
    path: "/inbox",
  },
  {
    after: async () => {
      if (narrow()) {
        // The phone's progress line, a button that opens the column under it.
        await userEvent.click(await screen.findByRole("button", { name: /question/ }, LIVE));
        await screen.findByRole("region", { name: "Progress" }, LIVE);
      } else {
        await screen.findByRole("complementary", { name: "Progress" }, LIVE);
      }
      await grown();
    },
    before: async () => {
      await agent.addChange(LOGO, {
        "clarifications-01.md": ROUND,
        "proposal.md": "# A home logo in the header\n",
      });
      await agent.commitOnBranch(`change/${LOGO}`, {
        "packages/web/src/Header.tsx": "// The header.\n",
      });
    },
    name: "a change's session, its progress open",
    path: `/f/${LOGO}/session`,
  },
  {
    after: async () => {
      if (!narrow()) {
        await screen.findByRole("complementary", { name: "Progress" }, LIVE);
      }
    },
    before: () => agent.addPlan(CLI),
    name: "a feature's session at its implementation, its column shown",
    path: `/f/${CLI}/session`,
  },
  {
    after: async () => {
      await startTurn("Plan the CLI.", [
        { text: "Reading **the answers**.", type: "text" },
        {
          id: "a",
          input: { file_path: "spec.md" },
          kind: "read",
          name: "Read",
          target: "specs/2026-10-12-cli-tuis/spec.md",
          type: "toolStart",
        },
        { id: "a", isError: false, output: "# Spec", type: "toolEnd" },
        { text: "The runner already keeps one cache per repository.", type: "textDelta" },
      ]);
      await within(await screen.findByRole("log", { name: "Conversation" }, LIVE)).findByText(
        /keeps one cache/,
        undefined,
        LIVE,
      );
    },
    name: "a working session",
    path: `/f/${CLI}/session`,
    turn: true,
  },
  {
    after: async () => {
      const nav = await navigation();
      await userEvent.click(nav.getByRole("button", { name: `Settings of ${CLI.slice(11)}` }));
      return screen.findByRole("dialog", { name: "Feature settings" });
    },
    name: "the feature settings dialog",
    path: "/",
  },
  {
    after: async () => openRepositories(),
    name: "the repository menu",
    path: "/",
  },
  {
    after: async () => {
      const menu = await openRepositories();
      await userEvent.click(within(menu).getByText("Add a repository…"));
      return screen.findByRole("dialog", { name: "Add a repository" });
    },
    name: "the add repository form",
    path: "/",
  },
  {
    after: async () => {
      await userEvent.click(screen.getByRole("button", { name: "Sign out everywhere…" }));
      return screen.findByRole("dialog", { name: "Sign out every device?" });
    },
    name: "the sign-out confirmation",
    path: "/settings/sign-in",
  },
  {
    before: async () => window.localStorage.removeItem("uraeda.notifications"),
    name: "the banner that asks to notify",
    path: "/",
  },
];

/** The repository menu, from its trigger in the top bar or the navigation's heading. */
async function openRepositories() {
  const bar = narrow()
    ? screen.getByRole("banner")
    : screen.getByRole("navigation", { name: "Side navigation" });
  await userEvent.click(within(bar).getByRole("button", { name: /^Uraeda / }));
  const menu = await screen.findByRole("dialog", { name: "Repositories" });
  await within(menu).findByRole("list", { name: "Repositories" });
  return menu;
}

/** The checks of the page as it is now, by the region the case gave besides the document. */
async function checkOpen(region?: HTMLElement | void) {
  await drawn();
  checkPage();
  if (region) {
    checkPage(region);
  }
  await checkAccessible();
}

/** Reads the page in a theme: opened again, so each theme's overlays open anew. */
async function readIn(mode: (typeof MODES)[number], page: Page) {
  await colorScheme(mode);
  await opened(page.path);
  expect(document.documentElement.getAttribute("data-theme")).toBe(mode);
  if (narrow()) {
    // The phone project has a touch screen: its pages are read the way a thumb taps them.
    expect(window.matchMedia("(pointer: coarse)").matches).toBe(true);
  }
  await checkOpen(await page.after?.());
}

describe.each([...FIXTURE_PAGES, ...STATES])("$name", (page) => {
  if (page.turn) {
    test.each(MODES)("in %s", async (mode) => {
      await page.before?.();
      await readIn(mode, page);
    });
  } else {
    // One repository for both themes: the page is only read.
    test("in both themes", async () => {
      await page.before?.();
      for (const mode of MODES) {
        await readIn(mode, page);
      }
    });
  }
});

describe("on a desktop", () => {
  atSize("desktop");

  test.each(MODES)("the folded navigation, in %s", async (mode) => {
    await colorScheme(mode);
    await opened("/");
    const nav = screen.getByRole("navigation", { name: "Side navigation" });
    const open = nav.getBoundingClientRect().width;
    await userEvent.keyboard("[[");
    await expect.poll(() => nav.getBoundingClientRect().width).toBeLessThan(open);
    await checkOpen();
  });
});

describe("the sign-in screen", () => {
  /** The browser's own `fetch`, put back after each test. */
  const browserFetch = globalThis.fetch;
  /** A server with sign-in answers a browser without a session 401 to every fate request. */
  function withoutSession() {
    globalThis.fetch = async (input, init) => {
      const url = new URL(
        typeof input === "object" && "url" in input ? input.url : String(input),
        window.location.href,
      );
      if (/\/fate(\/|$)/.test(url.pathname)) {
        return new Response(JSON.stringify({ error: "Sign in to Uraeda." }), {
          headers: { "content-type": "application/json" },
          status: 401,
        });
      }
      return browserFetch(input, init);
    };
  }

  test.each(MODES)("in %s", async (mode) => {
    try {
      await colorScheme(mode);
      withoutSession();
      await show("/", "");
      await expect.poll(() => screen.queryByLabelText(/key/i)).not.toBeNull();
      await checkOpen();
    } finally {
      globalThis.fetch = browserFetch;
      forgetSignedOut();
    }
  });
});
