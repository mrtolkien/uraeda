// US1 more-scenario 3, US4, and review focus 3: the list's keys between columns. `j k` stay inside
// a column, `h l` and the left and right arrows go to the same row of the neighbouring column, or
// its last card when it is shorter; moving the selection opens nothing, and Enter opens the
// selected card. The status line names `h l` only where there are columns. Each test takes the
// repository in turn, on a fresh copy of the fixture.
import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vite-plus/test";
import { commands as browserCommands, userEvent } from "vite-plus/test/browser";
import type { RepoCommands } from "../../vite.browser.config.ts";
import { atSize, show } from "./helpers.tsx";

const commands = browserCommands as unknown as RepoCommands;

/** Now holds four lines, Next five, and Later six; Ongoing is what the fixture's agents derive. */
const PRIORITIES = `# Priorities

## Now

${[1, 2, 3, 4].map((n) => `- Now line ${n}`).join("\n")}

## Next

${[1, 2, 3, 4, 5].map((n) => `- Next line ${n}`).join("\n")}

## Later

${[1, 2, 3, 4, 5, 6].map((n) => `- Later line ${n}`).join("\n")}
`;

/** The text of the card that has the focus. */
function focused() {
  const row = document.activeElement?.closest("[data-row]");
  return row?.textContent ?? "";
}

/** The card of a text is the one with the focus, and the page's one selected card. */
async function isOn(text: string) {
  await waitFor(() => expect(focused()).toContain(text));
  expect(document.querySelectorAll('[data-row][aria-current="true"]')).toHaveLength(1);
  expect(document.querySelector('[data-row][aria-current="true"]')?.textContent ?? "").toContain(
    text,
  );
}

/** The status line, to look in. */
function line() {
  return within(screen.getByRole("contentinfo", { name: "Status line" }));
}

/** Selects the first card of Next: `l` from the first card of the page goes column by column. */
async function onNext() {
  await commands.writeRepo(PRIORITIES, "specs/PRIORITIES.md");
  await show("/priorities", "Next line 5");
  await userEvent.keyboard("j");
  for (let step = 0; step < 4 && !focused().includes("Now line"); step += 1) {
    await userEvent.keyboard("l");
  }
  await isOn("Now line 1");
  await userEvent.keyboard("l");
  await isOn("Next line 1");
}

describe("on the desktop", () => {
  atSize("desktop");

  test("l selects the card at the same row of the next column, or the last card when it is shorter", async () => {
    await onNext();
    await userEvent.keyboard("j");
    await isOn("Next line 2");
    await userEvent.keyboard("l");
    await isOn("Later line 2");
    await userEvent.keyboard("h");
    await isOn("Next line 2");

    // Row 5 of Next, back to Now, which has four: its last card.
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    await isOn("Next line 5");
    await userEvent.keyboard("{ArrowLeft}");
    await isOn("Now line 4");
    await userEvent.keyboard("{ArrowRight}");
    await isOn("Next line 4");
  });

  test("j and k stay inside a column", async () => {
    await onNext();
    await userEvent.keyboard("k");
    await isOn("Next line 1");
    await userEvent.keyboard("j".repeat(12));
    await isOn("Next line 5");
    await userEvent.keyboard("{Home}");
    await isOn("Next line 1");
    await userEvent.keyboard("{End}");
    await isOn("Next line 5");
  });

  test("Enter opens the selected card, and moving the selection opens nothing", async () => {
    await onNext();
    await userEvent.keyboard("j");
    await userEvent.keyboard("l");
    await userEvent.keyboard("h");
    await isOn("Next line 2");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(window.location.pathname).toMatch(/\/priorities$/);

    await userEvent.keyboard("{Enter}");
    expect(await screen.findByRole("dialog", { name: "Priority" })).toBeTruthy();
    expect(window.location.pathname).toMatch(/\/priorities\/next-line-2$/);
  });

  test("the status line names h l only on the columns, and esc close only with an overlay", async () => {
    await show("/priorities", "Now");
    expect(line().getByText("h l")).toBeTruthy();
    expect(line().getByText("j k")).toBeTruthy();
    expect(line().queryByText("esc")).toBeNull();

    await userEvent.keyboard("j");
    await userEvent.keyboard("{Enter}");
    await screen.findByRole("dialog", { name: "Priority" });
    expect(line().getByText("esc")).toBeTruthy();
    expect(line().queryByText("h l")).toBeNull();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(line().queryByText("esc")).toBeNull();
    expect(line().getByText("h l")).toBeTruthy();

    await show("/inbox", "Inbox");
    expect(line().queryByText("h l")).toBeNull();
  });
});

describe("on the phone", () => {
  atSize("phone");

  test("the panes are stacked: j goes on from a section's last card to the next section's first, with no h l", async () => {
    await commands.writeRepo(PRIORITIES, "specs/PRIORITIES.md");
    await show("/priorities", "Next line 5");
    document.querySelector<HTMLElement>('[data-row] a[href$="next-line-5"]')?.focus();
    await userEvent.keyboard("j");
    await isOn("Later line 1");
    await userEvent.keyboard("l");
    await isOn("Later line 1");
  });
});
