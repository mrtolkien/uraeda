// The hands of a walk through the app: a person's keys, typing, and pictures, over the whole app on
// a sandbox, as `session.test.tsx` walks it (`just walk-session`). Each step of a walk is a test of
// its own that opens the app at a desktop's width, presses keys as that person would, and takes a
// numbered picture after each thing done, in `<shots>/<step>-<n>-<what>.png`. `nsh test` alone,
// without a display, skips every step at once.
import { type App, open, test } from "nsh/test";

const LONG = 600_000;

/** The pause after a key, as a person's: a key's result has drawn before the next. */
const BEAT = 150;

/** Whether the run draws, asked once per run. */
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

/** Does `each` for every item, one after the other, as a person's hands do. */
const inTurn = <T>(items: ReadonlyArray<T>, each: (item: T) => Promise<void>) =>
  items.reduce<Promise<void>>((done, item) => done.then(() => each(item)), Promise.resolve());

/** One step of a walk, on the app it opened: its keys, its pictures, its words. */
export class Walk {
  private shots = 0;
  constructor(
    readonly app: App,
    private readonly folder: string,
    private readonly named: string,
  ) {}

  /** A picture of what is shown now, numbered in the step, after the shaders' late frames. */
  async shot(what: string, settle = 700) {
    this.shots += 1;
    await this.app.wait(settle);
    const n = String(this.shots).padStart(2, "0");
    await this.app.screenshot(`${this.folder}/${this.named}-${n}-${what}.png`);
  }

  /** Two or three pictures a few frames apart, at once after the keys: a move's motion. */
  async motion(what: string, ...keys: ReadonlyArray<string>) {
    await this.keys(...keys.slice(0, -1));
    await this.app.keyboard.press(keyOf1(keys.at(-1) ?? ""));
    await this.shot(`${what}-a`, 30);
    await this.shot(`${what}-b`, 60);
    await this.shot(`${what}-c`, 600);
  }

  /** Keys pressed one after the other, as a person types them: `"g"`, `"i"`, `"ctrl+Enter"`. */
  async keys(...keys: ReadonlyArray<string>) {
    await inTurn(keys, async (key) => {
      await this.app.keyboard.press(keyOf1(key));
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
      this.log(`never saw “${words}”`);
      await this.shot(`never-${words.slice(0, 24).replace(/[^A-Za-z0-9]+/g, "-")}`);
      return false;
    }
  }

  /** How long, in milliseconds, until `words` are drawn, or `null` past `timeout`. */
  async timed(words: string, timeout = 30_000): Promise<number | null> {
    const start = Date.now();
    try {
      await this.app.waitUntil(() => this.text().includes(words), { timeout });
      return Date.now() - start;
    } catch {
      return null;
    }
  }

  /** Opens an address, as a link would: the start of a step, never its keys. */
  async go(address: string) {
    await this.app.host.send("go", address);
    await this.app.wait(1200);
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

  /** A line in the run's log, named by the step. */
  log(words: string) {
    console.log(`[walk] ${this.named}: ${words}`);
  }

  text() {
    return this.app.texts().join(" ");
  }
}

/** A key named in a walk: one character is typed as a person types it, a name is pressed. */
const keyOf1 = (key: string) => (key.length === 1 ? keyOf(key) : key);

export type Look = { theme?: "dark" | "light"; width?: number; height?: number };

/** The whole app over the walk's sandbox, at a desktop's width unless `look` says otherwise. */
export async function opened(folder: string, named: string, look: Look = {}): Promise<Walk | null> {
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
  return new Walk(app, folder, named);
}

/** The steps of a walk whose pictures go in `folder`: each a test, one failing leaves the rest. */
export function walkIn(folder: string) {
  return (name: string, body: (walk: Walk) => Promise<void>, look: Look = {}) =>
    test(
      name,
      async () => {
        const walk = await opened(folder, name.split(" ")[0] ?? name, look);
        if (walk === null) return;
        try {
          await body(walk);
        } finally {
          walk.app.dispose();
        }
      },
      LONG,
    );
}
