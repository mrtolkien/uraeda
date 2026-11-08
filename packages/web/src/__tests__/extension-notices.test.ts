// @vitest-environment node
// The settings' Extensions section's words: the spec's exact texts for an extension that needs the
// human, where one is on, and the fake agent left out where it does not run.
import { expect, test } from "vite-plus/test";
import {
  aboutLine,
  type ExtensionRow,
  listed,
  type Notice,
  noticesOf,
  withOn,
} from "../settings/extensions.ts";

/** An extension of yours, on everywhere, with nothing wrong. */
const deploy: ExtensionRow = {
  api: 1,
  description: "Your deployments.",
  icon: "uraeda:globe",
  isBuiltIn: false,
  isLinked: true,
  keys: [],
  name: "deploy",
  on: [],
  onAll: true,
  pageVersion: 1,
  problems: [],
  settings: [],
  source: null,
  state: "on",
  title: "Deploy",
  values: "{}",
  valuesHere: "{}",
  version: "0.1.0",
  waitingFor: null,
};

/** A notice as one line, its keys between backticks. */
const text = (notice: Notice) =>
  notice.parts.map((part) => (typeof part === "string" ? part : `\`${part.keys}\``)).join("");

test.each<[string, Partial<ExtensionRow>, string, Notice["status"]]>([
  [
    "a compile error, with its file and line",
    {
      problems: [{ file: "page.tsx", line: 12, message: "Expected '>' but found 'status'" }],
      state: "broken",
    },
    "Deploy is off: page.tsx, line 12: Expected '>' but found 'status'",
    "error",
  ],
  [
    "another API, without its file",
    {
      problems: [
        {
          file: "extension.toml",
          line: null,
          message: "built for extension API 1, and Uraeda runs API 2",
        },
      ],
      state: "off",
    },
    "Deploy is off: built for extension API 1, and Uraeda runs API 2",
    "warning",
  ],
  [
    "a linked folder gone",
    { problems: [{ file: "", line: null, message: "folder not found" }], state: "broken" },
    "Deploy is off: folder not found",
    "error",
  ],
  [
    "a reload waiting for a turn",
    { state: "waiting", waitingFor: "Fix the login redirect" },
    "Deploy reloads when the turn of “Fix the login redirect” ends",
    "info",
  ],
  [
    "a key taken first",
    { keys: [{ keys: "space y", takenBy: "Wiki" }] },
    "Deploy: `y` is taken by Wiki",
    "warning",
  ],
])("%s", (_, change, line, status) => {
  const notices = noticesOf({ ...deploy, ...change });
  expect(notices.map((notice) => [text(notice), notice.status])).toEqual([[line, status]]);
});

test("a key clash the page's registry reports joins the record's", () => {
  const notices = noticesOf(deploy, [{ keys: "space y", takenBy: "Wiki" }]);
  expect(notices.map(text)).toEqual(["Deploy: `y` is taken by Wiki"]);
});

test.each<[string, Partial<ExtensionRow>, string]>([
  ["linked, everywhere", {}, "0.1.0 · reloads on save · on in every repository"],
  [
    "from git, in one repository",
    {
      isLinked: false,
      on: ["uraeda"],
      onAll: false,
      source: { commit: "3f9c2a1d0e", gitRef: "main", url: "github.com/gary/uraeda-wiki" },
    },
    "0.1.0 · github.com/gary/uraeda-wiki at 3f9c2a1 · on in uraeda only",
  ],
  ["built in, off", { isBuiltIn: true, onAll: false, version: "" }, "On in no repository"],
])("where it comes from and is on: %s", (_, change, line) => {
  expect(aboutLine({ ...deploy, ...change })).toBe(line);
});

test("the fake agent is listed only while it runs", () => {
  const fake = { ...deploy, isBuiltIn: true, name: "fake", title: "Fake agent" };
  expect(listed([deploy, { ...fake, state: "off" }]).map((row) => row.name)).toEqual(["deploy"]);
  expect(listed([deploy, fake]).map((row) => row.name)).toEqual(["deploy", "fake"]);
});

test("turning one on in some repositories leaves the others as they are", () => {
  const rows = withOn([deploy, { ...deploy, name: "wiki" }], "deploy", ["uraeda"]);
  expect(rows.map(({ name, on, onAll }) => ({ name, on, onAll }))).toEqual([
    { name: "deploy", on: ["uraeda"], onAll: false },
    { name: "wiki", on: [], onAll: true },
  ]);
});
