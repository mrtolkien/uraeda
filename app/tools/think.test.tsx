// The thinking work, `just think`: the owner at the desk (`specs/ui/personas.md`, Tolki at the
// keyboard) doing what Uraeda exists for, "the human's time goes into thinking, not searching":
// answering a round of questions, reviewing a spec, reading a plan, reading and checking decisions,
// and answering the inbox's triage. By keys only, on the sandbox, each thing done a numbered picture
// in `target/shots/polish-4/<step>-<n>-<what>.png`. A tool to look at the app with, run again after a
// fix, never part of a check: `nsh test` alone, without a display, skips it.
import { type App, open, test } from "nsh/test";

const SHOTS = "../target/shots/polish-4";
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

type Look = { theme?: "dark" | "light" };

/** One step of the flow, on the app it opened: its keys, its pictures, its words. */
class Walk {
  private shots = 0;
  constructor(
    public app: App,
    private readonly named: string,
    private readonly look: Look,
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
  async sees(words: string, timeout = 20_000): Promise<boolean> {
    try {
      await this.app.waitUntil(() => this.text().includes(words), { timeout });
      return true;
    } catch {
      console.log(`[think] ${this.named}: never saw “${words}”`);
      await this.shot(`never-${words.slice(0, 24).replace(/[^A-Za-z0-9]+/g, "-")}`);
      return false;
    }
  }

  /** Opens an address, as a link would: the start of a step, never its keys. */
  async go(address: string) {
    await this.app.host.send("go", address);
    await this.app.wait(1500);
  }

  /** Closes the app's page and opens it again, on the same device: a restart. */
  async restart() {
    const kept = this.app.storage();
    this.app.dispose();
    this.app = await launched(this.look, kept);
  }

  text() {
    return this.app.texts().join(" ");
  }

  log(what: string) {
    console.log(`[think] ${this.named}: ${what}`);
  }
}

async function launched(look: Look, storage?: Record<string, string>): Promise<App> {
  const theme = look.theme ?? "dark";
  const app = await open("./__checks__/Walk.tsx", {
    colorScheme: theme,
    height: 900,
    host: { params: { theme } },
    network: "live",
    storage,
    width: 1400,
  });
  await app.waitUntil(() => app.shows("id:frame"), { timeout: 30_000 });
  await app.wait(1500);
  return app;
}

function step(name: string, body: (walk: Walk) => Promise<void>, look: Look = {}) {
  test(
    name,
    async () => {
      if (!(await draws())) return;
      const walk = new Walk(await launched(look), name.split(" ")[0] ?? name, look);
      try {
        await body(walk);
      } finally {
        walk.app.dispose();
      }
    },
    LONG,
  );
}

const ROUND = "/r/realistic/f/2026-10-21-leader-key/clarifications-01.md";

step("01-round from Home's needs you, a whole round by keys", async (walk) => {
  await walk.go("/r/realistic/");
  await walk.sees("Needs you");
  await walk.shot("home");
  await walk.keys("j");
  await walk.shot("home-first-card");
  await walk.keys("Enter");
  await walk.app.wait(2500);
  await walk.shot("opened");
  if (!walk.text().includes("Leader key")) await walk.go(ROUND);
  await walk.shot("opening");
  // A settled point to check: J to the first, J to the next, Enter comments on it.
  await walk.keys("J");
  await walk.shot("opening-point-1");
  await walk.keys("J");
  await walk.shot("opening-point-2");
  await walk.keys("Enter");
  await walk.shot("settled-comment-open");
  await walk.typed("Say what f does on a page with no find.");
  await walk.keys("ctrl+Enter");
  await walk.shot("settled-commented");
  await walk.keys("Escape", "n");
  await walk.shot("q1");
  await walk.keys("a");
  await walk.shot("q1-answered-q2");
  // Q2: a typed answer, no letter.
  await walk.keys("i");
  await walk.typed("Neither: hints come with the picker, in its own feature after this one.");
  await walk.keys("ctrl+Enter");
  await walk.shot("q2-typed");
  await walk.keys("Escape", "n");
  await walk.shot("q3");
  // Q3: several letters, Shift and each letter, then on.
  await walk.keys("A");
  await walk.shot("q3-first-letter");
  await walk.keys("B");
  await walk.shot("q3-two-letters");
  await walk.keys("n");
  await walk.shot("q4");
  // Q4: a letter, back to it, and a comment.
  await walk.keys("b", "p");
  await walk.shot("q4-back-after-pick");
  await walk.keys("i");
  await walk.typed("Settings first; the TOML can come later.");
  await walk.keys("ctrl+Enter", "Escape");
  await walk.shot("q4-commented");
  // Change an answer: back to Q1, another letter.
  await walk.keys("p", "p", "p");
  await walk.shot("back-at-q1");
  await walk.keys("c");
  await walk.shot("q1-changed");
  // Ask the agent about Q5: it opens beside, nothing sent.
  await walk.keys("n", "n", "n");
  await walk.shot("q5");
  await walk.keys("s");
  await walk.app.wait(2000);
  await walk.shot("q5-ask-beside");
  await walk.keys("Escape");
  await walk.shot("q5-after-ask");
});

step("02-round leave mid-round, come back, restart", async (walk) => {
  await walk.go(ROUND);
  await walk.app.wait(1500);
  await walk.shot("where-left");
  await walk.keys("n");
  await walk.keys("i");
  await walk.typed("Half a thought, never saved by hand");
  await walk.shot("typing");
  await walk.keys("Escape", "g", "d");
  await walk.app.wait(2000);
  await walk.shot("elsewhere");
  await walk.keys("b");
  await walk.app.wait(2000);
  await walk.shot("came-back");
  walk.log(`kept after back: ${walk.text().includes("Half a thought, never")}`);
  await walk.restart();
  await walk.go(ROUND);
  await walk.app.wait(2000);
  await walk.shot("after-restart");
  walk.log(`kept after restart: ${walk.text().includes("Half a thought, never")}`);
});

step("03-round the end: what is left, the notes, the commit", async (walk) => {
  await walk.go(ROUND);
  await walk.app.wait(1500);
  await walk.shot("where-left");
  await inTurn(Array.from({ length: 10 }), () => walk.keys("n"));
  await walk.shot("end");
  await walk.keys("c");
  await walk.shot("commit-with-questions-left");
  // Answer every question left with its recommendation, then the end.
  await inTurn(Array.from({ length: 6 }), () => walk.keys("a"));
  await walk.shot("all-answered");
  await walk.keys("J");
  await walk.shot("end-point");
  await walk.keys("s");
  await walk.app.wait(2000);
  await walk.shot("end-point-asked");
  await walk.keys("Escape", "h");
  await walk.keys("i");
  await walk.typed("Keep the menu's order stable between releases.");
  await walk.keys("Escape");
  await walk.shot("notes");
  await walk.keys("c");
  await walk.shot("commit-asked");
  await walk.keys("Enter");
  await walk.app.wait(3000);
  await walk.shot("committed");
});

const SPEC = "/r/realistic/f/2026-10-19-leader-key/spec.md";

step("04-spec read top to bottom, two comments, the outline", async (walk) => {
  await walk.go(SPEC);
  await walk.app.wait(2500);
  await walk.shot("spec");
  await walk.keys("ctrl+d");
  await walk.shot("half-down");
  await walk.keys("ctrl+d", "ctrl+d");
  await walk.shot("further-down");
  await walk.keys("g", "g");
  // A part, then its comment: J moves between parts, i writes.
  await walk.keys("J", "J", "J");
  await walk.shot("part");
  await walk.keys("i");
  await walk.shot("comment-open");
  await walk.typed("Name the leader's timeout, and say why 500 ms.");
  await walk.keys("ctrl+Enter", "Escape");
  await walk.shot("comment-saved");
  await walk.keys("J", "J", "J", "J", "i");
  await walk.typed("Keep the which-key order stable.");
  await walk.keys("ctrl+Enter", "Escape");
  await walk.shot("two-comments");
  // The outline, beside: a heading jumps the reader there.
  await walk.keys("l", "k", "l");
  await walk.shot("outline");
  await walk.keys("j", "j", "j", "j", "Enter");
  await walk.app.wait(1500);
  await walk.shot("outline-jump");
});

step("05-spec a decision on the branch, and back", async (walk) => {
  await walk.go(SPEC);
  await walk.app.wait(2500);
  await walk.keys("l", "k", "l");
  await walk.shot("tab");
  await walk.keys("l");
  await walk.shot("tab-next");
  await walk.keys("j");
  await walk.shot("tab-row");
  await walk.keys("Enter");
  await walk.app.wait(2000);
  await walk.shot("opened");
  await walk.keys("b");
  await walk.app.wait(2000);
  await walk.shot("back");
});

step("06-spec a mockup live, picked and commented", async (walk) => {
  await walk.go(SPEC);
  await walk.app.wait(2500);
  await walk.keys("G");
  await walk.shot("end");
  await walk.go("/r/realistic/f/2026-10-19-leader-key/mockups/picker.html");
  await walk.app.wait(4000);
  await walk.shot("mockup");
  await walk.keys("p");
  await walk.shot("pick-mode");
  await walk.keys("Escape", "i");
  await walk.app.wait(1500);
  await walk.shot("comment-on-mockup");
});

step("07-spec the verdict: request changes", async (walk) => {
  await walk.go(SPEC);
  await walk.app.wait(2500);
  await walk.keys("n");
  await walk.app.wait(1000);
  await walk.shot("verdict");
  await walk.keys("r");
  await walk.shot("request-asked");
  await walk.keys("Enter");
  await walk.app.wait(3000);
  await walk.shot("requested");
});

step("08-spec approve another spec", async (walk) => {
  await walk.go("/r/sample/f/2026-10-06-recurring-tasks/spec.md");
  await walk.app.wait(2500);
  await walk.shot("spec");
  await walk.keys("n");
  await walk.app.wait(1000);
  await walk.keys("a");
  await walk.shot("approve-asked");
  await walk.keys("Enter");
  await walk.app.wait(3000);
  await walk.shot("approved");
});

step("09-plan progress, a task, the run map", async (walk) => {
  await walk.go("/r/realistic/f/2026-10-18-due-reminders/plan.md");
  await walk.app.wait(2500);
  await walk.shot("plan");
  await walk.keys("j");
  await walk.shot("plan-cursor");
  await walk.keys("l");
  await walk.shot("side");
  await walk.keys("k", "l");
  await walk.shot("side-tab");
  await walk.keys("j", "j", "Enter");
  await walk.app.wait(1500);
  await walk.shot("task-jump");
  await walk.go("/r/realistic/f/2026-10-18-due-reminders");
  await walk.app.wait(2500);
  await walk.shot("feature");
  await walk.keys("k");
  await walk.shot("run-map");
});

step("10-decisions read, a link, the order, the constitution, the check", async (walk) => {
  await walk.go("/r/realistic/");
  await walk.keys("g", "d");
  await walk.app.wait(2500);
  await walk.shot("decisions");
  await walk.keys("l", "j", "j", "j", "Enter");
  await walk.app.wait(2000);
  await walk.shot("decision");
  await walk.keys("ctrl+d");
  await walk.shot("decision-down");
  await walk.keys("l", "o");
  await walk.shot("order-open");
  await walk.keys("j", "Enter");
  await walk.app.wait(1000);
  await walk.shot("order-changed");
  await walk.keys("g", "g", "Enter");
  await walk.app.wait(2000);
  await walk.shot("check");
  await walk.keys("n");
  await walk.shot("check-q1");
  await walk.keys("a");
  await walk.shot("check-answered");
});

step("11-triage three notes by one key each", async (walk) => {
  await walk.go("/r/realistic/");
  await walk.keys("g", "i");
  await walk.app.wait(2500);
  await walk.shot("inbox");
  await walk.keys("t");
  await walk.app.wait(2000);
  await walk.shot("triage");
  await walk.keys("n");
  await walk.shot("q1");
  await walk.keys("a");
  await walk.shot("q1-answered");
  await walk.keys("b");
  await walk.shot("q2-answered");
  await walk.keys("a");
  await walk.shot("q3-answered");
});

step(
  "12-light a question, the spec, and a decision in the light theme",
  async (walk) => {
    await walk.go(ROUND);
    await walk.app.wait(1500);
    await walk.keys("n", "n", "n", "n", "n");
    await walk.shot("question");
    await walk.go(SPEC);
    await walk.app.wait(2500);
    await walk.shot("spec");
    await walk.keys("ctrl+d", "ctrl+d");
    await walk.shot("spec-tables");
    await walk.go("/r/realistic/decisions/keyboard");
    await walk.app.wait(2000);
    await walk.shot("decision");
  },
  { theme: "light" },
);
