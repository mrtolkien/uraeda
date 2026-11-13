// One flow, walked as its person would, `just walk-to-feature`: the owner at the desk
// (`specs/ui/personas.md`, Tolki), keys only, from a thought to a running feature, then what they do
// with the feature after. Two thoughts go in the inbox, one is edited, given an image and a
// category, and made a proposal; on the priorities it moves into Now, gets its text, with Vim off
// then on; it starts as a feature, through the start dialog and its run map; on the feature's page
// its run continues, its session replies, is interrupted, stopped, and continued; then the feature
// is renamed, postponed, and dropped. The steps run in order, on one sandbox, each picking up where
// the one before left it, and each takes a numbered picture after each thing done, in
// `target/shots/to-feature/<step>-<n>-<what>.png`. A tool to look at the flow with, never a check:
// `nsh test` alone, without a display, skips it.
import { type App, open, test } from "nsh/test";

const SHOTS = "../target/shots/to-feature";
const LONG = 300_000;
/** The pause after a key, as a person's: a key's result has drawn before the next. */
const BEAT = 150;

const FIRST = "Group the inbox by day";
const SECOND = "Pin a note to the top";
const RENAMED = "Day groups";

let drawing: Promise<boolean> | undefined;
/** Whether the run draws: `nsh test` alone has no display, and takes no picture. */
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

const SHIFTED: Record<string, string> = { "?": "shift+/", ":": "shift+;", "!": "shift+1" };
/** The key that types `char`: a capital is Shift and its letter. */
const keyOf = (char: string) =>
  char === " "
    ? "space"
    : /[A-Z]/.test(char)
      ? `shift+${char.toLowerCase()}`
      : (SHIFTED[char] ?? char);

const inTurn = <T,>(items: ReadonlyArray<T>, each: (item: T) => Promise<void>) =>
  items.reduce<Promise<void>>((done, item) => done.then(() => each(item)), Promise.resolve());

class Walk {
  private shots = 0;
  constructor(
    readonly app: App,
    private readonly named: string,
  ) {}

  /** A picture of what is shown now, numbered in the step. */
  async shot(what: string) {
    this.shots += 1;
    await this.app.wait(700);
    const n = String(this.shots).padStart(2, "0");
    await this.app.screenshot(`${SHOTS}/${this.named}-${n}-${what}.png`);
  }

  /** Keys pressed one after the other: `"g"`, `"i"`, `"ctrl+Enter"`. */
  async keys(...keys: ReadonlyArray<string>) {
    await inTurn(keys, async (key) => {
      await this.app.keyboard.press(key.length === 1 ? keyOf(key) : key);
      await this.app.wait(BEAT);
    });
  }

  /** Words typed, a key at a time, into the field that has the focus. */
  async typed(words: string) {
    await inTurn([...words], (char) => this.app.keyboard.press(keyOf(char)));
    await this.app.wait(BEAT);
  }

  /** Waits for words to be drawn, or says, in a picture and the log, that they never were. */
  async sees(words: string, timeout = 15_000): Promise<boolean> {
    try {
      await this.app.waitUntil(() => this.app.texts().join(" ").includes(words), { timeout });
      return true;
    } catch {
      console.log(`[to-feature] ${this.named}: never saw “${words}”`);
      await this.shot(`never-${words.slice(0, 24).replace(/[^A-Za-z0-9]+/g, "-")}`);
      return false;
    }
  }

  /** Opens an address, as a link would: the start of a step, never its keys. */
  async go(address: string) {
    await this.app.host.send("go", address);
    await this.app.wait(1500);
  }
}

type Look = { theme?: "dark" | "light" };

/** A step of the flow, as a test of its own: one failing leaves the others to run. */
function step(name: string, body: (walk: Walk) => Promise<void>, look: Look = {}) {
  test(
    name,
    async () => {
      if (!(await draws())) return;
      const theme = look.theme ?? "dark";
      const app = await open("./__checks__/Walk.tsx", {
        colorScheme: theme,
        height: 900,
        host: { params: { theme } },
        network: "live",
        width: 1400,
      });
      await app.waitUntil(() => app.shows("id:frame"), { timeout: 30_000 });
      await app.wait(1500);
      try {
        await body(new Walk(app, name.split(" ")[0] ?? name));
      } finally {
        app.dispose();
      }
    },
    LONG,
  );
}

step("1-home what needs me, and a thought without leaving", async (walk) => {
  await walk.go("/r/sample/");
  await walk.shot("home");
  await walk.keys("a");
  await walk.shot("add-focused");
  await walk.typed(FIRST);
  await walk.keys("Enter");
  await walk.sees(FIRST);
  await walk.shot("added");
  await walk.keys("Escape");
  await walk.shot("left-field");
});

step("2-elsewhere a second thought from the priorities", async (walk) => {
  await walk.go("/r/sample/priorities");
  await walk.shot("priorities");
  await walk.keys("space");
  await walk.shot("leader");
  await walk.keys("n");
  await walk.shot("leader-new");
  await walk.keys("i");
  await walk.shot("note-field");
  await walk.typed(SECOND);
  await walk.keys("Enter");
  await walk.sees(SECOND);
  await walk.shot("second-added");
});

step("3-inbox edit, an image, a category, a proposal", async (walk) => {
  await walk.go("/r/sample/");
  await walk.keys("g", "i");
  await walk.sees(FIRST);
  await walk.shot("inbox");
  // The list's cursor starts on its first row; the quick adds are the fourth and fifth.
  await walk.keys("j", "j", "j");
  await walk.shot("first-thought");
  await walk.keys("Enter");
  await walk.shot("note-opened");
  await walk.keys("i");
  await walk.shot("note-editing");
  await walk.keys("End");
  await walk.typed(", newest day first");
  await walk.keys("Enter");
  await walk.app.wait(1200);
  await walk.shot("note-saved");
  await walk.keys("Escape");
  const icon = new URL("../web/icon.png", import.meta.url).href;
  await walk.app.dropFiles("label:The note", [icon]).catch((error: unknown) => {
    console.log(`[to-feature] no drop of ${icon}: ${String(error).slice(0, 200)}`);
  });
  await walk.app.wait(2000);
  await walk.shot("image-dropped");
  await walk.keys("c");
  await walk.shot("category-picker");
  await walk.typed("ui");
  await walk.shot("category-filtered");
  await walk.keys("Enter");
  await walk.app.wait(1500);
  await walk.shot("moved");
  await walk.keys("p");
  await walk.shot("promote-picker");
  await walk.typed("next proposal file");
  await walk.shot("promote-filtered");
  await walk.keys("Enter");
  await walk.app.wait(2500);
  await walk.shot("promoted");
});

step("4-priorities into Now, its text, Vim off then on", async (walk) => {
  await walk.go("/r/sample/priorities");
  await walk.sees(FIRST);
  await walk.shot("priorities");
  // Its cursor starts in Ongoing: two columns on is Next, whose last row is the new proposal.
  await walk.keys("l", "l", "G");
  await walk.shot("cursor");
  await walk.keys("H");
  await walk.app.wait(1500);
  await walk.shot("sent-to-now");
  await walk.keys("Enter");
  await walk.app.wait(2000);
  await walk.shot("proposal");
  await walk.keys("i");
  await walk.shot("editing");
  await walk.keys("ctrl+End");
  await walk.keys("Enter", "Enter");
  await walk.typed(
    "Notes added on the same day read as one group, under that day's date, newest day first.",
  );
  await walk.keys("Enter", "Enter");
  await walk.typed("A note keeps its own time, shown in its pane.");
  await walk.shot("typed-vim-off");
  await walk.keys("ctrl+Enter");
  await walk.app.wait(1500);
  await walk.shot("saved");
  await walk.keys("Escape", "g", ",");
  await walk.app.wait(1500);
  await walk.keys("/");
  await walk.typed("vim");
  await walk.keys("Enter", "Escape");
  await walk.app.wait(800);
  await walk.shot("settings-vim");
  // The search lands on the Keyboard section's first row, Single-key shortcuts: Vim is the next.
  await walk.keys("j");
  await walk.shot("vim-row");
  await walk.keys("Enter");
  await walk.app.wait(1500);
  await walk.shot("vim-on");
  // Back is the settings' search, then its first page: the priorities are two keys away.
  await walk.keys("g", "p");
  await walk.app.wait(1500);
  await walk.keys("l", "Enter");
  await walk.app.wait(2000);
  await walk.shot("back-at-proposal");
  await walk.keys("i");
  await walk.shot("editing-vim");
  await walk.keys("Escape", "G", "o");
  await walk.keys("Enter");
  await walk.typed("Grouping is the list's own: the notes' file keeps its order.");
  await walk.keys("Escape");
  await walk.shot("typed-vim-normal");
  await walk.keys(":", "w", "Enter");
  await walk.app.wait(1500);
  await walk.shot("vim-saved");
  await walk.keys("Escape", "Escape", "g", "h");
  await walk.app.wait(1500);
  await walk.shot("left");
  await walk.keys("g", "p");
  await walk.app.wait(1500);
  await walk.keys("l", "Enter");
  await walk.app.wait(2000);
  await walk.sees("Grouping is the list's own");
  await walk.shot("came-back");
});

step("5-start the dialog, its run map, the writes", async (walk) => {
  await walk.go("/r/sample/priorities");
  await walk.keys("l", "Enter");
  await walk.app.wait(2000);
  await walk.shot("proposal");
  await walk.keys("s");
  await walk.app.wait(1200);
  await walk.shot("start-dialog");
  await walk.keys("Tab");
  await walk.shot("map");
  // The first key picks the map's first place, Discovery; past the joint after it is the Spec.
  await walk.keys("l", "l", "l");
  await walk.shot("map-spec");
  await walk.keys("Enter");
  await walk.shot("agent-picker");
  await walk.keys("j", "Enter");
  await walk.shot("agent-picked");
  await walk.keys("e");
  await walk.shot("effort-picker");
  await walk.keys("j", "Enter");
  await walk.shot("effort-picked");
  await walk.keys("ctrl+Enter");
  await walk.app.wait(400);
  await walk.shot("starting");
  await walk.app.wait(2500);
  await walk.shot("start-writes");
  await walk.app.wait(5000);
  await walk.shot("landed");
});

step("6-feature continue, its session beside, a message, stop, continue", async (walk) => {
  await walk.go("/r/sample/");
  await walk.keys("space", "f", "f");
  await walk.typed("group the inbox");
  await walk.keys("Enter");
  await walk.app.wait(2500);
  await walk.shot("feature");
  await walk.keys("j", "j", "j");
  await walk.shot("down");
  await walk.keys("n");
  await walk.app.wait(1200);
  await walk.shot("continue-dialog");
  await walk.keys("Enter");
  await walk.app.wait(3000);
  // The continue opens the run's session, its composer focused: Escape twice gives the page its
  // keys back, with Vim on (normal mode, then the field left).
  await walk.shot("running");
  await walk.keys("Escape", "Escape");
  await walk.app.wait(3000);
  await walk.shot("replying");
  await walk.keys("i");
  await walk.typed("Keep the dates in the server's time zone.");
  await walk.keys("Enter");
  await walk.app.wait(1200);
  await walk.shot("sent-while-replying");
  await walk.keys("Escape", "Escape", "x");
  await walk.app.wait(2000);
  await walk.shot("stopped");
  // Back to the feature by its picker: its next run waits for Continue again.
  await walk.keys("space", "f", "f");
  await walk.typed("group the inbox");
  await walk.keys("Enter");
  await walk.app.wait(2500);
  await walk.shot("back-at-feature");
  await walk.keys("l", "j", "shift+Enter");
  await walk.app.wait(2500);
  await walk.shot("session-beside");
  await walk.keys("h", "n");
  await walk.app.wait(1200);
  await walk.shot("continue-again");
  await walk.keys("Escape");
});

step("7-after rename, postpone, drop", async (walk) => {
  await walk.go("/r/sample/");
  await walk.keys("space", "f", "f");
  await walk.typed("group the inbox");
  await walk.keys("Enter");
  await walk.app.wait(2500);
  await walk.keys("R");
  await walk.shot("rename-dialog");
  await walk.keys("ctrl+a");
  await walk.typed(RENAMED);
  await walk.keys("Enter");
  await walk.app.wait(1500);
  await walk.shot("renamed");
  await walk.keys("P");
  await walk.shot("postpone-dialog");
  await walk.keys("Enter");
  await walk.app.wait(3000);
  await walk.shot("postponed");
  await walk.app.wait(4000);
  await walk.shot("postpone-replied");
  await walk.keys("b");
  await walk.app.wait(2500);
  await walk.shot("back-at-feature");
  await walk.keys("D");
  await walk.shot("drop-confirm");
  await walk.keys("y");
  await walk.app.wait(3000);
  await walk.shot("dropped");
  await walk.keys("g", "h");
  await walk.app.wait(2000);
  await walk.shot("home-after");
});

// The screens of the flow that matter, in light.
const LIGHT = [
  ["home", "/r/sample/"],
  ["inbox", "/r/sample/inbox"],
  ["priorities", "/r/sample/priorities"],
] as const;

step(
  "8-light the flow's pages in light",
  async (walk) => {
    await inTurn(LIGHT, async ([name, address]) => {
      await walk.go(address);
      await walk.shot(name);
    });
  },
  { theme: "light" },
);
