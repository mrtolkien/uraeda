// The extensions the settings stories list, as the server's `Extensions` record gives them: Uraeda's
// own, the inbox turned off, and three of yours, two from git and one linked; and the same with
// extensions that need you, as the spec's mockups draw them.
import type { ExtensionsValues } from "./ExtensionSettings.tsx";
import type { ExtensionRow } from "./extensions.ts";

/** An extension at rest: on everywhere, nothing wrong, no settings. */
const base: Omit<ExtensionRow, "description" | "icon" | "name" | "title"> = {
  api: 1,
  isBuiltIn: true,
  isLinked: false,
  keys: [],
  on: [],
  onAll: true,
  pageVersion: null,
  problems: [],
  settings: [],
  source: null,
  state: "on",
  values: "{}",
  valuesHere: "{}",
  version: "",
  waitingFor: null,
};

/** A built-in extension, as its manifest in `crates/core/extensions/` names it. */
const builtIn = (name: string, title: string, icon: string, description: string): ExtensionRow => ({
  ...base,
  description,
  icon,
  name,
  title,
});

const BUILT_IN: ReadonlyArray<ExtensionRow> = [
  {
    ...builtIn(
      "claude",
      "Claude Code",
      "uraeda:harness-claude",
      "Runs your installed claude command in sessions.",
    ),
    settings: [
      {
        defaultJson: '"claude"',
        help: "The command sessions run.",
        key: "command",
        kind: "string",
        label: "Command",
      },
    ],
  },
  {
    ...builtIn(
      "inbox",
      "Inbox",
      "uraeda:inbox",
      "The Inbox place, its keys, its home pane, and its New-page section.",
    ),
    onAll: false,
    state: "off",
  },
  builtIn(
    "priorities",
    "Priorities and proposals",
    "uraeda:list",
    "The Priorities place and starting a feature from a proposal.",
  ),
  builtIn("decisions", "Decisions", "uraeda:ruler", "The Decisions place and the decisions check."),
  builtIn("git", "Git", "uraeda:git-branch", "The Git place."),
  builtIn("previews", "Previews", "uraeda:eye", "Storybook previews in specs and sessions."),
  builtIn(
    "notifications",
    "Notifications",
    "uraeda:flag",
    "Browser notifications when work needs you.",
  ),
  // Off outside tests and the sandbox: the section leaves it out.
  {
    ...builtIn("fake", "Fake agent", "uraeda:bot", "A scripted agent for tests and the sandbox."),
    state: "off",
  },
];

/** Your extensions: one linked while you write it, two installed from git. */
const YOURS: ReadonlyArray<ExtensionRow> = [
  {
    ...base,
    description:
      "Your production and preview deployments, from the hosting API, cached for 5 minutes.",
    icon: "uraeda:globe",
    isBuiltIn: false,
    isLinked: true,
    name: "deploy",
    on: ["uraeda"],
    onAll: false,
    pageVersion: 3,
    title: "Deploy",
    version: "0.1.0",
  },
  {
    ...base,
    description: "Browse the repository's docs folder as a wiki.",
    icon: "uraeda:book-open",
    isBuiltIn: false,
    name: "wiki",
    pageVersion: 1,
    settings: [
      {
        defaultJson: '"docs"',
        help: "The folder the wiki reads, from the repository's top level.",
        key: "folder",
        kind: "string",
        label: "Folder",
      },
      {
        defaultJson: "true",
        help: "Lists the pages by their last edit, newest first.",
        key: "byDate",
        kind: "bool",
        label: "Newest first",
      },
    ],
    source: { commit: "3f9c2a1d0e7b", gitRef: "main", url: "github.com/gary/uraeda-wiki" },
    title: "Wiki",
    values: '{"folder":"wiki"}',
    valuesHere: '{"folder":"wiki"}',
    version: "1.2.0",
  },
  {
    ...base,
    description: "Runs pi-durable in sessions.",
    icon: "uraeda:harness-pi",
    isBuiltIn: false,
    name: "pi-durable",
    onAll: false,
    source: { commit: "b71e04d9a2c1", gitRef: "main", url: "github.com/gary/uraeda-pi" },
    state: "off",
    title: "pi-durable",
    version: "0.4.0",
  },
];

/** The section with everything well: the inbox off, your three, and two repositories. */
export const sampleExtensions: ExtensionsValues = {
  extensions: [...BUILT_IN, ...YOURS],
  folder: "~/.config/uraeda/extensions/",
  repositories: ["uraeda", "todo-app"],
};

/** What needs you: a compile error, an old API, a reload waiting for a turn, and a key taken. */
export const sampleExtensionsNeedingYou: ExtensionsValues = {
  ...sampleExtensions,
  extensions: sampleExtensions.extensions.map((row) => {
    switch (row.name) {
      case "deploy":
        return {
          ...row,
          problems: [{ file: "page.tsx", line: 12, message: "Expected '>' but found 'status'" }],
          state: "broken",
        };
      case "pi-durable":
        return {
          ...row,
          api: 1,
          problems: [
            {
              file: "extension.toml",
              line: null,
              message: "built for extension API 1, and Uraeda runs API 2",
            },
          ],
        };
      case "claude":
        return { ...row, state: "waiting", waitingFor: "Fix the login redirect" };
      default:
        return row;
    }
  }),
  keyClashes: (name) => (name === "wiki" ? [{ keys: "space y", takenBy: "Deploy" }] : []),
};
