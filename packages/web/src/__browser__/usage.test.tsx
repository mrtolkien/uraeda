import { screen, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { commands as browserCommands, userEvent } from "vite-plus/test/browser";
import type { RepoCommands } from "../../vite.browser.config.ts";
import { checkLayout, drawn, LIVE, show, startTurn } from "./helpers.tsx";

const commands = browserCommands as unknown as RepoCommands;
const label = "Claude five-hour allowance remaining";

test.each(["light", "dark"])("five-hour allowance updates live in %s", async (mode) => {
  window.localStorage.setItem("uraeda.theme", mode);
  await show("/f/2026-10-12-cli-tuis/session", "CLI TUIs");
  const resetsAt = new Date(Date.now() + 3_600_000).toISOString();
  await startTurn("Plan the CLI.", [{ fiveHour: { percentUsed: 43, resetsAt }, type: "usage" }]);
  if (window.innerWidth < 768) {
    await userEvent.click(screen.getByRole("button", { name: "Open navigation" }));
  }
  const search = await screen.findByRole("searchbox", { name: "Search sessions" });
  const nav = search.closest("dialog") ?? search.closest("nav")!;
  const section = within(nav as HTMLElement);
  await section.findByText(/57% left · reset/, undefined, LIVE);
  await commands.agentEmit([{ fiveHour: { percentUsed: 82, resetsAt }, type: "usage" }]);
  await section.findByText(/18% left · reset/, undefined, LIVE);
  expect(section.getByRole("progressbar", { name: label }).getAttribute("aria-valuenow")).toBe(
    "18",
  );
  await drawn();
  await checkLayout(nav);
  await commands.agentEmit([{ code: 0, stderr: "", type: "exit" }]);
  await expect.poll(() => section.queryByRole("progressbar", { name: label }), LIVE).toBeNull();
});
