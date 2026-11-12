// The walk through the app, `just walk`: one person, a developer who lives in the keyboard and
// checks in from the phone (`specs/ui/personas.md`, Tolki), doing a day's work on the sandbox,
// start to end. Each step of the journey is a test, which presses keys as that person would (the
// first pass never touches the pointer), and takes a numbered picture after each thing done, in
// `target/shots/walk/<step>-<n>-<what>.png`. The second pass is the phone's: 390 points wide, by
// presses and long presses. It asserts little: it is a tool to look at the app with, run again
// after a fix, and never part of a check. `nsh test` alone, without a display, skips it.
import { type App, open, test } from "nsh/test";

const SHOTS = "../target/shots/walk";
const LONG = 300_000;

/** The pause after a key, as a person's: a key's result has drawn before the next. */
const BEAT = 150;

/**
 * Whether the run draws: `nsh test` alone has no display, and takes no picture. Asked once per
 * run, so the suite's headless run skips every step at once.
 */
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

/** The key that types `char`: a capital is Shift and its letter. */
const keyOf = (char: string) =>
  char === " "
    ? "space"
    : /[A-Z]/.test(char)
      ? `shift+${char.toLowerCase()}`
      : (SHIFTED[char] ?? char);

/** The characters typed with Shift, as the key under them. */
const SHIFTED: Record<string, string> = {
  "?": "shift+/",
  ":": "shift+;",
  "!": "shift+1",
  '"': "shift+'",
  "(": "shift+9",
  ")": "shift+0",
};

/** Does `each` for every item, one after the other, as a person's hands do. */
const inTurn = <T,>(items: ReadonlyArray<T>, each: (item: T) => Promise<void>) =>
  items.reduce<Promise<void>>((done, item) => done.then(() => each(item)), Promise.resolve());

/** One step of the journey, on the app it opened: its keys, its pictures, its words. */
class Walk {
  private shots = 0;
  constructor(
    readonly app: App,
    private readonly named: string,
  ) {}

  /** A picture of what is shown now, numbered in the step. */
  async shot(what: string) {
    this.shots += 1;
    // The shaders' frames come back a frame or two after they are drawn.
    await this.app.wait(700);
    const n = String(this.shots).padStart(2, "0");
    await this.app.screenshot(`${SHOTS}/${this.named}-${n}-${what}.png`);
  }

  /** Keys pressed one after the other, as a person types them: `"g"`, `"i"`. */
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
  async sees(words: string, timeout = 20_000): Promise<boolean> {
    try {
      await this.app.waitUntil(() => this.text().includes(words), { timeout });
      return true;
    } catch {
      console.log(`[walk] ${this.named}: never saw “${words}”`);
      await this.shot(`never-${words.slice(0, 24).replace(/[^A-Za-z0-9]+/g, "-")}`);
      return false;
    }
  }

  /** Opens an address, as a link would: the start of a step, never its keys. */
  async go(address: string) {
    await this.app.host.send("go", address);
    await this.app.wait(1200);
  }

  /** Types into the field `selector` names, or says it is not there: a form's field by its id. */
  async fill(selector: string, words: string) {
    try {
      await this.app.type(selector, words);
    } catch (error) {
      console.log(`[walk] ${this.named}: no field ${selector}: ${String(error).slice(0, 200)}`);
    }
  }

  /** Does `body`, and goes on when it fails: the failure is a finding, with its picture. */
  async attempt(what: string, body: () => Promise<void>) {
    try {
      await body();
    } catch (error) {
      console.log(`[walk] ${this.named}: ${what} failed: ${String(error).slice(0, 400)}`);
      await this.shot(`failed-${what.replace(/[^A-Za-z0-9]+/g, "-")}`);
    }
  }

  text() {
    return this.app.texts().join(" ");
  }
}

type Look = { theme?: "dark" | "light"; width?: number; height?: number };

/** The whole app over the walk's sandbox, at a desktop's width unless `look` says otherwise. */
async function opened(named: string, look: Look = {}): Promise<Walk | null> {
  if (!(await draws())) return null;
  const theme = look.theme ?? "dark";
  const app = await open("./__checks__/Walk.tsx", {
    colorScheme: theme,
    height: look.height ?? 900,
    host: { params: { theme } },
    network: "live",
    width: look.width ?? 1400,
  });
  await app.waitUntil(() => app.shows("id:frame"), { timeout: 30_000 });
  await app.wait(1500);
  return new Walk(app, named);
}

/** A step of the journey, as a test of its own: one failing leaves the others to run. */
function step(name: string, body: (walk: Walk) => Promise<void>, look: Look = {}) {
  test(
    name,
    async () => {
      const walk = await opened(name.split(" ")[0] ?? name, look);
      if (walk === null) return;
      await body(walk);
    },
    LONG,
  );
}

const THOUGHT = "Group the inbox by day";

// --- The desk: keys only ---------------------------------------------------------------------

step("01-home what needs me, and a thought in the inbox", async (walk) => {
  await walk.go("/r/sample/");
  await walk.sees("Inbox");
  await walk.shot("home");
  await walk.keys("a");
  await walk.shot("home-add-focused");
  await walk.typed(THOUGHT);
  await walk.keys("Enter");
  await walk.sees(`Added “${THOUGHT}”`);
  await walk.shot("home-added");
  await walk.keys("Escape", "?");
  await walk.shot("home-key-map");
  await walk.keys("Escape", "space");
  await walk.shot("leader");
  await walk.keys("Escape");
});

step("02-proposal the thought becomes a feature", async (walk) => {
  await walk.go("/r/sample/");
  await walk.keys("g", "i");
  await walk.sees(THOUGHT);
  await walk.shot("inbox");
  // The quick add wrote it at the end of the notes without a category: the fourth row, three
  // under the cursor a focused list shows on its first.
  await walk.keys("j", "j", "j");
  await walk.shot("inbox-the-thought");
  await walk.keys("p");
  await walk.shot("promote-picker");
  await walk.typed("now proposal file");
  await walk.shot("promote-filtered");
  await walk.keys("Enter");
  await walk.app.wait(2500);
  await walk.shot("promoted");
  // The toast offers to open the priorities by a press only: the keys go there.
  await walk.keys("g", "p");
  await walk.sees("Group the inbox by day");
  await walk.shot("priorities");
  await walk.keys("l");
  await walk.shot("priorities-now");
  await walk.keys("Enter");
  await walk.app.wait(2000);
  await walk.shot("proposal");
  await walk.keys("i");
  await walk.shot("proposal-editing");
  await walk.typed(
    "Notes added on the same day read as one group, under that day's date, newest day first.",
  );
  await walk.keys("Enter", "Enter");
  await walk.typed("A note keeps its own time, shown on hover and in its pane.");
  await walk.shot("proposal-typed");
  await walk.keys("ctrl+Enter");
  await walk.app.wait(1500);
  await walk.shot("proposal-saved");
  // Start: the dialog asks its short name and shows the run map; one step's effort changed.
  await walk.keys("Escape", "s");
  await walk.app.wait(1200);
  await walk.shot("start-dialog");
  // Tab leaves the short name for the map, whose keys then move on it.
  await walk.keys("Tab");
  await walk.shot("start-dialog-map");
  // The Spec's tile, past the joint after Discovery, then its effort.
  await walk.keys("l", "l", "e");
  await walk.shot("start-dialog-effort");
  await walk.keys("j", "Enter");
  await walk.shot("start-dialog-effort-picked");
  // Ctrl+Enter starts, from the map as from the short name: the dialog is the deliberate step.
  await walk.keys("ctrl+Enter");
  await walk.app.wait(1500);
  await walk.shot("start-asked");
  await walk.app.wait(6000);
  await walk.shot("started");
});

step("03-feature watching the agent at work", async (walk) => {
  await walk.go("/r/sample/");
  await walk.keys("space", "f", "f");
  await walk.typed("group the inbox");
  await walk.shot("features-picker-filtered");
  await walk.keys("Enter");
  await walk.app.wait(2500);
  await walk.shot("feature");
  // Its first run waits for Continue: the dialog shows the run map, Enter sends it.
  await walk.keys("n");
  await walk.app.wait(1200);
  await walk.shot("continue-dialog");
  await walk.keys("Enter");
  await walk.app.wait(3000);
  await walk.shot("running");
  await walk.keys("l");
  await walk.shot("feature-side");
  await walk.keys("j", "shift+Enter");
  await walk.app.wait(2000);
  await walk.shot("session-beside");
  await walk.keys("i");
  await walk.shot("composer-focused");
  await walk.typed("Keep the dates in the server's time zone, slowly please.");
  await walk.keys("Enter");
  await walk.app.wait(1500);
  await walk.shot("message-sent");
  await walk.typed("And group by week past a month.");
  await walk.shot("typing-while-it-replies");
  await walk.keys("Escape", "x");
  await walk.app.wait(2000);
  await walk.shot("stopped");
  await walk.keys("g", "h");
  await walk.app.wait(1500);
  await walk.keys("b");
  await walk.app.wait(2000);
  await walk.shot("back-at-feature");
  await walk.keys("n");
  await walk.app.wait(1500);
  await walk.shot("continue-again");
  await walk.keys("Escape");
});

step("04-round answering a round of questions", async (walk) => {
  await walk.go("/r/sample/");
  await walk.shot("home-needs-you");
  // The round of `round-mockup`: the seventh card of Needs you, whose cursor starts on the first.
  await walk.keys("j", "j", "j", "j", "j");
  await walk.shot("home-card-picked");
  await walk.keys("Enter");
  await walk.app.wait(2500);
  await walk.shot("round");
  await walk.keys("n");
  await walk.shot("round-q1");
  await walk.keys("a");
  await walk.shot("round-q1-answered");
  await walk.keys("i");
  await walk.typed("Only on the desktop for now.");
  await walk.keys("ctrl+Enter");
  await walk.shot("round-q2-commented");
  await walk.keys("Escape", "s");
  await walk.app.wait(2000);
  await walk.shot("round-ask-beside");
  await walk.keys("Escape", "h");
  await walk.shot("round-back");
  await walk.keys("b", "b", "b", "b", "b", "b");
  await walk.shot("round-answered-on");
  await walk.keys("n", "n", "n");
  await walk.shot("round-end");
});

step("05-spec reading a long spec, commenting, approving", async (walk) => {
  await walk.go("/r/realistic/");
  await walk.keys("space", "f", "f");
  await walk.typed("leader");
  await walk.shot("picker-leader");
  await walk.keys("Enter");
  await walk.app.wait(2500);
  await walk.shot("feature");
  await walk.keys("n");
  await walk.app.wait(2500);
  await walk.shot("spec");
  await walk.keys("j");
  await walk.shot("cursor-first");
  await walk.keys("j", "j", "i");
  await walk.shot("comment-open");
  await walk.typed("Name the leader's timeout, and say why 300 ms.");
  await walk.keys("ctrl+Enter");
  await walk.shot("comment-saved");
  await walk.keys("j", "j", "j", "j", "i");
  await walk.typed("Keep the which-key order stable.");
  await walk.keys("ctrl+Enter");
  await walk.shot("two-comments");
  // The outline, beside: a heading jumps the reader there.
  await walk.keys("l", "k", "l");
  await walk.shot("outline");
  await walk.keys("j", "j", "j", "Enter");
  await walk.app.wait(1500);
  await walk.shot("outline-jump");
  // The decision the spec changes, as its branch has it, then back.
  await walk.keys("l", "k", "l");
  await walk.shot("decisions-tab");
  await walk.keys("j", "Enter");
  await walk.app.wait(2000);
  await walk.shot("decision-on-branch");
  await walk.keys("b");
  await walk.app.wait(2000);
  await walk.shot("back-at-spec");
  await walk.keys("G");
  await walk.app.wait(1000);
  await walk.shot("end");
  // The verdict: the Review tab, then its Approve.
  await walk.keys("l", "k", "h", "h");
  await walk.shot("review-tab");
  await walk.keys("n");
  await walk.app.wait(2000);
  await walk.shot("verdict");
});

step("05b-mockup a mockup embedded live, picked and commented", async (walk) => {
  await walk.go("/r/realistic/f/2026-10-19-leader-key/mockups/picker.html");
  await walk.app.wait(4000);
  await walk.shot("mockup");
  await walk.keys("p");
  await walk.shot("pick-mode");
  await walk.keys("Escape", "w");
  await walk.shot("next-width");
  await walk.keys("i");
  await walk.app.wait(2000);
  await walk.shot("comment-on-mockup");
});

step("06-plan a plan's progress, a task, the run map", async (walk) => {
  await walk.go("/r/sample/");
  await walk.keys("space", "f", "f");
  await walk.typed("redesign clar");
  await walk.keys("Enter");
  await walk.app.wait(2500);
  await walk.shot("feature");
  await walk.keys("j", "j");
  await walk.shot("steps-down");
  await walk.keys("k", "k", "k");
  await walk.shot("run-map");
  await walk.keys("l");
  await walk.app.wait(1500);
  await walk.shot("side");
  await walk.go("/r/realistic/f/2026-10-18-due-reminders/plan.md");
  await walk.app.wait(2500);
  await walk.shot("long-plan");
  await walk.keys("l");
  await walk.shot("plan-side");
  await walk.keys("k", "l");
  await walk.shot("plan-side-tab");
  await walk.keys("j", "Enter");
  await walk.app.wait(1500);
  await walk.shot("plan-task-opened");
});

step("07-git what changed, a diff, stage, commit, a refusal, an undo", async (walk) => {
  await walk.go("/r/sample/");
  await walk.keys("g", "c");
  await walk.app.wait(2500);
  await walk.shot("git");
  await walk.keys("Enter");
  await walk.app.wait(2000);
  await walk.shot("diff");
  await walk.keys("n");
  await walk.shot("diff-next-change");
  await walk.keys("h");
  await walk.shot("back-to-changes");
  await walk.keys("s");
  await walk.app.wait(1500);
  await walk.shot("staged");
  await walk.keys("c");
  await walk.shot("message-field");
  await walk.typed("docs: the day's notes");
  await walk.keys("ctrl+Enter");
  await walk.app.wait(3000);
  await walk.shot("committed");
  await walk.keys("Escape");
  // A note in `broken`, whose hook refuses every commit.
  await walk.go("/r/broken/");
  await walk.keys("a");
  await walk.typed("A note the hook refuses");
  await walk.keys("Enter", "Escape", "g", "c");
  await walk.app.wait(2500);
  await walk.shot("broken-git");
  await walk.keys("s", "c");
  await walk.typed("docs: refused");
  await walk.keys("ctrl+Enter");
  await walk.app.wait(3000);
  await walk.shot("refused");
  await walk.keys("Escape", "g", "h");
  await walk.app.wait(2000);
  await walk.shot("leave-asked");
  // The dialog's Stay has the focus: Tab to Leave page, Enter.
  await walk.keys("Tab", "Enter");
  await walk.app.wait(2000);
  await walk.shot("refused-elsewhere");
  await walk.keys("space");
  await walk.app.wait(600);
  await walk.shot("leader-with-refused");
  await walk.keys("x");
  await walk.app.wait(1500);
  await walk.shot("refused-dismissed");
  // A note deleted in the inbox, undone from the priorities.
  await walk.go("/r/sample/inbox");
  await walk.keys("j", "d");
  await walk.app.wait(1500);
  await walk.shot("deleted");
  await walk.keys("g", "p");
  await walk.app.wait(1500);
  await walk.keys("u");
  await walk.app.wait(2000);
  await walk.shot("undone-elsewhere");
});

step("08-sessions a chat found, the long one, a diff beside", async (walk) => {
  await walk.go("/r/sample/");
  await walk.keys("g", "s");
  await walk.app.wait(2500);
  await walk.shot("sessions");
  await walk.keys("/");
  await walk.typed("long");
  await walk.shot("search");
  await walk.keys("Enter");
  await walk.app.wait(1000);
  await walk.keys("Escape", "j", "Enter");
  await walk.app.wait(5000);
  await walk.shot("long-chat");
  await walk.keys("g", "g");
  await walk.app.wait(3000);
  await walk.shot("long-chat-start");
  await walk.keys("G");
  await walk.app.wait(3000);
  await walk.shot("long-chat-end");
  await walk.go("/r/sample/f/2026-10-17-keyboard-shortcuts/session");
  await walk.app.wait(2500);
  await walk.shot("session");
  await walk.keys("l");
  await walk.shot("session-side");
  await walk.keys("k", "l", "l");
  await walk.shot("session-side-tab");
  await walk.keys("j", "shift+Enter");
  await walk.app.wait(2000);
  await walk.shot("diff-beside");
});

step("09-panes arranging the session page", async (walk) => {
  await walk.go("/r/sample/f/2026-10-17-keyboard-shortcuts/session");
  await walk.app.wait(2500);
  await walk.keys("l", "space", "w");
  await walk.app.wait(600);
  await walk.shot("pane-menu");
  await walk.keys("s");
  await walk.shot("side-split");
  await walk.keys("space", "w", "H");
  await walk.shot("sent-to-main");
  await walk.keys("space", "w", "z");
  await walk.shot("zoomed");
  await walk.keys("space", "w", "z", "g", "h");
  await walk.app.wait(1500);
  await walk.keys("b");
  await walk.app.wait(2000);
  await walk.shot("came-back");
  await walk.keys("space", "w", "r");
  await walk.shot("reset");
});

step("10-decisions reading, following a link, the check", async (walk) => {
  await walk.go("/r/realistic/");
  await walk.keys("g", "d");
  await walk.app.wait(2500);
  await walk.shot("decisions");
  await walk.keys("j", "j", "Enter");
  await walk.app.wait(2000);
  await walk.shot("decision");
  await walk.keys("/");
  await walk.typed("git");
  await walk.shot("filtered");
  await walk.keys("Enter", "Escape");
  await walk.app.wait(1500);
  await walk.shot("after-filter");
  await walk.keys("r");
  await walk.app.wait(2500);
  await walk.shot("check");
});

step("11-jobs add, a mistyped time, run now, pause", async (walk) => {
  await walk.go("/r/sample/");
  await walk.keys("g", "j");
  await walk.app.wait(2500);
  await walk.shot("jobs");
  await walk.keys("a");
  await walk.app.wait(1000);
  await walk.shot("add");
  await walk.fill("id:job-name", "Standup notes");
  await walk.fill("id:job-prompt", "Sum up yesterday's commits.");
  await walk.fill("id:job-time", "25:00");
  await walk.keys("Escape", "G");
  await walk.shot("bad-time");
  await walk.keys("Enter");
  await walk.app.wait(1500);
  await walk.shot("bad-time-refused");
  await walk.app.clear("id:job-time").catch(() => undefined);
  await walk.fill("id:job-time", "9:30");
  await walk.keys("Escape", "G", "Enter");
  await walk.app.wait(2000);
  await walk.shot("added");
  await walk.keys("g", "j");
  await walk.app.wait(1500);
  await walk.shot("jobs-again");
  await walk.keys("r");
  await walk.app.wait(2000);
  await walk.shot("run-now");
  await walk.keys("p");
  await walk.app.wait(1500);
  await walk.shot("paused");
});

step("12-settings theme, font, Vim, an extension, accounts", async (walk) => {
  await walk.go("/r/sample/");
  await walk.keys("g", ",");
  await walk.app.wait(2500);
  await walk.shot("settings");
  await walk.keys("space", "u", "t");
  await walk.shot("themes");
  await walk.keys("j", "j", "Enter");
  await walk.app.wait(1500);
  await walk.shot("theme-changed");
  await walk.keys("space", "u", "f", "c");
  await walk.shot("code-fonts");
  await walk.keys("j", "Enter");
  await walk.app.wait(1500);
  await walk.shot("font-changed");
  await walk.keys("/");
  await walk.typed("vim");
  await walk.shot("search-vim");
  await walk.keys("Enter", "Escape");
  await walk.app.wait(1000);
  await walk.shot("vim-found");
  await walk.keys("/");
  await walk.typed("extensions");
  await walk.keys("Enter", "Escape");
  await walk.app.wait(1000);
  await walk.shot("extensions");
  await walk.keys("/");
  await walk.typed("accounts");
  await walk.keys("Enter", "Escape");
  await walk.app.wait(1000);
  await walk.shot("accounts");
  await walk.keys("/");
  await walk.typed("devices");
  await walk.keys("Enter", "Escape");
  await walk.app.wait(1000);
  await walk.shot("devices");
});

step("13-extension an extension's place, and a broken one", async (walk) => {
  await walk.go("/r/sample/");
  await walk.keys("space");
  await walk.app.wait(600);
  await walk.shot("leader");
  await walk.keys("k");
  await walk.app.wait(3000);
  await walk.shot("wiki");
  await walk.go("/r/sample/e/hello/hello");
  await walk.app.wait(3000);
  await walk.shot("hello");
  await walk.keys("g", ",");
  await walk.app.wait(1500);
  await walk.keys("/");
  await walk.typed("extensions");
  await walk.keys("Enter");
  await walk.app.wait(2000);
  await walk.shot("extensions");
  await walk.keys("Escape", "j", "j", "j");
  await walk.shot("extensions-down");
});

step("14-server the server stops under the app, and comes back", async (walk) => {
  await walk.go("/r/sample/");
  await walk.shot("server-stops");
  await walk.app.wait(4000);
  await walk.shot("server-gone");
  await walk.app.wait(1500);
  await walk.shot("server-gone-later");
  await walk.app.wait(10000);
  await walk.shot("server-back");
});

// --- The phone: 390 points wide, by touch ------------------------------------------------------

const PHONE: Look = { height: 844, width: 390 };

step(
  "p1-home checking in from the train",
  async (walk) => {
    await walk.go("/r/sample/");
    await walk.app.wait(1500);
    await walk.shot("home");
    await walk.app.scroll("id:frame", 600).catch(() => undefined);
    await walk.shot("home-scrolled");
    await walk.app.press("id:bottom-bar >> label:Inbox");
    await walk.shot("home-inbox-pane");
    await walk.app.press("text:A note for later").catch(() => undefined);
    await walk.typed("Call the bank about the card");
    await walk.shot("note-typed");
    await walk.app.keyboard.press("Enter");
    await walk.app.wait(1500);
    await walk.shot("note-added");
    await walk.app.press("label:Open the sidebar");
    await walk.app.wait(800);
    await walk.shot("sidebar");
    await walk.app.wait(2500);
    await walk.shot("sidebar-later");
  },
  PHONE,
);

step(
  "p2-round answering one-handed",
  async (walk) => {
    await walk.go("/r/sample/f/2026-10-17-round-mockup");
    await walk.app.wait(2000);
    await walk.shot("feature");
    await walk.app.press("id:feature-next");
    await walk.app.wait(2000);
    await walk.shot("round");
    await walk.app.press("id:round-next");
    await walk.shot("question");
    await walk.app.press("id:bottom-bar-action").catch(() => undefined);
    await walk.shot("bottom-action");
    await walk.fill("id:round-comment", "Only on the desktop for now.");
    await walk.shot("commented");
    await walk.app.press("id:round-next").catch(() => undefined);
    await walk.shot("next-question");
    await walk.app.longPress("id:round-next").catch(() => undefined);
    await walk.shot("long-press");
  },
  PHONE,
);

step(
  "p3-session reading a session and sending a message",
  async (walk) => {
    await walk.go("/r/sample/f/2026-10-19-dark-mode/session");
    await walk.app.wait(2500);
    await walk.shot("session");
    await walk.fill("id:composer", "Keep the toggle in the header, please.");
    await walk.shot("typed");
    await walk.app.press("label:Send").catch(() => undefined);
    await walk.app.wait(1500);
    await walk.shot("sent");
    await walk.app.wait(4000);
    await walk.shot("replied");
    await walk.app.press("id:bottom-bar >> label:Sessions").catch(() => undefined);
    await walk.shot("sessions-pane");
  },
  PHONE,
);

step(
  "p4-spec approving a spec",
  async (walk) => {
    await walk.go("/r/sample/f/2026-10-17-recurring-reminders/spec.md");
    await walk.app.wait(2500);
    await walk.shot("spec");
    await walk.app.scroll("id:frame", 1200).catch(() => undefined);
    await walk.shot("spec-scrolled");
    await walk.app.longPress("text:Spec: Recurring reminders").catch(() => undefined);
    await walk.shot("long-press-block");
    await walk.app.press("id:bottom-bar-action").catch(() => undefined);
    await walk.app.wait(1200);
    await walk.shot("verdict");
    await walk.app.press("id:review-approve").catch(() => undefined);
    await walk.app.wait(2500);
    await walk.shot("approved");
  },
  PHONE,
);

step(
  "p5-inbox long press and the menu",
  async (walk) => {
    await walk.go("/r/sample/inbox");
    await walk.app.wait(2000);
    await walk.shot("inbox");
    await walk.app.longPress("text:We need a home icon").catch(() => undefined);
    await walk.app.wait(800);
    await walk.shot("long-press");
    await walk.app.press("text:We need a home icon").catch(() => undefined);
    await walk.app.wait(1500);
    await walk.shot("note");
    await walk.app.press("label:More places").catch(() => undefined);
    await walk.shot("more");
  },
  PHONE,
);

// --- Both themes: the pictures that matter, in light, wide and narrow --------------------------

const SEEN = [
  ["home", "/r/sample/"],
  ["inbox", "/r/sample/inbox"],
  ["feature", "/r/sample/f/2026-10-17-redesign-clarifications"],
  ["round", "/r/sample/f/2026-10-17-round-mockup/clarifications-01.md"],
  ["spec", "/r/realistic/f/2026-10-19-leader-key/spec.md"],
  ["session", "/r/sample/f/2026-10-17-keyboard-shortcuts/session"],
  ["git", "/r/sample/git"],
  ["settings", "/r/sample/settings"],
] as const;

for (const width of [1400, 390]) {
  step(
    `t${width}-light the pages that matter, in light`,
    async (walk) => {
      await inTurn(SEEN, async ([name, address]) => {
        await walk.go(address);
        await walk.app.wait(2000);
        await walk.shot(name);
      });
    },
    { height: width === 390 ? 844 : 900, theme: "light", width },
  );
}
