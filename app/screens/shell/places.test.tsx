// Every place of the app, opened in turn on the sandbox `just app-test` starts: the frame draws
// each, and no key of the shell, a pane, or a list means two things there. The key registry throws
// as a pane that declares such a key is drawn, and the page stops: screens built at the same time
// each saw their own pages work, and only their join showed that Git's `g g` broke every list.
// A screen that declares a place adds its address below, or this test fails. And once every place
// was opened and closed, no record is still subscribed that was not before: a `record` called
// where nothing lets it go, a key's `when`, a listener, stays subscribed for the life of the app.
import { type App, expect, open, test } from "nsh/test";

/** One address for each page a screen places, and words its records show once drawn. */
const PAGES: Record<string, { address: string; words: string }> = {
  home: { address: "/r/sample/", words: "Due dates" },
  priorities: { address: "/r/sample/priorities", words: "Git listener process" },
  proposal: { address: "/r/sample/priorities/gone", words: "That proposal is gone" },
  inbox: { address: "/r/sample/inbox", words: "We need a home icon" },
  note: { address: "/r/sample/inbox/gone", words: "We need a home icon" },
  triage: { address: "/r/realistic/inbox/triage", words: "Triage" },
  feature: {
    address: "/r/sample/f/2026-10-17-redesign-clarifications",
    words: "Follow the session",
  },
  decisions: { address: "/r/realistic/decisions", words: "Above every decision" },
  // A decision's list opens on its own card: its words, as its reader has them.
  decision: {
    address: "/r/realistic/decisions/git",
    words: "Rust tools MUST read git with the gix library",
  },
  file: {
    address: "/r/realistic/f/2026-10-19-leader-key/spec.md",
    words: "Leader key/shortcut map",
  },
  "branch-decision": {
    address: "/r/realistic/f/2026-10-18-due-reminders/decisions/notifications",
    words: "As the branch of Due date reminders has it",
  },
  constitution: { address: "/r/realistic/decisions/constitution", words: "Core Principles" },
  git: { address: "/r/sample/git", words: "README.md" },
  buffer: { address: "/r/realistic/buffer/specs/CONSTITUTION.md", words: "Core Principles" },
  edit: { address: "/r/realistic/edit/specs/CONSTITUTION.md", words: "Core Principles" },
  settings: { address: "/r/sample/settings/appearance", words: "Catppuccin Mocha" },
  new: { address: "/r/sample/new?kind=feature", words: "Git listener process" },
  sessions: { address: "/r/sample/sessions", words: "Add a dark theme" },
  "session-id": { address: "/r/sample/sessions/gone", words: "No such session" },
  session: { address: "/r/sample/f/2026-10-19-dark-mode/session", words: "Dark mode" },
  jobs: { address: "/r/sample/jobs", words: "Weekly report" },
  job: { address: "/r/sample/jobs/Dependencies", words: "Upgrade the dependencies" },
  "job-new": { address: "/r/sample/jobs/new", words: "Add the job" },
  missing: { address: "/r/sample/nowhere", words: "nowhere" },
  // An extension's place: its tab is the page's title, which the page draws in its own view.
  extension: { address: "/r/sample/e/hello/hello", words: "Hello" },
  storybook: {
    address:
      "/r/sample/f/2026-10-20-sidebar-resize/storybook?story=packages%2Fweb%2Fsrc%2FSidebarHandle.stories.tsx%23Dragging",
    words: "The stories its files link",
  },
  mockup: {
    address: "/r/sample/f/2026-10-20-sidebar-resize/mockups/handle.html",
    words: "specs/2026-10-20-sidebar-resize/mockups/handle.html",
  },
};

/**
 * More addresses of a place whose pages differ by what they open: a feature's round of questions
 * is the file place, with the round's panes in place of the reader's. The change Date format's
 * round waits in the sample, and no test answers it.
 */
const MORE: ReadonlyArray<{ page: string; address: string; words: string }> = [
  {
    address: "/r/sample/f/2026-10-19-date-format/clarifications-01.md",
    page: "file",
    words: "Context and points to check",
  },
];

const posted = (app: App, name: string) =>
  app.host
    .posts()
    .filter((post) => post.name === name)
    .map((post) => post.data);

const problems = (app: App) => posted(app, "problem").map(String);

/** Opens `page`'s address, and waits for its focused pane's tab and its words, or a problem. */
async function visit(app: App, page: string, at = PAGES[page]) {
  const { address, words } = at;
  const before = posted(app, "shown").length;
  await app.host.send("go", address);
  await app.waitUntil(() => posted(app, "shown").length > before, { timeout: 10_000 });
  const shown = posted(app, "shown")[before] as { page: string; pane: string | null };
  // The address opens the page it is listed for, which places a pane.
  expect([address, shown.page, shown.pane !== null]).toEqual([address, page, true]);
  const drawn = () =>
    problems(app).length > 0 ||
    (app.shows(`id:tab-${shown.pane}`) && app.texts().join(" ").includes(words));
  await app.waitUntil(drawn, { timeout: 20_000 });
  expect([address, problems(app)]).toEqual([address, []]);
}

test("every place of the app mounts with its keys", async () => {
  const app = await open("./__checks__/Places.tsx", {
    height: 800,
    host: { handlers: { guarded: null, held: null, places: null, problem: null, shown: null } },
    network: "live",
    width: 1400,
  });
  await app.waitUntil(() => app.shows("id:frame") || problems(app).length > 0, { timeout: 30_000 });
  expect(problems(app)).toEqual([]);
  const places = posted(app, "places")[0] as ReadonlyArray<string>;
  // Every place a screen declared has its address here.
  expect(places.filter((page) => PAGES[page] === undefined)).toEqual([]);
  // One page after the other, as a person goes.
  await places.reduce<Promise<void>>(
    (done, page) => done.then(() => visit(app, page)),
    Promise.resolve(),
  );
  await MORE.reduce<Promise<void>>(
    (done, more) => done.then(() => visit(app, more.page, more)),
    Promise.resolve(),
  );
}, 120_000);

/** The records subscribed now, once those nobody reads were let go: the check's grace is 100 ms. */
async function held(app: App): Promise<ReadonlyArray<string>> {
  await app.wait(400);
  const before = posted(app, "held").length;
  await app.host.send("held", null);
  await app.waitUntil(() => posted(app, "held").length > before);
  return posted(app, "held")[before] as ReadonlyArray<string>;
}

test("no record stays subscribed once its place is closed", async () => {
  const app = await open("./__checks__/Places.tsx", {
    height: 800,
    host: { handlers: { guarded: null, held: null, places: null, problem: null, shown: null } },
    network: "live",
    width: 1400,
  });
  await app.waitUntil(() => app.shows("id:frame") || problems(app).length > 0, { timeout: 30_000 });
  // A page that reads nothing of its own: what is subscribed there is the shell's.
  await visit(app, "missing");
  const shell = await held(app);
  const places = (posted(app, "places")[0] as ReadonlyArray<string>).filter(
    (page) => page !== "missing",
  );
  // Each place opened, and every key's guard read as a key pressed there reads it.
  await places.reduce<Promise<void>>(
    (done, page) =>
      done.then(async () => {
        await visit(app, page);
        const before = posted(app, "guarded").length;
        await app.host.send("guards", null);
        await app.waitUntil(() => posted(app, "guarded").length > before);
      }),
    Promise.resolve(),
  );
  await visit(app, "missing");
  const after = await held(app);
  expect(after.filter((record) => !shell.includes(record))).toEqual([]);
}, 180_000);
