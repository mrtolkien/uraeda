// "Lists whose rows open a pane share one keyboard behaviour", and "every action works by tap and by
// keyboard" (the UI behaviour decision), on a wide screen, where a row opens a pane beside its list.
// happy-dom has no focus order and no layout, so these walk the real lists with real keys: the
// priorities, the inbox, and the decisions are one table, the same keys on each.
import { screen, within } from "@testing-library/react";
import { describe, expect, test } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { atRepo, atSize, commands, drawn, opened } from "./helpers.tsx";

atSize("desktop");

/** Lists whose rows open a pane at an address of their own under the list's. */
const LISTS = [
  { name: "the priorities", path: "/priorities" },
  { name: "the inbox", path: "/inbox" },
];

/** The rows of the list, as the keys walk them: links of the main region to a row's address. */
function rows(path: string) {
  const main = screen.getByRole("main");
  const pane = screen.queryByRole("region", { name: "Detail" });
  return within(main)
    .queryAllByRole("link")
    .filter(
      (link) =>
        (link.getAttribute("href") ?? "").startsWith(`${atRepo(path)}/`) && !pane?.contains(link),
    );
}

/** Where a row leads. */
const address = (row: HTMLElement) =>
  new URL(row.getAttribute("href")!, window.location.href).pathname;

/** Waits for the row to be the page's address, the focus, and the one marked current. */
async function selected(path: string, index: number) {
  await expect.poll(() => window.location.pathname).toBe(address(rows(path)[index]!));
  await expect.poll(() => document.activeElement).toBe(rows(path)[index]);
  expect(
    within(screen.getByRole("main"))
      .getAllByRole("listitem", { current: true })
      .map((item) => item.contains(rows(path)[index]!)),
  ).toEqual([true]);
}

/** Opens the list with its first row open in the pane and the focus on it. */
async function atFirst(path: string) {
  await opened(path);
  await expect.poll(() => rows(path).length).toBeGreaterThan(3);
  await userEvent.click(rows(path)[0]!);
  await selected(path, 0);
  await drawn();
}

describe.each(LISTS)("$name", ({ path }) => {
  test("↓ ↑ and j k move the selection and the pane follows, in place", async () => {
    await atFirst(path);
    const entries = window.history.length;

    await userEvent.keyboard("{ArrowDown}");
    await selected(path, 1);
    expect(screen.getByRole("region", { name: "Detail" })).toBeTruthy();
    await userEvent.keyboard("j");
    await selected(path, 2);
    await userEvent.keyboard("k");
    await selected(path, 1);
    await userEvent.keyboard("{ArrowUp}");
    await selected(path, 0);

    // The pane followed in place: Back leaves the list, not each row passed.
    expect(window.history.length).toBe(entries);
  });

  test("End and Home reach the last and the first row", async () => {
    await atFirst(path);

    await userEvent.keyboard("{End}");
    await selected(path, rows(path).length - 1);
    await userEvent.keyboard("{Home}");
    await selected(path, 0);
  });

  test("Escape closes the pane, and the list keeps its focus", async () => {
    await atFirst(path);

    await userEvent.keyboard("{Escape}");

    await expect.poll(() => window.location.pathname).toBe(atRepo(path));
    await expect.poll(() => screen.queryByRole("region", { name: "Detail" })).toBeNull();
  });

  test("Enter on a row opens it, as a tap does", async () => {
    await opened(path);
    await expect.poll(() => rows(path).length).toBeGreaterThan(3);
    rows(path)[1]!.focus();

    const target = address(rows(path)[1]!);

    await userEvent.keyboard("{Enter}");

    await expect.poll(() => window.location.pathname).toBe(target);
    expect(await screen.findByRole("region", { name: "Detail" })).toBeTruthy();
  });
});

/** The decisions page's links to a principle or a decision. */
const links = () =>
  within(screen.getByRole("main"))
    .getAllByRole("link")
    .filter((link) => (link.getAttribute("href") ?? "").includes("/decisions/"));
const principles = () =>
  links().filter((link) => (link.getAttribute("href") ?? "").includes("/decisions/constitution/"));

describe("the decisions", () => {
  test("↓ and ↑ go across from the principles to the decisions, the pane following", async () => {
    await opened("/decisions");
    // The page opened on the last principle, as a link to it opens it, with the focus on its row.
    const lastPath = new URL(principles().at(-1)!.getAttribute("href")!, window.location.href)
      .pathname;
    await opened(lastPath.slice(atRepo("").length));
    principles().at(-1)!.focus();
    await drawn();

    await userEvent.keyboard("{ArrowDown}");

    await expect.poll(() => window.location.pathname).not.toContain("/constitution/");
    expect(window.location.pathname).not.toBe(atRepo("/decisions"));
    await expect
      .poll(() => links().includes(document.activeElement as HTMLAnchorElement))
      .toBe(true);
    expect(await screen.findByRole("region", { name: "Detail" })).toBeTruthy();

    await userEvent.keyboard("{ArrowUp}");
    await expect.poll(() => window.location.pathname).toContain("/constitution/");
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => window.location.pathname).toBe(atRepo("/decisions"));
  });
});

describe("while something else holds the keys", () => {
  test("a dialog keeps them from the list", async () => {
    await atFirst("/inbox");
    const at = window.location.pathname;
    await userEvent.click(screen.getByRole("button", { name: "Add a note to the inbox" }));
    await screen.findByRole("dialog");
    // Off its text field, the keys reach the page: the open dialog still keeps them from the list.
    (document.activeElement as HTMLElement | null)?.blur();

    for (const key of ["{ArrowDown}", "j", "{End}"]) {
      await userEvent.keyboard(key);
      await drawn();
      expect(window.location.pathname).toBe(at);
    }
  });

  test("a menu keeps them from the list", async () => {
    await atFirst("/inbox");
    const at = window.location.pathname;
    await userEvent.click(screen.getByRole("button", { name: "Move to priorities" }));
    await screen.findByRole("menu");
    (document.activeElement as HTMLElement | null)?.blur();

    for (const key of ["{ArrowDown}", "j", "{End}"]) {
      await userEvent.keyboard(key);
      await drawn();
      expect(window.location.pathname).toBe(at);
    }
  });
});

describe("a line moved without a pointer", () => {
  test("Space, ↓, Space on a line's handle moves it one place, written to the file", async () => {
    const original = await commands.readRepo();
    await commands.writeRepo(
      original.replace("## Later\n\n", "## Later\n\n- First idea\n- Second idea\n- Third idea\n"),
    );
    await opened("/priorities");
    const handle = await screen.findByRole("button", { name: "Move First idea" });
    handle.focus();

    await userEvent.keyboard("[Space]");
    await userEvent.keyboard("[ArrowDown]");
    await userEvent.keyboard("[Space]");

    await expect
      .poll(
        async () => {
          const text = await commands.readRepo();
          return [
            text.indexOf("- Second idea"),
            text.indexOf("- First idea"),
            text.indexOf("- Third idea"),
          ];
        },
        { timeout: 10_000 },
      )
      .toSatisfy(
        ([second, first, third]: Array<number>) => second > 0 && second < first && first < third,
      );
  });

  test("Tab goes from a line's handle to its link", async () => {
    await opened("/priorities");
    const handles = await screen.findAllByRole("button", { name: /^Move / });
    handles[0]!.focus();

    await userEvent.tab();

    expect((document.activeElement as HTMLElement).matches("a[href]")).toBe(true);
  });
});
