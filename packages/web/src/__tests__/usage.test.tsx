import { screen, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import {
  click,
  fakeAgent,
  fixtureRepo,
  refreshUntil,
  renderPage,
  serverFetch,
} from "./helpers.tsx";

const label = "Claude five-hour allowance remaining";

test("five-hour allowance closes the Features section, updates, and disappears when the runner exits", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const chat = await fake.sessions.newChat(repo);
  const resetsAt = new Date(2099, 0, 1, 18, 40).toISOString();
  fake.adapter.script([{ fiveHour: { percentUsed: 43, resetsAt }, type: "usage" }]);
  await fake.sessions.settled((await fake.sessions.send(repo, chat.id, { text: "Hello" })).turn);
  await renderPage("/", repo, { agent: fake });

  const group = within(await screen.findByRole("group", { name: "Features" }));
  expect(group.getByText("Claude 5h")).toBeTruthy();
  expect(group.getByText(/57% left · reset/)).toBeTruthy();
  expect(group.getByRole("progressbar", { name: label }).getAttribute("aria-valuenow")).toBe("57");
  expect(group.getByText(/57% left · reset/).textContent).toBe("57% left · reset 18:40");

  await click(screen.getByRole("button", { name: "Collapse sidebar" }));
  expect(screen.queryByRole("progressbar", { name: label })).toBeNull();
  await click(screen.getByRole("button", { name: "Expand sidebar" }));
  expect(await screen.findByRole("progressbar", { name: label })).toBeTruthy();

  fake.adapter.emit({ fiveHour: { percentUsed: 82, resetsAt }, type: "usage" });
  await refreshUntil(() => expect(screen.getByText(/18% left · reset/)).toBeTruthy());
  fake.adapter.exit();
  await refreshUntil(() => expect(screen.queryByRole("progressbar", { name: label })).toBeNull());
});

test("a runner without usage data shows no allowance", async () => {
  await renderPage("/", undefined, { agent: true });
  await screen.findByRole("group", { name: "Features" });
  expect(screen.queryByText("Claude 5h")).toBeNull();
  expect(screen.queryByRole("progressbar", { name: label })).toBeNull();
});

test("loading the allowance keeps the page and working features visible", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const through = serverFetch(repo, fake.sessions);
  const gate = Promise.withResolvers<void>();
  let waiting = false;
  const fetch: typeof globalThis.fetch = async (input, init) => {
    if (String(init?.body).includes('"agent"')) {
      waiting = true;
      await gate.promise;
    }
    return through(input, init);
  };
  try {
    await renderPage("/", repo, { agent: fake, fetch });
    await screen.findByRole("heading", { name: /^Needs you/ });
    const group = within(screen.getByRole("group", { name: "Features" }));
    expect(group.getByRole("link", { name: /^cli-tuis,/ })).toBeTruthy();
    expect(waiting).toBe(true);
  } finally {
    gate.resolve();
  }
});
