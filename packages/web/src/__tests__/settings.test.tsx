// The settings page's Server category, on a server in process with a config folder of its own:
// US1, the allowed host names added, edited, and removed, asking first only for this browser's own
// while the file's names are in force (review focus 7); US2.4, a flag in force; US3, the port and
// the browser at start; and a file that cannot be read. C2's borders are checked in screenshots.
// US4: the page opened from the sidebar, its categories at a desktop's and a phone's width, the
// later settings, and an unknown category.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test } from "vite-plus/test";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { atRepo, atWidth, click, fixtureRepo, refreshUntil, renderPage, type } from "./helpers.tsx";

const MAC = "mac.tail1234.ts.net";
const PHONE = "phone.tail1234.ts.net";
const LAPTOP = "laptop.tail1234.ts.net";
const BUILD = "build.tail1234.ts.net";

/** The address the tests' pages open on, put back after each test. */
const ORIGIN = window.location.href;

afterEach(() => atHost(ORIGIN));

/** Opens the page through another address, as a browser reaching the server by that name. */
function atHost(url: string) {
  (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(url);
}

/** A new config folder, holding `text` as its settings file when given. */
function configDir(text?: string): string {
  const dir = temporaryFolder("uraeda-config");
  if (text !== undefined) {
    writeFileSync(join(dir, "config.toml"), text);
  }
  return dir;
}

/** The settings file of a config folder, or null when there is none. */
function file(dir: string): string | null {
  const path = join(dir, "config.toml");
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

/** The Server category, on the settings of `dir`, with `--allowed-hosts` given when it is. */
async function server(dir: string, allowedHosts?: Array<string>) {
  await renderPage("/settings/server", fixtureRepo(), { settings: { allowedHosts, dir } });
  await screen.findByRole("heading", { name: "Server" });
}

/** Types a line into a field and presses Enter. */
async function enter(field: HTMLElement, text: string) {
  await type(field, text);
  await act(async () => {
    fireEvent.keyDown(field, { key: "Enter" });
  });
}

/** Opens the Add row, and returns its field. */
async function addRow() {
  await click(await screen.findByRole("button", { name: "＋ Add a host name" }));
  return screen.getByRole("textbox", { name: "New host name" });
}

test("a host name added is saved in the file and listed; refusals keep the text (US1 1, 6, 7)", async () => {
  const dir = configDir();
  await server(dir);
  expect(
    screen.getByText(/^Kept in .*config\.toml, which you can also edit by hand\.$/),
  ).toBeTruthy();

  const field = await addRow();
  await enter(field, MAC);

  await screen.findByRole("button", { name: MAC });
  expect(file(dir)).toContain(`[server]\nallowed_hosts = ["${MAC}"]`);

  const saved = file(dir);
  const invalid = `https://${MAC}`;
  await enter(screen.getByRole("textbox", { name: "New host name" }), invalid);
  await screen.findByText(
    `${invalid} is not a host name: use letters, digits, hyphens, and dots, like ${MAC}.`,
  );
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "New host name" }).value).toBe(
    invalid,
  );

  await enter(screen.getByRole("textbox", { name: "New host name" }), "MAC.tail1234.ts.net");
  await screen.findByText(`${MAC} is already allowed.`);
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "New host name" }).value).toBe(
    "MAC.tail1234.ts.net",
  );
  expect(file(dir)).toBe(saved);
});

test("a host name tapped, retyped, and entered replaces it in the file (US1 3)", async () => {
  const dir = configDir(`[server]\nallowed_hosts = ["${MAC}"]\n`);
  await server(dir);

  await click(await screen.findByRole("button", { name: MAC }));
  await enter(screen.getByRole("textbox", { name: `Host name ${MAC}` }), LAPTOP);

  await screen.findByRole("button", { name: LAPTOP });
  expect(file(dir)).toContain(`allowed_hosts = ["${LAPTOP}"]`);
});

test("at 127.0.0.1, a host name is removed without asking (US1 4)", async () => {
  const dir = configDir(`[server]\nallowed_hosts = ["${MAC}", "${PHONE}"]\n`);
  await server(dir);

  await click(await screen.findByRole("button", { name: `Remove ${PHONE}` }));

  await waitFor(() => expect(file(dir)).toContain(`allowed_hosts = ["${MAC}"]`));
  expect(screen.queryByRole("dialog")).toBeNull();
  await waitFor(() => expect(screen.queryByRole("button", { name: PHONE })).toBeNull());
});

test("at localhost, removing localhost asks nothing, as it always passes (review focus 7)", async () => {
  atHost("http://localhost:4310/");
  const dir = configDir(`[server]\nallowed_hosts = ["localhost", "${MAC}"]\n`);
  await server(dir);

  await click(await screen.findByRole("button", { name: "Remove localhost" }));

  await waitFor(() => expect(file(dir)).toContain(`allowed_hosts = ["${MAC}"]`));
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("removing the host name of this browser asks first: Cancel keeps it, Remove removes it (US1 5)", async () => {
  // On the server's port, so the browser's host, with its port, is not its host name.
  atHost(`http://${MAC}:4310/`);
  const dir = configDir(`[server]\nallowed_hosts = ["${MAC}", "${PHONE}"]\n`);
  await server(dir);

  await click(await screen.findByRole("button", { name: `Remove ${MAC}` }));
  let dialog = within(
    await screen.findByRole("dialog", { name: "Remove the host name of this browser?" }),
  );
  expect(
    dialog.getByText(
      `This browser reaches Uraeda through ${MAC}. Once it is removed, the server refuses this browser until the name is added again, from another device or in the file.`,
    ),
  ).toBeTruthy();
  await click(dialog.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(file(dir)).toContain(`allowed_hosts = ["${MAC}", "${PHONE}"]`);

  await click(screen.getByRole("button", { name: `Remove ${MAC}` }));
  dialog = within(
    await screen.findByRole("dialog", { name: "Remove the host name of this browser?" }),
  );
  await click(dialog.getByRole("button", { name: "Remove" }));

  await waitFor(() => expect(file(dir)).toContain(`allowed_hosts = ["${PHONE}"]`));
  await waitFor(() => expect(screen.queryByRole("button", { name: MAC })).toBeNull());
});

test("a host name added to the file by hand is listed when the record is read again (US1 8)", async () => {
  const dir = configDir(`[server]\nallowed_hosts = ["${MAC}"]\n`);
  await server(dir);
  await screen.findByRole("button", { name: MAC });

  writeFileSync(join(dir, "config.toml"), `[server]\nallowed_hosts = ["${MAC}", "${LAPTOP}"]\n`);

  await refreshUntil(() => expect(screen.getByRole("button", { name: LAPTOP })).toBeTruthy());
});

test("with --allowed-hosts given, the note says so, a name added is saved, and this browser's is removed without asking (US2 4)", async () => {
  atHost(`http://${MAC}:4310/`);
  const dir = configDir(`[server]\nallowed_hosts = ["${MAC}"]\n`);
  await server(dir, [BUILD]);
  const note = `Set by --allowed-hosts for this run: ${BUILD}.`;
  expect(screen.getByText(note)).toBeTruthy();

  await enter(await addRow(), LAPTOP);

  await screen.findByRole("button", { name: LAPTOP });
  expect(file(dir)).toContain(`allowed_hosts = ["${MAC}", "${LAPTOP}"]`);
  expect(screen.getByText(note)).toBeTruthy();

  // The file's names are not in force: removing this browser's cuts nothing off.
  await click(screen.getByRole("button", { name: `Remove ${MAC}` }));
  await waitFor(() => expect(file(dir)).toContain(`allowed_hosts = ["${LAPTOP}"]`));
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("the port is saved for the next start, and a port out of range is refused (US3 1, 2)", async () => {
  const dir = configDir();
  await server(dir);
  expect(
    screen.getByText("The port on 127.0.0.1. A change applies at the next start."),
  ).toBeTruthy();

  await click(screen.getByRole("button", { name: "4310" }));
  await enter(screen.getByRole("textbox", { name: "Port" }), "70000");
  await screen.findByText("The port is a number from 1 to 65535.");
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Port" }).value).toBe("70000");
  expect(file(dir)).toBeNull();

  await enter(screen.getByRole("textbox", { name: "Port" }), "4400");

  await screen.findByRole("button", { name: "4400" });
  expect(file(dir)).toContain("port = 4400");
  expect(
    screen.getByText("The port on 127.0.0.1. A change applies at the next start."),
  ).toBeTruthy();
});

test("turning off the browser at start writes it in the file at once (US3 3)", async () => {
  const dir = configDir();
  await server(dir);

  await click(screen.getByRole("switch", { name: "Open a browser at start" }));

  await waitFor(() => expect(file(dir)).toContain("open_browser = false"));
});

test("a settings file that cannot be read shows its problem, and no control", async () => {
  const dir = configDir("[server]\nport = 0\n");
  await server(dir);

  expect(
    screen.getByText(
      /^Cannot read .*config\.toml: line 2, port: The port is a number from 1 to 65535\.$/,
    ),
  ).toBeTruthy();
  expect(
    screen.getByText(
      "Fix the file to change settings here. Until then, the server uses its defaults.",
    ),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "＋ Add a host name" })).toBeNull();
  expect(screen.queryByRole("switch", { name: "Open a browser at start" })).toBeNull();
});

/** The side navigation, as drawn on a wide screen. */
const nav = () => within(screen.getByRole("navigation", { name: "Side navigation" }));

/** The side navigation, once the page shows it. */
const navShown = async () =>
  within(await screen.findByRole("navigation", { name: "Side navigation" }));

/** The list of categories, once it shows. */
const categories = async () => within(await screen.findByRole("list", { name: "Categories" }));

/** The names of the categories, in the order the list shows them. */
async function categoryNames() {
  return (await categories())
    .getAllByRole("listitem")
    .map((item) => within(item).getByRole("link").textContent);
}

/** The names, each with its summary, as the list shows them. */
const LISTED = [
  "ServerHost names, port, and start",
  "AppearanceTheme, on this browser",
  "Sign-inSign out, here or everywhere",
  "AgentsComing later",
  "RunsComing later",
  "ReviewsComing later",
];

test("the sidebar's Settings opens the settings, selected there, folded too (US4 1)", async () => {
  await renderPage("/");

  await click(await (await navShown()).findByRole("link", { name: "Settings" }));

  expect(window.location.pathname).toBe(atRepo("/settings"));
  await screen.findByRole("heading", { level: 1, name: "Settings" });
  expect(nav().getByRole("link", { current: "page", name: "Settings" })).toBeTruthy();

  await click(nav().getByRole("button", { name: "Collapse sidebar" }));
  await waitFor(() => expect(nav().getByRole("button", { name: "Expand sidebar" })).toBeTruthy());
  expect(nav().getByRole("link", { current: "page", name: "Settings" })).toBeTruthy();
});

test("on a desktop, the categories in order, Server selected, its settings beside (US4 2)", async () => {
  atWidth(1440);
  await renderPage("/settings");

  expect(await categoryNames()).toEqual(LISTED);
  const selected = (await categories()).getByRole("listitem", { current: true });
  expect(within(selected).getByRole("link").textContent).toBe(LISTED[0]);
  expect(await screen.findByRole("heading", { level: 2, name: "Server" })).toBeTruthy();
});

test("on a phone, the categories alone; Runs opens its page, and ‹ Settings leads back (US4 3)", async () => {
  atWidth(402);
  await renderPage("/settings");

  expect(await categoryNames()).toEqual(LISTED);
  expect(screen.queryByRole("heading", { name: "Server" })).toBeNull();

  await click((await categories()).getByRole("link", { name: /^Runs/ }));

  expect(window.location.pathname).toBe(atRepo("/settings/runs"));
  await screen.findByRole("heading", { name: "Runs" });
  expect(screen.queryByRole("list", { name: "Categories" })).toBeNull();

  await click(screen.getByRole("link", { name: "‹ Settings" }));

  expect(window.location.pathname).toBe(atRepo("/settings"));
  expect(await categoryNames()).toEqual(LISTED);
});

test.each([
  [
    "runs",
    "Runs",
    [
      ["One session for the whole feature, or a new session at each step", "run options"],
      ["Sub-agents during the implementation", "run options"],
      ["A different choice for one feature", "run options"],
    ],
  ],
  [
    "agents",
    "Agents",
    [
      ["The agent that runs each step", "the Codex runtime"],
      ["The model and effort of each step", "the Codex runtime"],
    ],
  ],
  [
    "reviews",
    "Reviews",
    [
      ["The review's command, model, and number of reviewers", "review settings"],
      ["A second review by another model", "the adversarial review"],
    ],
  ],
])(
  "/settings/%s lists its later settings, each with its feature, and no control (US4 4-6)",
  async (id, label, settings) => {
    await renderPage(`/settings/${id}`);
    const list = within(await screen.findByRole("list", { name: `${label}, coming later` }));

    expect(list.getAllByRole("listitem").map((item) => item.textContent)).toEqual(
      settings.map(([setting, feature]) => `${setting}Comes with ${feature}`),
    );
    for (const role of ["button", "link", "textbox", "switch", "radio", "checkbox"]) {
      expect(list.queryAllByRole(role)).toEqual([]);
    }
  },
);

test("an unknown category reads as none: on a phone, the list of categories", async () => {
  atWidth(402);
  await renderPage("/settings/nope");

  expect(await categoryNames()).toEqual(LISTED);
  expect(screen.queryByRole("heading", { name: "Server" })).toBeNull();
});

test("an unknown category reads as none: on a desktop, Server beside the list", async () => {
  atWidth(1440);
  await renderPage("/settings/nope");

  expect(await categoryNames()).toEqual(LISTED);
  expect(await screen.findByRole("heading", { level: 2, name: "Server" })).toBeTruthy();
});
