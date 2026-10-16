// US5 of the interface's redesign: a button that writes to git says what it does at once, the other
// writing buttons are blocked meanwhile, a bar runs at the top of the page, and the item's card says
// the same, until the server's status for it changes.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import {
  atRepo,
  click,
  fakeAgent,
  fixtureRepo,
  git,
  renderPage,
  serverFetch,
  today,
  type,
} from "./helpers.tsx";
import { runWrite } from "../writes/store.ts";

const WEB_UI = "2026-10-11-web-ui";
const ROUND = `/f/${WEB_UI}/clarifications-01.md`;

today("2026-10-12");

/** A repository whose round 01 has every question answered, in the feature's worktree. */
function answeredRepo() {
  const repo = fixtureRepo();
  const worktree = join(".worktrees", WEB_UI);
  git(repo, "worktree", "add", "--quiet", worktree, WEB_UI);
  const path = join(repo, worktree, "specs", WEB_UI, "clarifications-01.md");
  writeFileSync(
    path,
    readFileSync(path, "utf8").replaceAll(/^\*\*Answer:\*\*$/gm, "**Answer:** A"),
  );
  return repo;
}

/**
 * The server's fetch, holding every request whose body names `held` until `release`; `count` says
 * how many it was sent.
 */
async function holding(repo: string, held: string) {
  const fake = await fakeAgent();
  const through = serverFetch(repo, fake.sessions);
  const gate = Promise.withResolvers<void>();
  let count = 0;
  const fetch: typeof globalThis.fetch = async (input, init) => {
    if (String(init?.body).includes(held)) {
      count++;
      await gate.promise;
    }
    return through(input, init);
  };
  return { count: () => count, fake, fetch, release: () => gate.resolve() };
}

/** The feature's card in the sidebar. */
const card = (slug: string) =>
  within(screen.getByRole("navigation", { name: "Side navigation" })).getByRole("link", {
    name: new RegExp(`^${slug}, `),
  });

/** US5.1, US5.3, US5.4, US5.5, SC-002 */
test("a commit reads Committing… at once, blocks the other buttons, and shows on its card", async () => {
  const repo = answeredRepo();
  const held = await holding(repo, '"answers.submit"');
  try {
    await renderPage(ROUND, repo, { agent: held.fake, fetch: held.fetch });
    const only = await screen.findByRole("button", { name: "Commit only" });

    await click(screen.getByRole("button", { name: "Commit and start the agent" }));

    // In the render after the click, before the server answers.
    const running = screen.getByRole("button", { name: "Committing…" });
    expect(running.querySelector('[role="status"]')).toBeTruthy();
    expect(only.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("progressbar", { name: "Saving to git" })).toBeTruthy();
    expect(card("web-ui").getAttribute("aria-label")).toMatch(/, Committing…/);
    // Blocked, it keeps the focus, and sends nothing.
    only.focus();
    expect(document.activeElement).toBe(only);
    await click(only);
    expect(held.count()).toBe(1);
    expect(screen.getByText("Another change is being saved to git")).toBeTruthy();
    // Saving a field is no commit: it stays free.
    expect(
      screen.getByRole("button", { name: "Save notes" }).getAttribute("aria-disabled"),
    ).not.toBe("true");

    await act(async () => held.release());

    await waitFor(() => expect(window.location.pathname).toBe(atRepo(`/f/${WEB_UI}/session`)));
    expect(screen.queryByRole("progressbar", { name: "Saving to git" })).toBeNull();
  } finally {
    held.release();
  }
});

/** US5.2 */
test("while a commit runs, a card still opens its page", async () => {
  const repo = answeredRepo();
  const held = await holding(repo, '"answers.submit"');
  try {
    await renderPage(ROUND, repo, { agent: held.fake, fetch: held.fetch });
    await click(await screen.findByRole("button", { name: "Commit only" }));
    expect(screen.getByRole("button", { name: "Committing…" })).toBeTruthy();

    await click(card("cli-tuis"));

    await waitFor(() => expect(window.location.pathname).toBe(atRepo("/f/2026-10-12-cli-tuis")));
  } finally {
    held.release();
  }
});

/** US5.6 */
test("a commit the hook refuses gives the button back, with the error, and the card its status", async () => {
  const repo = answeredRepo();
  const hooks = join(repo, ".git/hooks");
  git(repo, "config", "core.hooksPath", hooks);
  writeFileSync(join(hooks, "pre-commit"), "#!/bin/sh\necho 'refused'\nexit 1\n", { mode: 0o755 });
  await renderPage(ROUND, repo, { agent: true });

  await click(await screen.findByRole("button", { name: "Commit only" }));

  expect(
    await screen.findByText(/The pre-commit hook refused the commit/, undefined, {
      timeout: 5000,
    }),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Commit only" }).getAttribute("aria-disabled")).toBe(
    null,
  );
  expect(card("web-ui").getAttribute("aria-label")).not.toMatch(/Committing…/);
});

/** US5.7 */
test("Start the agent shows on the feature's card at once", async () => {
  const repo = answeredRepo();
  const held = await holding(repo, '"session.send"');
  try {
    await renderPage(ROUND, repo, { agent: held.fake, fetch: held.fetch });
    await click(await screen.findByRole("button", { name: "Commit and start the agent" }));
    await waitFor(() => expect(window.location.pathname).toBe(atRepo(`/f/${WEB_UI}/session`)));
    const box = await screen.findByRole("textbox", { name: "Message Claude Code" });
    await waitFor(() => expect(box.textContent).toContain("Write the spec from the answers"));
    await type(box, `${box.textContent}\nKeep it short.`);

    await click(screen.getAllByRole("button", { name: "Start the agent" }).at(-1)!);

    expect(card("web-ui").getAttribute("aria-label")).toMatch(/, Starting the agent…/);
  } finally {
    held.release();
  }
});

/** US5.1, on the New change page: another page's write blocks "Start the change", not the typing. */
test("Start the change waits for another page's write", async () => {
  const done = Promise.withResolvers<boolean>();
  let write: Promise<boolean> | undefined;
  await renderPage("/changes/new", answeredRepo(), { agent: true });
  await type(
    await screen.findByRole("textbox", { name: "Message Claude Code" }),
    "Centre the x in failure circles",
  );
  const start = screen.getByRole("button", { name: "Start the change" });
  expect(start.getAttribute("aria-disabled")).not.toBe("true");

  act(() => {
    write = runWrite({ label: "Committing…" }, () => done.promise);
  });

  expect(start.getAttribute("aria-disabled")).toBe("true");
  await type(screen.getByRole("textbox", { name: "Message Claude Code" }), "Widen the sidebar");
  expect(screen.getByRole("textbox", { name: "Message Claude Code" }).textContent).toBe(
    "Widen the sidebar",
  );
  await act(async () => {
    done.resolve(true);
    await write;
  });
  expect(start.getAttribute("aria-disabled")).not.toBe("true");
});
