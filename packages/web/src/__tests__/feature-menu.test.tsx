// The feature's "…" beside its title: Rename, and Drop behind its confirmation, with what stayed
// told on Home.
import { screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import {
  atRepo,
  type Binding,
  click,
  fakeAgent,
  fixtureRepo,
  git,
  refreshUntil,
  renderPage,
  type,
} from "./helpers.tsx";

const binding: Binding = await import("uraeda-binding");

const RECURRING = "2026-10-06-recurring-tasks";

/** Opens the feature's "…" and picks `item`. */
async function pick(item: string) {
  await click(await screen.findByRole("button", { name: "Feature actions" }));
  await click(screen.getByRole("menuitem", { name: item }));
}

test("Drop the feature… asks first, then Home says what stayed", async () => {
  await renderPage(`/f/${RECURRING}`, fixtureRepo(), { agent: true });

  await pick("Drop the feature…");
  await click(await screen.findByRole("button", { name: "Drop the feature" }));

  expect(
    await screen.findByText(`Dropped the feature recurring-tasks: its branch ${RECURRING} stays.`),
  ).toBeTruthy();
  expect(window.location.pathname).toBe(atRepo("/"));
});

test("cancelling the drop changes nothing", async () => {
  const repo = fixtureRepo();
  await renderPage(`/f/${RECURRING}`, repo, { agent: true });

  await pick("Drop the feature…");
  await click(await screen.findByRole("button", { name: "Keep the feature" }));

  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(window.location.pathname).toBe(atRepo(`/f/${RECURRING}`));
  expect(screen.getByRole("heading", { level: 1, name: "Recurring tasks" })).toBeTruthy();
  expect(git(repo, "branch", "--list", RECURRING).trim()).toContain(RECURRING);
  expect(screen.queryByText(/^Dropped the feature/)).toBeNull();
});

test("Rename changes the card's name and keeps the page's title", async () => {
  await renderPage(`/f/${RECURRING}`, fixtureRepo(), { agent: await fakeAgent() });

  await pick("Rename");
  await type(
    await screen.findByRole("textbox", { name: "Name in the sidebar" }),
    "Repeating tasks",
  );
  await click(screen.getByRole("button", { name: "Save" }));

  const nav = within(screen.getByRole("navigation", { name: "Navigation" }));
  await refreshUntil(() =>
    expect(nav.getByRole("link", { name: /^Repeating tasks, / })).toBeTruthy(),
  );
  expect(screen.getByRole("heading", { level: 1, name: "Recurring tasks" })).toBeTruthy();
});

test("a refused drop keeps the page and shows why until dismissed", async () => {
  await renderPage(`/f/${RECURRING}`, fixtureRepo(), {
    agent: true,
    binding: {
      ...binding,
      dropItem: () => Promise.reject(new Error("refused: the feature is being merged")),
    },
  });

  await pick("Drop the feature…");
  await click(await screen.findByRole("button", { name: "Drop the feature" }));

  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("the feature is being merged");
  expect(window.location.pathname).toBe(atRepo(`/f/${RECURRING}`));
  await click(within(alert).getByRole("button", { name: "Dismiss" }));
  expect(screen.queryByRole("alert")).toBeNull();
});

test("a drop whose priorities were not committed keeps the page and shows the warning until dismissed", async () => {
  await renderPage(`/f/${RECURRING}`, fixtureRepo(), {
    agent: true,
    binding: {
      ...binding,
      dropItem: async (repo: string, folder: string) => ({
        ...(await binding.dropItem(repo, folder)),
        committed: false,
      }),
    },
  });

  await pick("Drop the feature…");
  await click(await screen.findByRole("button", { name: "Drop the feature" }));

  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("The priorities were not committed");
  expect(window.location.pathname).toBe(atRepo(`/f/${RECURRING}`));
  await click(within(alert).getByRole("button", { name: "Dismiss" }));
  expect(screen.queryByRole("alert")).toBeNull();
});
