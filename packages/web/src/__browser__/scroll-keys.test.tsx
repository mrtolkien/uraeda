// The base keymap's scroll fallback in a real browser (US2 5, US2 more 1; review focus 11): on the
// spec page, `j` scrolls the page down a few lines and `k` back; with the focus in a nested scroller,
// that region scrolls alone and the page stays.
import { screen, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { agent, atSize, drawn, LIVE, show } from "./helpers.tsx";

atSize("desktop");

const SPEC = "/f/2026-10-06-recurring-tasks/spec.md";
const TEXT = "Complete a repeating task";

test("j scrolls the spec down a few lines and k back, with nothing focused (US2 5)", async () => {
  await show(SPEC, TEXT);
  expect(window.scrollY).toBe(0);

  await userEvent.keyboard("j");
  await expect.poll(() => window.scrollY).toBeGreaterThan(0);
  const down = window.scrollY;
  // A few lines, not a page.
  expect(down).toBeLessThan(window.innerHeight / 2);

  await userEvent.keyboard("j");
  await expect.poll(() => window.scrollY).toBeGreaterThan(down);

  await userEvent.keyboard("kk");
  await expect.poll(() => window.scrollY).toBe(0);
});

test("a nested scroller with the focus scrolls alone (US2 more 1)", async () => {
  await show(SPEC, TEXT);
  const region = document.createElement("div");
  region.style.cssText = "height: 80px; overflow-y: auto";
  const button = document.createElement("button");
  button.textContent = "Inside the region";
  button.style.marginBottom = "1000px";
  region.append(button);
  screen.getByRole("main").prepend(region);
  button.focus();
  expect(document.activeElement).toBe(button);

  await userEvent.keyboard("j");
  await expect.poll(() => region.scrollTop).toBeGreaterThan(0);
  expect(window.scrollY).toBe(0);

  await userEvent.keyboard("k");
  await expect.poll(() => region.scrollTop).toBe(0);
  expect(window.scrollY).toBe(0);
});

test("on the real session page, the focus in the column's Changes scrolls that region alone (US2 more 1)", async () => {
  const feature = "2026-10-12-cli-tuis";
  await agent.addPlan(feature);
  await agent.commitOnBranch(
    feature,
    Object.fromEntries(
      Array.from({ length: 40 }, (_, index) => [
        `src/f${String(index).padStart(2, "0")}.rs`,
        "fn f() {}\n",
      ]),
    ),
  );
  await show(`/f/${feature}/session`, "CLI TUIs");
  const column = await screen.findByRole("complementary", { name: "The session's column" }, LIVE);
  const changes = within(column).getByRole("region", { name: "Changes" });
  await userEvent.click(
    await within(changes).findByRole("button", { name: "38 more files" }, LIVE),
  );
  await within(changes).findByText("src/f39.rs", undefined, LIVE);
  await drawn();
  expect(changes.scrollHeight).toBeGreaterThan(changes.clientHeight);
  const log = screen.getByRole("log", { name: "Conversation" });
  const logAt = log.scrollTop;
  // The region takes the focus itself, as Tab reaches it: its keys are the browser's for a scroller.
  changes.focus();
  expect(document.activeElement).toBe(changes);

  await userEvent.keyboard("j");
  await expect.poll(() => changes.scrollTop).toBeGreaterThan(0);
  expect(window.scrollY).toBe(0);
  expect(log.scrollTop).toBe(logAt);

  await userEvent.keyboard("k");
  await expect.poll(() => changes.scrollTop).toBe(0);
  expect(window.scrollY).toBe(0);
});
