// The navigation benchmark, `just bench-navigation`: the time from a key to the frame that draws
// its result with its records, for every page and action the performance decision names, over the
// sandbox's projects and its chat of 20,000 messages. The app times itself (`ui/timing.ts`, the
// development build's warning past 100 ms): this test presses the keys, as a person would, and
// prints what the app timed, as a table. It times nothing itself, and runs only on a display:
// `nsh test` alone, without one, skips it, so it is never part of a check.
import { type App, open, test } from "nsh/test";

type Timed = { at: number; what: string; ms: number; first: number; settled: number };

/** One thing timed: where it starts, what is done there, and what the app names it. */
type Step = {
  name: string;
  /** The address it starts from, opened first and left to settle; none to stay where it is. */
  from?: string;
  /** Keys pressed before the timed one, untimed: a pane focused, a menu opened. */
  before?: ReadonlyArray<string>;
  /** The timed key, as `keyboard.press` names it; or a view pressed; or an address opened. */
  key?: string;
  press?: string;
  go?: string;
  /** What the app names the interaction, when it is not the key: `open /r/…`, `typing in …`. */
  named?: string;
  /** Words the result draws, waited for once timed, to check the step did what it says. */
  words?: string;
  /** Keys pressed after, untimed, to leave the app as it was. */
  after?: ReadonlyArray<string>;
};

const SAMPLE = "/r/sample/";
const REALISTIC = "/r/realistic/";
const FEATURE = "/r/sample/f/2026-10-17-redesign-clarifications";

const STEPS: ReadonlyArray<Step> = [
  { before: ["g"], from: SAMPLE, key: "p", name: "g p: Priorities", words: "Git listener process" },
  { before: ["g"], from: SAMPLE, key: "i", name: "g i: Inbox", words: "We need a home icon" },
  { before: ["g"], from: SAMPLE, key: "s", name: "g s: Sessions", words: "Add a dark theme" },
  { before: ["g"], from: REALISTIC, key: "d", name: "g d: Decisions (realistic)" },
  { before: ["g"], from: SAMPLE, key: "c", name: "g c: Git", words: "README.md" },
  { before: ["g"], from: SAMPLE, key: "j", name: "g j: Jobs", words: "Weekly report" },
  { before: ["g"], from: SAMPLE, key: ",", name: "g ,: Settings" },
  { before: ["g"], from: `${SAMPLE}settings`, key: "h", name: "g h: Home", words: "Due dates" },
  { before: ["g"], from: REALISTIC, key: "h", name: "g h: Home (realistic)" },
  { from: SAMPLE, go: FEATURE, name: "open a feature", words: "Follow the session" },
  {
    from: REALISTIC,
    go: "/r/realistic/f/2026-10-18-due-reminders/plan.md",
    name: "open a long plan (realistic)",
  },
  {
    from: SAMPLE,
    go: "/r/sample/f/2026-10-19-dark-mode/session",
    name: "open a session",
    words: "Dark mode",
  },
  {
    from: `${SAMPLE}sessions`,
    name: "open the chat of 20,000 messages, at its end",
    press: "text:A very long chat",
  },
  {
    from: `${REALISTIC}decisions`,
    go: "/r/realistic/decisions/git",
    name: "open a decision",
    words: "Rust tools read git with the gix library",
  },
  { from: `${SAMPLE}git`, key: "Enter", name: "open a diff (Enter on Git's changes)" },
  { from: FEATURE, key: "l", name: "cross to the side stack (l)" },
  { after: ["Escape"], before: ["k"], from: FEATURE, key: "l", name: "switch a tab (k, then l)" },
  { after: ["Escape"], from: SAMPLE, key: "space", name: "open the leader menu (Space)" },
  { before: ["space"], from: SAMPLE, key: "Escape", name: "close the leader menu (Escape)" },
  {
    after: ["Escape"],
    before: ["space", "u"],
    from: SAMPLE,
    key: "t",
    name: "open a dialog (Space u t, the themes)",
  },
  { before: ["space", "u", "t"], from: SAMPLE, key: "Escape", name: "close a dialog (Escape)" },
  {
    after: ["Escape"],
    before: ["space", "u", "t"],
    from: SAMPLE,
    key: "c",
    name: "type in a field (a key in the themes' search)",
    named: "typing in",
  },
  {
    // The categories, in the side stack, have the focus: `h` reaches the keyboard's rows.
    after: ["enter"],
    before: ["h", "j", "j"],
    from: `${SAMPLE}settings/keyboard`,
    key: "enter",
    name: "flip a setting (Vim mode, Enter): the switch moves",
  },
  {
    // The inbox opens with its note's field focused: a key types there.
    after: ["Escape"],
    from: `${SAMPLE}inbox`,
    key: "a",
    name: "type a note in the inbox (a key to its glyph)",
    named: "typing in",
  },
];

/** How many times each step runs: the first is cold, the others find the pages kept. */
const RUNS = 3;

/** What the app timed so far, from the lines its check page shows. */
const timings = (app: App): ReadonlyArray<Timed> =>
  app.texts().flatMap((text) => {
    const found = /^timed ([0-9]+) ([0-9.]+) ([0-9.]+) ([0-9.]+) (.*)$/.exec(text.trim());
    if (found === null) return [];
    const [, at, ms, first, settled, what] = found;
    return [
      {
        at: Number(at),
        first: Number(first),
        ms: Number(ms),
        settled: Number(settled),
        what: what!,
      },
    ];
  });

/** Whether the run draws: `nsh test` alone has no display, and times nothing. */
async function draws(app: App): Promise<boolean> {
  try {
    await app.screenshot();
    return true;
  } catch (error) {
    if (!String(error).includes("real platform")) throw error;
    return false;
  }
}

const says = (app: App, words: string) =>
  app.waitUntil(() => app.texts().join(" ").includes(words), { timeout: 20_000 });

/** Presses keys one after the other, as a person does. */
const pressAll = (app: App, keys: ReadonlyArray<string>) =>
  keys.reduce<Promise<void>>(
    (done, key) => done.then(() => app.keyboard.press(key)),
    Promise.resolve(),
  );

/** What the app timed for `step`, run once, or why there is none. */
async function once(app: App, step: Step): Promise<Timed | string> {
  if (step.from !== undefined) {
    await app.host.send("go", step.from);
    await app.wait(600);
  }
  await pressAll(app, step.before ?? []);
  const before = Math.max(0, ...timings(app).map((timed) => timed.at));
  if (step.key !== undefined) await app.keyboard.press(step.key);
  else if (step.press !== undefined) await app.press(step.press);
  else if (step.go !== undefined) await app.host.send("go", step.go);
  const named = step.named ?? step.key ?? "open ";
  const matches = (timed: Timed) =>
    step.key === undefined && step.named === undefined
      ? timed.what.startsWith("open ")
      : timed.what.toLowerCase().startsWith(named.toLowerCase());
  const since = () => timings(app).filter((timed) => timed.at > before);
  const found = () => since().findLast(matches);
  try {
    await app.waitUntil(() => found() !== undefined, { timeout: 15_000 });
  } catch {
    return `nothing timed (${
      since()
        .map((t) => t.what)
        .join(", ") || "none"
    })`;
  }
  if (step.words !== undefined) await says(app, step.words);
  await pressAll(app, step.after ?? []);
  return found()!;
}

const median = (values: ReadonlyArray<number>) => {
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
};
const ms = (value: number) => `${value.toFixed(0)} ms`;

test("navigation, timed", async () => {
  const opened = Date.now();
  const app = await open("./__checks__/Navigation.tsx", {
    colorScheme: "dark",
    height: 800,
    network: "live",
    width: 1400,
  });
  if (!(await draws(app))) return;
  await says(app, "Due dates");
  const reload = timings(app).find((timed) => timed.what === "reload");
  const rows: Array<string> = [
    "| What | First | Median | Worst | Within 100 ms | Its first frame, median | Its records come, median |",
    "| ---- | ----- | ------ | ----- | ------------- | ----------------------- | ------------------------ |",
  ];
  rows.push(
    `| reload: the app's first line to its first page drawn with its records (target 1 s) | ${
      reload === undefined ? "untimed" : ms(reload.ms)
    } | | | ${reload !== undefined && reload.ms <= 1000 ? "yes" : "no"} | the test's open to the words: ${ms(Date.now() - opened)} | ${reload === undefined ? "" : ms(reload.settled)} |`,
  );
  await app.wait(2000);
  await STEPS.reduce<Promise<void>>(
    (done, step) =>
      done.then(async () => {
        // One run after the other: two at once would time each other.
        const runs = await Array.from({ length: RUNS }).reduce<Promise<Array<Timed | string>>>(
          (earlier) => earlier.then(async (all) => [...all, await once(app, step)]),
          Promise.resolve([]),
        );
        const timed = runs.filter((run): run is Timed => typeof run !== "string");
        const failed = runs.find((run) => typeof run === "string");
        const all = timed.map((one) => one.ms);
        rows.push(
          timed.length === 0
            ? `| ${step.name} | ${String(failed)} | | | | | |`
            : `| ${step.name} | ${typeof runs[0] === "string" ? "-" : ms(runs[0]!.ms)} | ${ms(median(all))} | ${ms(Math.max(...all))} | ${Math.max(...all) <= 100 ? "yes" : "no"} | ${ms(median(timed.map((one) => one.first)))} | ${ms(median(timed.map((one) => one.settled)))} |`,
        );
      }),
    Promise.resolve(),
  );
  console.log(`navigation:\n${rows.join("\n")}`);
  const problem = app.texts().find((text) => text.startsWith("problem: "));
  if (problem !== undefined) throw new Error(`the app stopped: ${problem}`);
}, 600_000);
