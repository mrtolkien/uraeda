// The settings page's Server section, on a server in process with a config folder of its own:
// US1, the allowed host names added, edited, and removed, asking first only for this browser's own
// while the file's names are in force (review focus 7); US2.4, a flag in force; US3, the port and
// the browser at start; and a file that cannot be read. C2's borders are checked in screenshots.
// The page opened from the sidebar; and, from the layout's look (its US5), one form of sections at
// a desktop's and a phone's width, the later settings, a deep link to a section (its review focus
// 8), and the search that filters the form's rows.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, onTestFinished, test, vi } from "vite-plus/test";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { searchSettings } from "../settings/categories.ts";
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
  await click(await screen.findByRole("button", { name: "Add a host name" }));
  return screen.getByRole("textbox", { name: "New host name" });
}

/** The UI look's mono font has no "＋": the Add row draws the plus icon, never the character. */
test("the Add row of the host names draws no ＋ character", async () => {
  await server(configDir());
  const add = await screen.findByRole("button", { name: "Add a host name" });
  expect(add.textContent).not.toContain("＋");
});

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

/** A section of the form, once it shows. */
const section = async (name: string) => within(await screen.findByRole("region", { name }));

/** The problem of a file whose port is 0, as the server says it. */
const PORT_PROBLEM =
  /^Cannot read .*config\.toml: line 2, port: The port is a number from 1 to 65535\.$/;

/** What the file's problem tells to do, under it. */
const FIX = "Fix the file to change settings here. Until then, the server uses its defaults.";

/** Edge case: settings.toml missing or invalid. */
test("a settings file that cannot be read shows its problem in Server and Runs, and no control there", async () => {
  const dir = configDir("[server]\nport = 0\n");
  await server(dir);

  for (const name of ["Server", "Runs"]) {
    const shown = await section(name);
    expect(shown.getByText(PORT_PROBLEM)).toBeTruthy();
    expect(shown.getByText(FIX)).toBeTruthy();
  }
  expect((await section("Appearance")).queryByText(PORT_PROBLEM)).toBeNull();
  expect((await section("Sign-in")).queryByText(PORT_PROBLEM)).toBeNull();
  expect(screen.queryByRole("button", { name: "Add a host name" })).toBeNull();
  expect(screen.queryByRole("switch", { name: "Open a browser at start" })).toBeNull();
  expect(screen.queryByRole("switch", { name: "Build in a fresh session" })).toBeNull();
  // What does not depend on the file stays: the colour scheme, and signing out.
  expect(screen.getByRole("radiogroup", { name: "Colour scheme" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
});

test("building in a fresh session is on by default, and turning it off writes it in the file at once", async () => {
  const dir = configDir();
  await renderPage("/settings/runs", fixtureRepo(), { settings: { dir } });
  await screen.findByRole("heading", { name: "Runs" });
  const fresh = await screen.findByRole<HTMLInputElement>("switch", {
    name: "Build in a fresh session",
  });
  expect(fresh.checked).toBe(true);

  await click(fresh);

  await waitFor(() => expect(file(dir)).toContain("[runs]\nbuild_in_fresh_session = false"));
  await waitFor(() =>
    expect(
      screen.getByRole<HTMLInputElement>("switch", { name: "Build in a fresh session" }).checked,
    ).toBe(false),
  );
});

test("the Runs section of a file that cannot be read shows its problem, and no switch", async () => {
  const dir = configDir("[runs]\nbuild_in_fresh_session = 1\n");
  await renderPage("/settings/runs", fixtureRepo(), { settings: { dir } });

  expect(
    (await section("Runs")).getByText(
      /^Cannot read .*config\.toml: line 2, build_in_fresh_session: Building in a fresh session is true or false\.$/,
    ),
  ).toBeTruthy();
  expect(screen.queryByRole("switch", { name: "Build in a fresh session" })).toBeNull();
});

/** The side navigation, as drawn on a wide screen. */
const nav = () => within(screen.getByRole("navigation", { name: "Navigation" }));

/** The side navigation, once the page shows it. */
const navShown = async () => within(await screen.findByRole("navigation", { name: "Navigation" }));

/** The form's sections, in their order. */
const SECTIONS = ["Server", "Appearance", "Sign-in", "Agents", "Runs", "Reviews"];

/** The names of the page's sections, in the order the form shows them. */
const sectionNames = () =>
  within(screen.getByRole("main"))
    .queryAllByRole("region")
    .map((region) => within(region).getByRole("heading", { level: 2 }).textContent);

/** The names of the settings the page shows, in its order. */
const settingNames = () =>
  within(screen.getByRole("main"))
    .queryAllByRole("heading", { level: 3 })
    .map((heading) => heading.textContent);

test("the sidebar's Settings opens the settings, selected there, folded too (US4 1)", async () => {
  await renderPage("/");

  await click(await (await navShown()).findByRole("link", { name: "Settings" }));

  expect(window.location.pathname).toBe(atRepo("/settings"));
  await screen.findByRole("heading", { level: 1, name: "Settings" });
  expect(nav().getByRole("link", { current: "page", name: "Settings" })).toBeTruthy();

  await click(nav().getByRole("button", { name: "Collapse navigation" }));
  await waitFor(() =>
    expect(nav().getByRole("button", { name: "Expand navigation" })).toBeTruthy(),
  );
  expect(nav().getByRole("link", { current: "page", name: "Settings" })).toBeTruthy();
});

/** Every setting of the form, today's and to come, in its order. */
const ALL = [
  "Allowed host names",
  "Port",
  "Open a browser at start",
  "Colour scheme",
  "Sign out",
  "Sign out everywhere",
  "The agent that runs each step",
  "The model and effort of each step",
  "Build in a fresh session",
  "One session for the whole feature, or a new session at each step",
  "Sub-agents during the implementation",
  "A different choice for one feature",
  "The review's command, model, and number of reviewers",
  "A second review by another model",
];

test.each([1440, 402])(
  "at %i px, one form: its sections in order, every setting a row with its help (US5)",
  async (width) => {
    atWidth(width);
    await renderPage("/settings");
    await screen.findByRole("heading", { level: 1, name: "Settings" });
    await section("Server");

    expect(sectionNames()).toEqual(SECTIONS);
    expect(settingNames()).toEqual(ALL);
    expect(screen.queryByRole("list", { name: "Categories" })).toBeNull();
    // Each row's line of help, under its name.
    expect(
      (await section("Server")).getByText(
        "The port on 127.0.0.1. A change applies at the next start.",
      ),
    ).toBeTruthy();
    expect(
      (await section("Sign-in")).getByText("This browser will need the access key again."),
    ).toBeTruthy();
  },
);

test.each([
  [
    "Runs",
    [
      ["One session for the whole feature, or a new session at each step", "run options"],
      ["Sub-agents during the implementation", "run options"],
      ["A different choice for one feature", "run options"],
    ],
  ],
  [
    "Agents",
    [
      ["The agent that runs each step", "the Codex runtime"],
      ["The model and effort of each step", "the Codex runtime"],
    ],
  ],
  [
    "Reviews",
    [
      ["The review's command, model, and number of reviewers", "review settings"],
      ["A second review by another model", "the adversarial review"],
    ],
  ],
])(
  "%s lists its later settings, each with its feature, and no control (US4 4-6)",
  async (label, settings) => {
    await renderPage("/settings");
    const rows = (await section(label))
      .getAllByRole("listitem")
      .filter((row) => within(row).queryByText(/^Comes with /));

    expect(rows.map((row) => row.textContent)).toEqual(
      settings.map(([setting, feature]) => `${setting}Comes with ${feature}.`),
    );
    for (const row of rows) {
      for (const role of ["button", "link", "textbox", "switch", "radio", "checkbox"]) {
        expect(within(row).queryAllByRole(role)).toEqual([]);
      }
    }
  },
);

/** The scroll of a section into view, with the element it scrolled. */
function watchScrolls() {
  const scrolled = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
  onTestFinished(() => scrolled.mockRestore());
  return scrolled;
}

/** Review focus 8 */
test.each([1440, 402])(
  "at %i px, /settings/runs shows the whole form, scrolled to Runs",
  async (width) => {
    atWidth(width);
    const scrolled = watchScrolls();
    await renderPage("/settings/runs");
    const runs = await screen.findByRole("region", { name: "Runs" });

    expect(sectionNames()).toEqual(SECTIONS);
    await waitFor(() => expect(scrolled.mock.contexts).toContain(runs));
  },
);

test.each(["/settings", "/settings/nope"])(
  "%s shows the form from its top: no section, or an unknown one, scrolls",
  async (path) => {
    const scrolled = watchScrolls();
    await renderPage(path);
    await section("Server");

    expect(sectionNames()).toEqual(SECTIONS);
    expect(scrolled).not.toHaveBeenCalled();
  },
);

test.each([
  ["host", [["Allowed host names", "Server"]]],
  ["FRESH", [["Build in a fresh session", "Runs"]]],
  // Task 6: the control is the colour scheme, found by its name, its choices, and "theme".
  ["COLOUR", [["Colour scheme", "Appearance"]]],
  ["scheme", [["Colour scheme", "Appearance"]]],
  ["mocha", [["Colour scheme", "Appearance"]]],
  ["Latte", [["Colour scheme", "Appearance"]]],
  ["THEME", [["Colour scheme", "Appearance"]]],
  ["dark", [["Colour scheme", "Appearance"]]],
  ["light", [["Colour scheme", "Appearance"]]],
  // US5: a setting's help finds it too.
  ["tailnet", [["Allowed host names", "Server"]]],
  [
    "  model ",
    [
      ["The model and effort of each step", "Agents"],
      ["The review's command, model, and number of reviewers", "Reviews"],
      ["A second review by another model", "Reviews"],
    ],
  ],
  [
    "sign-IN",
    [
      ["Sign out", "Sign-in"],
      ["Sign out everywhere", "Sign-in"],
    ],
  ],
  ["xyz", []],
  ["", []],
])("searching %j finds %j (C1)", (text, found) => {
  expect(searchSettings(text).map(({ category, label }) => [label, category.label])).toEqual(found);
});

/** Whether `a` comes before `b` in the page. */
const before = (a: HTMLElement, b: HTMLElement) =>
  (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

/** The search field, once the page shows it. */
const searchField = () =>
  screen.findByRole<HTMLInputElement>("textbox", { name: "Search settings" });

test.each([1440, 402])(
  "at %i px, the search is in the heading row: after the heading, before the form (US5)",
  async (width) => {
    atWidth(width);
    await renderPage("/settings");

    const field = await searchField();
    expect(before(screen.getByRole("heading", { level: 1, name: "Settings" }), field)).toBe(true);
    expect(before(field, await screen.findByRole("region", { name: "Server" }))).toBe(true);
  },
);

test.each([1440, 402])(
  "at %i px, “port” leaves the Port row alone, under Server, and clearing it shows all (US5 1)",
  async (width) => {
    atWidth(width);
    await renderPage("/settings/runs");

    await type(await searchField(), "port");

    await waitFor(() => expect(sectionNames()).toEqual(["Server"]));
    expect(settingNames()).toEqual(["Port"]);
    expect(screen.getByRole("button", { name: "4310" })).toBeTruthy();
    // The search filters rows, not sections: the Server's other rows are gone.
    expect(screen.queryByRole("switch", { name: "Open a browser at start" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add a host name" })).toBeNull();

    await type(await searchField(), "");

    await waitFor(() => expect(settingNames()).toEqual(ALL));
  },
);

test("“mocha” leaves the colour scheme, under Appearance, its control at hand (US5)", async () => {
  await renderPage("/settings");

  await type(await searchField(), "mocha");

  await waitFor(() => expect(sectionNames()).toEqual(["Appearance"]));
  expect(settingNames()).toEqual(["Colour scheme"]);
  expect(screen.getByRole("radiogroup", { name: "Colour scheme" })).toBeTruthy();
});

test("a search with no match says so, and clearing it shows the form again (US5 more 1)", async () => {
  await renderPage("/settings");
  const field = await searchField();

  await type(field, "zzz");

  expect(await screen.findByText("No setting matches “zzz”.")).toBeTruthy();
  expect(sectionNames()).toEqual([]);

  await type(field, "");

  await waitFor(() => expect(sectionNames()).toEqual(SECTIONS));
  expect(screen.queryByText("No setting matches “zzz”.")).toBeNull();
});
