// @vitest-environment node
// The sidebar's entries and its search: a search lists the features whose session it found or
// whose title, slug, or name holds the text in any case, and every session it found, archived
// ones too; without one, an archived or finished session leaves the list, unless it is kept. A
// feature's card follows the session its status names; a running session of a feature no longer in
// flight is a card of its own (the feature state spec's SC-004).
import { expect, test } from "vite-plus/test";
import type { Feature, Row } from "../sidebar/cards.ts";
import { type Data, entriesOf } from "../sidebar/entries.ts";

const CLI = "2026-10-12-cli-tuis";
const WEB = "2026-10-11-web-ui";

/** A feature at its plan, or at `step`, needing the human, unless `status` says otherwise. */
const feature = (
  folder: string,
  title: string,
  { session = null, status = "needs-you", step = "plan" } = {} as {
    session?: string | null;
    status?: Feature["status"]["status"];
    step?: string;
  },
) =>
  ({
    folder,
    label: null,
    problems: [],
    slug: folder.slice(11),
    status: { label: status, reason: null, session, status, turn: null },
    step: { name: step, waitsOn: "human" },
    title,
  }) as unknown as Feature;

/** A session of `folder`, or of none, with its title. */
const session = (id: string, folder: string | null, extra: Partial<Row> = {}) =>
  ({
    archived: false,
    done: false,
    folder,
    id,
    startedAt: "2026-10-20",
    status: "idle",
    statusLabel: "Idle",
    title: id,
    ...extra,
  }) as Row;

const CLI_FEATURE = feature(CLI, "CLI TUIs");
const WEB_FEATURE = feature(WEB, "Web UI for the workflow files");
const CACHE_CHAT = session("cache-chat", null);
const CI_CHAT = session("ci-chat", null);

/** The navigation's data: the features, and the sessions' rows. */
const data = (rows: Array<Row>, features = [CLI_FEATURE, WEB_FEATURE]): Data =>
  ({
    sessionList: { rows },
    workspace: { features },
  }) as unknown as Data;

/** The ids of the entries a search shows, a feature by its folder. */
function shown(rows: Array<Row>, found: Array<Row> | undefined, query: string, kept?: string) {
  const entries = entriesOf(data(rows), {
    found: found && new Map(found.map((row) => [row.id, row])),
    kept,
    query,
  });
  return entries.map((entry) => (entry.kind === "feature" ? entry.feature.folder : entry.row.id));
}

test("without a search, every feature in flight and every open session is listed", () => {
  expect(shown([CACHE_CHAT, CI_CHAT], undefined, "")).toEqual([CLI, WEB, "cache-chat", "ci-chat"]);
});

test("a search by message text keeps the sessions it found, and hides the features without one", () => {
  expect(shown([CACHE_CHAT, CI_CHAT], [CACHE_CHAT], "wal")).toEqual(["cache-chat"]);
});

test("a search keeps the feature whose session it found", () => {
  const working = session("cli-session", CLI);

  expect(shown([working, CACHE_CHAT], [working], "wal")).toEqual([CLI]);
});

test("a search keeps the feature whose older session it found, not the one its status follows", () => {
  const older = session("cli-older", CLI, { startedAt: "2026-10-18" });
  const latest = session("cli-latest", CLI);

  expect(shown([latest, older], [older], "wal")).toEqual([CLI]);
});

test.each([
  ["a title, in any case", "CLI TUI", [CLI]],
  ["a slug", "cli-tui", [CLI]],
  ["a word of another feature's title", "workflow", [WEB]],
  ["nothing", "zzz", []],
])("a search finds a feature by %s", (_, query, folders) => {
  expect(shown([], [], query)).toEqual(folders);
});

test("a search lists an archived session, which the list leaves out", () => {
  const archived = session("archived-chat", null, { archived: true });

  expect(shown([archived], undefined, "")).toEqual([CLI, WEB]);
  expect(shown([archived], [archived], "open draft")).toEqual(["archived-chat"]);
});

test("a session read to its end is done, unless it is the one kept", () => {
  const done = session("done-chat", null, { done: true });

  expect(shown([done], undefined, "")).toEqual([CLI, WEB]);
  expect(shown([done], undefined, "", "done-chat")).toEqual([CLI, WEB, "done-chat"]);
});

test("a session found that the list leaves out shows as the search read it", () => {
  expect(shown([], [CACHE_CHAT], "wal")).toEqual(["cache-chat"]);
});

test("a feature's card has the row of the session its status follows, not its folder's first", () => {
  const latest = session("latest", CLI);
  const running = session("running", CLI, { status: "working", statusLabel: "Working" });
  const working = feature(CLI, "CLI TUIs", { session: "running", status: "working" });

  const [entry] = entriesOf(data([latest, running], [working]), { found: undefined, query: "" });

  expect(entry).toMatchObject({ kind: "feature", row: { id: "running" }, status: working.status });
});

test("a running session of a merged feature is a card of its own until its run ends", () => {
  const merged = feature(WEB, "Web UI for the workflow files", { status: "idle", step: "done" });
  const running = session("web-session", WEB, { status: "working", statusLabel: "Working" });
  const ended = session("web-session", WEB);

  expect(entriesOf(data([running], [merged]), { found: undefined, query: "" })).toMatchObject([
    { kind: "session", row: { id: "web-session" } },
  ]);
  expect(entriesOf(data([ended], [merged]), { found: undefined, query: "" })).toEqual([]);
});
