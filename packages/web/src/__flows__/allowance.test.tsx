// Flow: the sidebar's allowance of the agent. It shows what a runner reports, changes with it, and
// goes when the runner exits; with no report, nothing shows.
import { screen, waitFor } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { refreshUntil, startApp } from "./harness.tsx";
import { resetAgent } from "./session-helpers.tsx";

const app = startApp({ agent: true });

/** The bar that reads this percentage left: no other bar of the sidebar reads one from a runner. */
function bar(left: string) {
  return screen
    .queryAllByRole("progressbar")
    .find((node) => node.getAttribute("aria-valuenow") === left);
}

test("a runner without usage data shows no allowance", async () => {
  await app.open("/");
  await screen.findAllByRole("link");

  // The two bars of the fixture's plans are no allowance: none reads the runner's figures.
  expect(bar("57")).toBeUndefined();
});

test("the allowance shows the runner's report, changes with it, and goes when the runner exits", async () => {
  resetAgent(app);
  const chat = await app.sessions.newChat(app.repo);
  const resetsAt = new Date(2099, 0, 1, 18, 40).toISOString();
  app.agent.script([{ fiveHour: { percentUsed: 43, resetsAt }, type: "usage" }]);
  const { turn } = await app.sessions.send(app.repo, chat.id, { text: "Hello" });
  await app.sessions.settled(turn);
  await app.open("/");

  await waitFor(() => expect(bar("57")).toBeTruthy());

  app.agent.emit({ fiveHour: { percentUsed: 82, resetsAt }, type: "usage" });
  await refreshUntil(() => expect(bar("18")).toBeTruthy());
  app.agent.exit();
  await refreshUntil(() => expect(bar("18")).toBeUndefined());
});
