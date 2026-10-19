// Flow: the settings page (decision settings). A setting changed here is written to the one TOML
// file, keeping a human's comments, and applies at once when it can, or the page says when it does;
// a refusal keeps the text and the file; a file that cannot be read shows its problem and no
// control; the category and the search are in the address, at both widths.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test } from "vite-plus/test";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { atWidth, click, DESKTOP, PHONE, refreshUntil, startApp, type } from "./harness.tsx";

const MAC = "mac.tail1234.ts.net";
const PHONE_HOST = "phone.tail1234.ts.net";
const LAPTOP = "laptop.tail1234.ts.net";

const dir = temporaryFolder("uraeda-config");
const FILE = join(dir, "config.toml");
const HAND = `# Written by hand: keep it.\n[server]\nallowed_hosts = ["${MAC}", "${PHONE_HOST}"] # my devices\n`;
writeFileSync(FILE, HAND);

const app = startApp({ settings: { dir } });

/** The address the pages open on, put back after each test. */
const ORIGIN = window.location.href;
afterEach(() => atHost(ORIGIN));

/** Opens the pages through another address, as a browser reaching the server by that name. */
function atHost(url: string) {
  (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(url);
}

/** The settings file as it is on disk. */
const file = () => readFileSync(FILE, "utf8");

/** Types a line into a field and presses Enter. */
async function enter(field: HTMLElement, text: string) {
  await type(field, text);
  await act(async () => {
    fireEvent.keyDown(field, { key: "Enter" });
  });
}

/** The Server category's page. */
async function server() {
  await app.open("/settings/server");
  await screen.findAllByRole("button");
}

/** The button of a host name in the list. */
const hostButton = (name: string) => screen.findByRole("button", { name });

test("a host name added is written to the file, keeping a human's comments; refusals keep the text and the file", async () => {
  await server();

  await click(await screen.findByRole("button", { name: /Add a host name/ }));
  await enter(screen.getByRole("textbox", { name: "New host name" }), LAPTOP);

  await hostButton(LAPTOP);
  expect(file()).toContain(LAPTOP);
  expect(file()).toContain("# Written by hand: keep it.");
  expect(file()).toContain("# my devices");

  const saved = file();
  for (const refused of [`https://${MAC}`, MAC.toUpperCase()]) {
    await enter(screen.getByRole("textbox", { name: "New host name" }), refused);
    // The field keeps the text, says why it is refused, and the file is as it was.
    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: "New host name" }).getAttribute("aria-invalid"),
      ).toBe("true"),
    );
    expect(screen.getByRole<HTMLInputElement>("textbox", { name: "New host name" }).value).toBe(
      refused,
    );
    expect(file()).toBe(saved);
  }
});

test("a host name tapped, retyped, and entered replaces it in the file", async () => {
  await server();

  await click(await hostButton(LAPTOP));
  await enter(screen.getByRole("textbox", { name: `Host name ${LAPTOP}` }), "desk.tail1234.ts.net");

  await hostButton("desk.tail1234.ts.net");
  expect(file()).toContain("desk.tail1234.ts.net");
  expect(file()).not.toContain(LAPTOP);
});

test("a host name is removed without asking, unless it is this browser's own", async () => {
  await server();

  await click(await screen.findByRole("button", { name: `Remove desk.tail1234.ts.net` }));

  await waitFor(() => expect(file()).not.toContain("desk.tail1234.ts.net"));
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("removing this browser's own host name asks first: Cancel keeps it, Remove removes it", async () => {
  // On the server's port, so the browser's host name is the one in the list.
  atHost(`http://${MAC}:4310/`);
  await server();

  await click(await screen.findByRole("button", { name: `Remove ${MAC}` }));
  let dialog = within(await screen.findByRole("dialog"));
  await click(dialog.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(file()).toContain(MAC);

  await click(screen.getByRole("button", { name: `Remove ${MAC}` }));
  dialog = within(await screen.findByRole("dialog"));
  await click(dialog.getByRole("button", { name: "Remove" }));

  await waitFor(() => expect(file()).not.toContain(MAC));
  await waitFor(() => expect(screen.queryByRole("button", { name: MAC })).toBeNull());
  // The other name, and the human's comments, are still there.
  expect(file()).toContain(PHONE_HOST);
  expect(file()).toContain("# Written by hand: keep it.");
});

test("a host name added to the file by hand is listed once the page reads again", async () => {
  await server();
  writeFileSync(FILE, file().replace(`"${PHONE_HOST}"`, `"${PHONE_HOST}", "${LAPTOP}"`));

  await refreshUntil(() => expect(screen.getByRole("button", { name: LAPTOP })).toBeTruthy());
});

test("the port is saved for the next start, said so, and a port out of range is refused", async () => {
  await server();
  const port = await screen.findByRole("button", { name: "4310" });
  // The port cannot apply at once: the page says when it applies, in a text describing the field.
  // The nearest part of the page around the port that says when it applies holds the port alone.
  let around: HTMLElement | null = port;
  while (around && within(around).queryAllByText(/next start/i).length === 0) {
    around = around.parentElement;
  }
  expect(around).not.toBeNull();
  expect(around!.querySelector("[role=switch],input[type=checkbox]")).toBeNull();

  await click(port);
  await enter(screen.getByRole("textbox", { name: "Port" }), "70000");
  await waitFor(() =>
    expect(screen.getByRole("textbox", { name: "Port" }).getAttribute("aria-invalid")).toBe("true"),
  );
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Port" }).value).toBe("70000");
  expect(file()).not.toMatch(/port/);

  await enter(screen.getByRole("textbox", { name: "Port" }), "4400");

  await screen.findByRole("button", { name: "4400" });
  expect(file()).toContain("port = 4400");
});

test("turning off the browser at start writes it in the file at once", async () => {
  await server();

  await click(await screen.findByRole("switch"));

  await waitFor(() => expect(file()).toContain("open_browser = false"));
  expect(screen.getByRole<HTMLInputElement>("switch").checked).toBe(false);
});

test("building in a fresh session is on by default, and turning it off writes the file at once", async () => {
  await app.open("/settings/runs");
  const fresh = await screen.findByRole<HTMLInputElement>("switch");
  expect(fresh.checked).toBe(true);

  await click(fresh);

  await waitFor(() => expect(file()).toContain("build_in_fresh_session = false"));
  await waitFor(() => expect(screen.getByRole<HTMLInputElement>("switch").checked).toBe(false));
});

test("a file that cannot be read shows its problem and no control, and the file is never overwritten", async () => {
  const broken = "[server]\nport = 0\n";
  writeFileSync(FILE, broken);
  await server();

  await refreshUntil(() => expect(screen.queryAllByRole("switch")).toHaveLength(0));
  expect(screen.queryByRole("button", { name: /Add a host name/ })).toBeNull();
  expect(file()).toBe(broken);

  // Fixed by hand, the controls come back once the page reads again.
  writeFileSync(FILE, HAND);
  await refreshUntil(() => expect(screen.getAllByRole("switch").length).toBeGreaterThan(0));
});

/** The categories' links: the list of the page's categories. */
async function categories() {
  const list = await screen.findAllByRole("list");
  return list.flatMap((l) => within(l).queryAllByRole("link"));
}

/** The settings pages' own links, by address. */
const settingsLinks = (links: Array<HTMLElement>) =>
  links.filter((link) => link.getAttribute("href")?.includes("/settings/"));

test("the sidebar's Settings link opens the settings, marked as the current page", async () => {
  atWidth(DESKTOP);
  await app.open("/");
  const nav = within(await screen.findByRole("navigation", { name: /Side/ }));

  const link = nav
    .getAllByRole("link")
    .find((l) => l.getAttribute("href") === app.path("/settings"))!;
  await click(link);

  expect(window.location.pathname).toBe(app.path("/settings"));
  await waitFor(() =>
    expect(
      within(screen.getByRole("navigation", { name: /Side/ }))
        .getAllByRole("link")
        .some(
          (l) =>
            l.getAttribute("aria-current") === "page" &&
            l.getAttribute("href") === app.path("/settings"),
        ),
    ).toBe(true),
  );
});

test("on a desktop the categories and the selected one's settings show together", async () => {
  atWidth(DESKTOP);
  await app.open("/settings");

  const links = settingsLinks(await categories());
  expect(links.length).toBeGreaterThan(1);
  // One category is selected, its settings beside the list: a switch or a field is on the page.
  await waitFor(() =>
    expect(
      screen.queryAllByRole("switch").length + screen.queryAllByRole("button").length,
    ).toBeGreaterThan(1),
  );
  expect(links.filter((l) => l.closest("[aria-current='true']")).length).toBe(1);
});

test("on a phone the categories show alone; one opens its page by address, and back leads to the list", async () => {
  atWidth(PHONE);
  await app.open("/settings");
  const links = settingsLinks(await categories());
  expect(screen.queryAllByRole("switch")).toHaveLength(0);

  const runs = links.find((l) => l.getAttribute("href") === app.path("/settings/runs"))!;
  await click(runs);

  expect(window.location.pathname).toBe(app.path("/settings/runs"));
  await screen.findByRole("switch");
  const back = screen
    .getAllByRole("link")
    .find((l) => l.getAttribute("href") === app.path("/settings"))!;
  await click(back);
  expect(window.location.pathname).toBe(app.path("/settings"));
  expect(settingsLinks(await categories()).length).toBe(links.length);
});

test.each([
  ["a desktop", DESKTOP],
  ["a phone", PHONE],
])("on %s an unknown category reads as none", async (_name, width) => {
  atWidth(width);
  await app.open("/settings/nope");

  expect(settingsLinks(await categories()).length).toBeGreaterThan(1);
});

test.each([DESKTOP, PHONE])(
  "at %i px, searching finds a setting under its category, opens it, and clears the search",
  async (width) => {
    atWidth(width);
    await app.open("/settings/runs");
    const field = await screen.findByRole<HTMLInputElement>("textbox");

    await type(field, "port");

    // The found setting links to its category, `server`, and the categories' list gives way.
    const found = await waitFor(() => {
      const link = screen
        .getAllByRole("link")
        .find((l) => l.getAttribute("href") === app.path("/settings/server"));
      expect(link).toBeTruthy();
      return link!;
    });
    await click(found);

    expect(window.location.pathname).toBe(app.path("/settings/server"));
    await waitFor(() =>
      expect(screen.getByRole<HTMLInputElement>("textbox", { name: /./ }).value).toBe(""),
    );
  },
);

test("a search with no match shows no setting, and clearing it shows the categories again", async () => {
  atWidth(DESKTOP);
  await app.open("/settings");
  const field = await screen.findByRole<HTMLInputElement>("textbox");

  await type(field, "xyzzy");

  await waitFor(() => expect(settingsLinks(screen.queryAllByRole("link"))).toHaveLength(0));
  await type(field, "");
  expect(settingsLinks(await categories()).length).toBeGreaterThan(1);
});
