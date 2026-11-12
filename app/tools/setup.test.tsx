// The owner setting the app up and tending it, `just setup`: the developer who lives in the keyboard
// (`specs/ui/personas.md`, Tolki at the desk), and, for the first steps, someone who has never seen
// Uraeda. Repositories from an empty list, sign-in and devices, every category of the settings,
// the jobs, the extensions, and the agents' accounts, by keys, on the sandbox. Each thing done is a
// numbered picture in `target/shots/polish-15/<step>-<n>-<what>.png`. `scripts/setup.sh` plays the
// machine's part, which no key does: it hides a repository's folder, and writes an extension, when
// a picture names it. A tool to look at the app with, run again after a fix, never part of a
// check: `nsh test` alone, without a display, skips it.
import { type App, open, test } from "nsh/test";

const SHOTS = "../target/shots/polish-15";
const LONG = 300_000;

/** The pause after a key, as a person's: a key's result has drawn before the next. */
const BEAT = 150;

let drawing: Promise<boolean> | undefined;
const draws = () => (drawing ??= probe());

async function probe(): Promise<boolean> {
  const app = await open("../screens/shell/__checks__/Shell.tsx", {
    host: { params: { scenario: "starts" } },
  });
  try {
    await app.screenshot();
    return true;
  } catch (error) {
    if (!String(error).includes("real platform")) throw error;
    return false;
  } finally {
    app.dispose();
  }
}

/** The characters typed with Shift, as the key under them. */
const SHIFTED: Record<string, string> = {
  "?": "shift+/",
  ":": "shift+;",
  "!": "shift+1",
  '"': "shift+'",
  "(": "shift+9",
  ")": "shift+0",
  _: "shift+-",
  "~": "shift+`",
};

/** The key that types `char`: a capital is Shift and its letter. */
const keyOf = (char: string) =>
  char === " "
    ? "space"
    : /[A-Z]/.test(char)
      ? `shift+${char.toLowerCase()}`
      : (SHIFTED[char] ?? char);

const inTurn = <T,>(items: ReadonlyArray<T>, each: (item: T) => Promise<void>) =>
  items.reduce<Promise<void>>((done, item) => done.then(() => each(item)), Promise.resolve());

type Look = { theme?: "dark" | "light"; signed?: boolean };

/** One step of the flow, on the app it opened: its keys, its pictures, its words. */
class Walk {
  private shots = 0;
  constructor(
    readonly app: App,
    private readonly named: string,
  ) {}

  async shot(what: string) {
    this.shots += 1;
    await this.app.wait(700);
    const n = String(this.shots).padStart(2, "0");
    await this.app.screenshot(`${SHOTS}/${this.named}-${n}-${what}.png`);
  }

  async keys(...keys: ReadonlyArray<string>) {
    await inTurn(keys, async (key) => {
      await this.app.keyboard.press(key.length === 1 ? keyOf(key) : key);
      await this.app.wait(BEAT);
    });
  }

  async typed(words: string) {
    await inTurn([...words], (char) => this.app.keyboard.press(keyOf(char)));
    await this.app.wait(BEAT);
  }

  /** Waits for words to be drawn, or says, in a picture and the log, that they never were. */
  async sees(words: string, timeout = 15_000): Promise<boolean> {
    try {
      await this.app.waitUntil(() => this.text().includes(words), { timeout });
      return true;
    } catch {
      this.log(`never saw “${words}”`);
      await this.shot(`never-${words.slice(0, 24).replace(/[^A-Za-z0-9]+/g, "-")}`);
      return false;
    }
  }

  /** Opens an address, as a link would: the start of a step, never its keys. */
  async go(address: string) {
    await this.app.host.send("go", address);
    await this.app.wait(1500);
  }

  /** Sends the page a message: an act of the test's own, which no key does. */
  async act(name: string, data: unknown) {
    await this.app.host.send(name, data);
  }

  /** Does `body`, and goes on when it fails: the failure is a finding, with its picture. */
  async attempt(what: string, body: () => Promise<void>) {
    try {
      await body();
    } catch (error) {
      this.log(`${what} failed: ${String(error).slice(0, 400)}`);
      await this.shot(`failed-${what.replace(/[^A-Za-z0-9]+/g, "-")}`);
    }
  }

  text() {
    return this.app.texts().join(" ");
  }

  log(what: string) {
    console.log(`[setup] ${this.named}: ${what}`);
  }
}

async function launched(look: Look): Promise<App> {
  const theme = look.theme ?? "dark";
  const app = await open("./__checks__/Setup.tsx", {
    colorScheme: theme,
    height: 900,
    host: { params: { signed: look.signed === true, theme } },
    network: "live",
    width: 1400,
  });
  if (look.signed !== true) await app.waitUntil(() => app.shows("id:frame"), { timeout: 30_000 });
  await app.wait(1500);
  return app;
}

function step(name: string, body: (walk: Walk) => Promise<void>, look: Look = {}) {
  test(
    name,
    async () => {
      if (!(await draws())) return;
      const named = `${name.split(" ")[0] ?? name}${look.theme === "light" ? "-light" : ""}`;
      const walk = new Walk(await launched(look), named);
      try {
        await body(walk);
      } finally {
        walk.app.dispose();
      }
    },
    LONG,
  );
}

// --- Repositories: the first run, a bare one, an unknown address, a folder gone -----------------

// The first run, from an empty list, is the real app's (`uraeda --data-dir` on an empty folder):
// the sandbox's list is locked. Here: a repository not set up, an address of none, a folder gone.
step("01-repositories bare, unknown, gone", async (walk) => {
  await walk.go("/r/bare/");
  await walk.app.wait(2000);
  await walk.shot("bare-home");
  await walk.keys("j");
  await walk.shot("bare-j");
  await walk.keys("?");
  await walk.shot("bare-key-map");
  await walk.keys("Escape");
  await walk.go("/r/nosuch/");
  await walk.sees("No repository named");
  await walk.shot("unknown");
  await walk.keys("j");
  await walk.shot("unknown-j");
  await walk.keys("Enter");
  await walk.app.wait(1500);
  await walk.shot("unknown-enter");
  // `scripts/setup.sh` hides `empty`'s folder when it sees this picture, and puts it back at the
  // next one.
  await walk.shot("hide-folder");
  await walk.app.wait(3000);
  await walk.go("/r/empty/");
  await walk.app.wait(2000);
  await walk.shot("missing");
  await walk.keys("j");
  await walk.shot("missing-j");
  await walk.shot("show-folder");
  await walk.app.wait(4000);
  await walk.shot("missing-back");
  await walk.go("/r/sample/");
  await walk.go("/r/empty/");
  await walk.app.wait(2000);
  await walk.shot("missing-back-opened-again");
});

// --- Sign-in and devices ----------------------------------------------------------------------

step(
  "02-sign-in pairing, then the devices",
  async (walk) => {
    await walk.sees("Pair this device");
    await walk.shot("pairing");
    await walk.typed("abc");
    await walk.keys("Enter");
    await walk.shot("pairing-malformed");
    await walk.keys("ctrl+a");
    await walk.typed("7KQ2-M9XA-0TBD");
    await walk.keys("Enter");
    await walk.app.wait(1500);
    await walk.shot("pairing-wrong-code");
    await walk.keys("ctrl+a");
    await walk.typed("7kq2 m9xa 0tbe");
    await walk.keys("Enter");
    await walk.app.wait(1500);
    await walk.shot("pairing-wrong-again");
    await walk.act("pair-with-key", null);
    await walk.app.waitUntil(() => walk.app.shows("id:frame"), { timeout: 30_000 });
    await walk.app.wait(2000);
    await walk.shot("paired");
    await walk.keys("g", ",");
    await walk.app.wait(1200);
    await walk.shot("settings");
    await walk.typed("devices");
    await walk.shot("settings-search-devices");
    await walk.keys("Escape");
    await walk.attempt("sign-in category", async () => {
      await walk.app.press("text:Sign-in");
    });
    await walk.app.wait(1500);
    await walk.shot("sign-in");
    await walk.keys("j", "j");
    await walk.shot("sign-in-j");
    await walk.keys("j", "j");
    await walk.shot("sign-in-jj");
    await walk.keys("Enter");
    await walk.shot("sign-in-enter");
    await walk.keys("k", "k", "Enter");
    await walk.shot("sign-in-devices-enter");
    await walk.keys("Tab");
    await walk.shot("sign-in-tab");
    await walk.keys("Tab");
    await walk.shot("sign-in-tab-tab");
    await walk.keys("Enter");
    await walk.shot("sign-in-tab-tab-enter");
    await walk.keys("Enter");
    await walk.shot("sign-in-tab-tab-enter-enter");
    await walk.keys("Escape");
    await walk.keys("?");
    await walk.shot("sign-in-key-map");
    await walk.keys("Escape");
  },
  { signed: true },
);

// --- Settings, every category -----------------------------------------------------------------

step("03-settings every category", async (walk) => {
  await walk.go("/r/sample/");
  await walk.keys("g", ",");
  await walk.app.wait(1200);
  await walk.shot("index");
  await walk.keys("j");
  await walk.shot("index-j");
  await walk.keys("Enter");
  await walk.shot("appearance");
  await walk.keys("j");
  await walk.shot("appearance-j");
  await walk.keys("Enter");
  await walk.shot("appearance-enter");
  await walk.keys("j", "Enter");
  await walk.shot("appearance-picked");
  await walk.keys("Escape");
  await walk.keys("space", "u", "t");
  await walk.shot("theme-picker");
  await walk.keys("j", "j");
  await walk.shot("theme-picker-jj");
  await walk.keys("Escape");
  await walk.shot("theme-picker-left");
  await walk.go("/settings/fonts");
  await walk.shot("fonts");
  await walk.keys("j", "Enter");
  await walk.shot("fonts-enter");
  await walk.keys("j", "Enter");
  await walk.shot("fonts-picked");
  await walk.keys("Escape");
  await walk.go("/settings/keyboard");
  await walk.shot("keyboard");
  await walk.keys("j");
  await walk.shot("keyboard-j");
  await walk.keys("Enter");
  await walk.shot("keyboard-enter");
  await walk.keys("g", "h");
  await walk.shot("keyboard-shortcuts-off-gh");
  await walk.keys("space");
  await walk.shot("keyboard-shortcuts-off-space");
  await walk.keys("ctrl+k");
  await walk.shot("keyboard-shortcuts-off-ctrl-k");
  await walk.keys("Escape");
  await walk.go("/settings/keyboard");
  await walk.keys("j", "Enter");
  await walk.shot("keyboard-shortcuts-on-again");
  await walk.keys("j", "Enter");
  await walk.shot("keyboard-vim");
  await walk.keys("k", "Enter");
  await walk.go("/settings/runs");
  await walk.shot("runs");
  await walk.keys("j", "j");
  await walk.shot("runs-jj");
  await walk.keys("Enter");
  await walk.shot("runs-enter");
  await walk.keys("Escape");
  await walk.keys("G");
  await walk.shot("runs-end");
  await walk.go("/settings/server");
  await walk.shot("server");
  await walk.keys("j", "Enter");
  await walk.shot("server-enter");
  await walk.typed("mac.tail1234.ts.net");
  await walk.keys("Enter");
  await walk.shot("server-host-added");
  await walk.keys("Escape");
  await walk.go("/settings/extensions");
  await walk.shot("extensions");
  await walk.keys("j", "j", "j");
  await walk.shot("extensions-jjj");
  await walk.go("/settings");
  await walk.keys("/");
  await walk.typed("schedule");
  await walk.shot("search-schedule");
  await walk.keys("Escape");
  await walk.keys("/");
  await walk.typed("blur");
  await walk.shot("search-nothing");
  await walk.keys("Escape");
});

step(
  "03-settings appearance in light",
  async (walk) => {
    await walk.go("/settings/appearance");
    await walk.shot("appearance");
    await walk.go("/settings/runs");
    await walk.shot("runs");
  },
  { theme: "light" },
);

// --- Jobs ---------------------------------------------------------------------------------------

step("04-jobs add, refuse, run, pause, history, delete", async (walk) => {
  await walk.go("/r/sample/");
  await walk.keys("g", "j");
  await walk.app.wait(1500);
  await walk.shot("jobs");
  await walk.keys("a");
  await walk.app.wait(1200);
  await walk.shot("new");
  await walk.typed("Nightly docs");
  await walk.shot("new-name-typed");
  await walk.keys("Escape", "j");
  await walk.shot("new-prompt-row");
  await walk.keys("Enter");
  await walk.typed("Read the docs and fix what is out of date.");
  await walk.keys("Escape");
  await walk.shot("new-prompt-typed");
  await walk.keys("j");
  await walk.shot("new-how-often");
  await walk.keys("Enter");
  await walk.shot("new-how-often-open");
  await walk.keys("k", "k", "Enter");
  await walk.shot("new-daily");
  await walk.keys("j");
  await walk.shot("new-time-row");
  await walk.keys("Enter", "ctrl+a");
  await walk.typed("25:61");
  await walk.keys("Escape");
  await walk.shot("new-time-mistyped");
  await walk.keys("Enter", "ctrl+a");
  await walk.typed("3:00");
  await walk.keys("Escape");
  await walk.shot("new-time-3");
  await walk.keys("j");
  await walk.shot("new-repos");
  await walk.keys("j", "j", "j", "j", "j", "j");
  await walk.shot("new-agent");
  await walk.keys("Enter");
  await walk.shot("new-agent-open");
  await walk.keys("Escape", "G");
  await walk.shot("new-end");
  await walk.keys("Enter");
  await walk.app.wait(2000);
  await walk.shot("new-end-enter");
  await walk.keys("j", "Enter");
  await walk.app.wait(2000);
  await walk.shot("added");
  // A second job of the same name.
  await walk.keys("g", "j");
  await walk.app.wait(1000);
  await walk.keys("a");
  await walk.app.wait(1000);
  await walk.typed("Nightly docs");
  await walk.keys("Escape", "j", "Enter");
  await walk.typed("Again.");
  await walk.keys("Escape", "G", "Enter");
  await walk.app.wait(1500);
  await walk.shot("duplicate");
  await walk.keys("j", "Enter");
  await walk.app.wait(1500);
  await walk.shot("duplicate-added");
  await walk.keys("g", "j");
  await walk.app.wait(1500);
  await walk.shot("list-again");
  await walk.keys("j");
  await walk.shot("list-j");
  await walk.keys("r");
  await walk.shot("run-now-asks");
  await walk.keys("Enter");
  await walk.app.wait(2500);
  await walk.shot("run-now-enter");
  await walk.keys("g", "j");
  await walk.app.wait(1500);
  await walk.keys("j", "p");
  await walk.shot("paused");
  await walk.keys("p");
  await walk.shot("resumed");
  await walk.keys("Enter");
  await walk.app.wait(1500);
  await walk.shot("job-page");
  await walk.keys("l");
  await walk.shot("job-history");
  await walk.keys("j", "Enter");
  await walk.app.wait(2000);
  await walk.shot("job-history-enter");
  await walk.keys("g", "j");
  await walk.app.wait(1500);
  await walk.keys("j", "d");
  await walk.shot("delete-asks");
  await walk.keys("Enter");
  await walk.app.wait(1500);
  await walk.shot("delete-enter");
  await walk.keys("d", "y");
  await walk.app.wait(1500);
  await walk.shot("deleted");
});

// --- Extensions ---------------------------------------------------------------------------------

step("05-extensions hello, the wiki, broken pages, a new one", async (walk) => {
  await walk.go("/r/sample/");
  await walk.keys("space");
  await walk.shot("leader");
  await walk.keys("k");
  await walk.app.wait(2000);
  await walk.shot("wiki-space-k");
  await walk.go("/r/empty/e/wiki/wiki");
  await walk.app.wait(2500);
  await walk.shot("wiki-no-folder");
  await walk.go("/r/sample/");
  await walk.app.wait(2000);
  await walk.shot("wiki-home-pane-no-folder");
  await walk.go("/r/bare/e/wiki/wiki");
  await walk.app.wait(2500);
  await walk.shot("wiki-empty-folder");
  await walk.go("/r/broken/e/wiki/wiki");
  await walk.app.wait(2500);
  await walk.shot("wiki-pages");
  await walk.go("/r/broken/");
  await walk.app.wait(2500);
  await walk.shot("wiki-home-pane");
  await walk.go("/r/sample/e/hello/hello");
  await walk.app.wait(2500);
  await walk.shot("hello");
  await walk.go("/r/sample/e/crashes/crashes");
  await walk.app.wait(3000);
  await walk.shot("crashes");
  await walk.go("/r/sample/e/loops/loops");
  await walk.app.wait(7000);
  await walk.shot("loops");
  await walk.keys("g", "h");
  await walk.app.wait(1500);
  await walk.shot("home-after-loops");
  await walk.go("/settings/extensions");
  await walk.app.wait(1500);
  await walk.shot("settings-extensions");
  // `scripts/setup.sh` writes the extension `tally`, by the documentation, at this picture.
  await walk.shot("write-extension");
  await walk.app.wait(5000);
  await walk.shot("settings-after-write");
  await walk.go("/r/sample/");
  await walk.app.wait(1500);
  await walk.keys("space");
  await walk.shot("leader-with-tally");
  await walk.keys("Escape");
  await walk.go("/r/sample/e/tally/tally");
  await walk.app.wait(3000);
  await walk.shot("tally");
  await walk.keys("Tab");
  await walk.shot("tally-tab");
  await walk.keys("Enter");
  await walk.app.wait(1000);
  await walk.shot("tally-enter");
  await walk.shot("edit-extension");
  await walk.app.wait(5000);
  await walk.shot("tally-reloaded");
});

// --- Accounts and usage -------------------------------------------------------------------------

step("06-usage the accounts at a glance", async (walk) => {
  await walk.go("/r/sample/");
  await walk.app.wait(2500);
  await walk.shot("home");
  await walk.go("/r/sample/s/");
  await walk.app.wait(1500);
  await walk.shot("sessions");
});

step(
  "06-usage in light",
  async (walk) => {
    await walk.go("/r/sample/");
    await walk.app.wait(2500);
    await walk.shot("home");
  },
  { theme: "light" },
);
