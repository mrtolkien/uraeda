---
status: awaiting-human
---

# Clarifications, round 01: Settings page

> [!IMPORTANT]
>
> 8 questions on the settings file, the data folder, and the page, about 30 minutes.
>
> - Two choices last beyond this feature: the settings file's format and folder, which every later
>   setting will use, and how Uraeda's data folder is organized. Both change the distribution
>   decision, which says today that the server's settings come only from its flags and environment.
> - The proposal's "they change config on boot" reads two ways: flags overriding the file for one
>   run, or flags writing into it.
> - Three questions shape the page: where it lives, how the future settings show as placeholders,
>   and whether signing out moves there from the repository menu.
> - Renaming a repository is listed among the placeholders, but "at least in the UI" can also mean a
>   display name.
> - This feature builds on basic security, which is not merged yet: the spec waits for it.
> - Nine points are settled without you, at the end, including what happens when you remove the
>   host name you are using.

## Context

The [proposal](proposal.md) asks for a settings page with categories, made to grow. Its first real
settings are the values that only flags and environment variables set today, allowed host names
first. Flags still work at start. Placeholders show the settings to come: a model per step, run
options, review settings, renaming a repository, and signing out. The settings live in a file fit
for dotfiles, and all of Uraeda's data gets a coherent organization.

Today the server reads `URAEDA_ALLOWED_HOSTS`, `URAEDA_PORT`, `URAEDA_REPO`, and `URAEDA_DATA_DIR`
from its environment, or from a checkout's `.env`, and `--port`, `--repo`, `--allowed-hosts`, and
`--no-open`, once at start ([`env.ts`](/packages/server/src/env.ts),
[`options.ts`](/packages/server/src/options.ts)). There is no settings file. The data folder,
`~/.local/share/uraeda/` on Linux, holds `repositories.json`, `runner.sqlite`, chat images, and
process files, and basic security adds `sign-in.json` to it. Every page of the web UI lives under a
repository's `/r/<name>/`, and the only setting-like control is the theme switch in the sidebar's
footer ([`Shell.tsx`](/packages/web/src/Shell.tsx)).

The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Q1: What format is the settings file, and where does it live?

Codex uses TOML in `~/.codex/config.toml`; Claude Code and VS Code use strict JSON; opencode uses
JSONC in `~/.config/opencode/`. `gh` keeps its config in `~/.config/gh` on macOS too, as most
command-line tools do. Uraeda's data folder sits in `~/Library/Application Support/uraeda/` on macOS.
TOML takes comments, and the `toml_edit` crate writes the file while keeping them; JSON has no
comments. Whatever the answer, the [distribution](../decisions/distribution.md) decision's rule, "its
settings come from its flags and its environment", becomes "from its flags, its environment, and the
user's settings file, never a file in a project", and the [stack](../decisions/stack.md) decision's
host names come from that file too. Where the other data goes is Q2. More in
[discovery](discovery-01.md#the-files-format-and-place).

Why it matters: every later setting, from models to review options, goes in this file, and it is
the file you put in your dotfiles.

- **A (recommended). TOML, in `~/.config/uraeda/config.toml` on Linux and macOS
  (`$XDG_CONFIG_HOME/uraeda/` when set), written by the core with `toml_edit`, which keeps your
  comments and order.**
  - [pro] the folder dotfiles already manage; comments survive the web UI's writes; the format of
    Codex and Rust tools.
  - [con] a new Rust dependency in the core, which `ura` links: the spec measures its size, as the
    CLI decision asks.
  - Why recommended: it is the only option that is both in the dotfiles folder and safe to annotate
    by hand.
- **B. JSON, `settings.json`, in the data folder next to `repositories.json`, written whole with
  `serde_json`.**
  - [pro] no new dependency, one folder, the same code as the list of repositories.
  - [con] no comments; backing it up means picking one file out of a folder of caches and secrets.
- **C. JSON, in `~/.config/uraeda/settings.json`, written whole.**
  - [pro] the dotfiles folder, no new dependency, like Claude Code.
  - [con] no comments, and a hand edit with a trailing comma breaks the file.

**Answer:**

## Q2: How is Uraeda's data organized?

The data folder mixes four kinds of files: data you would miss (`repositories.json`, `sign-in.json`,
chat images), a cache of transcripts (`runner.sqlite`), and files that only live while a server runs
(`storybooks/<pid>.json`, basic security's `server-<port>.token`). The XDG specification gives each
kind its folder: config, data, state, and runtime. With A or C in Q1, settings already go to the
config folder. More in [discovery](discovery-01.md#organizing-the-data) and
[the data folder today](discovery-01.md#the-data-folder-today).

Why it matters: you asked for coherent data, open to change; moving a file later means migrating
every user's folder again.

- **A (recommended). Settings in the config folder, as Q1 says; the data folder keeps
  `repositories.json`, `sign-in.json`, `runner.sqlite`, and `images/`; the files of a running server
  move into its `run/` subfolder. Existing process files are not migrated: they are rewritten at the
  next start.**
  - [pro] one file to back up, the settings; data stays where the decisions put it; nothing to
    migrate.
  - [con] the cache still sits beside data you would miss, so backing up the data folder takes the
    cache too.
  - Why recommended: it separates what you edit from what the program keeps, at almost no cost.
- **B. Everything in the data folder, settings included, as today.**
  - [pro] one folder to know, nothing moves.
  - [con] settings mixed with caches and secrets, against the dotfiles goal.
- **C. The full XDG split: config, data (`repositories.json`, `sign-in.json`, `images/`), state
  (`runner.sqlite`), and runtime (process files), each moved at the first start.**
  - [pro] each kind of file where Linux tools expect it; backing up data skips the cache.
  - [con] a migration, a fourth folder, and a change to the agents decision, which names
    `runner.sqlite`'s folder; on macOS several folders collapse into one anyway.

**Answer:**

## Q3: What does a flag given at start do to the settings?

Codex, Claude Code, and the Command Line Interface Guidelines put flags above the file, then
environment variables, for one run, without writing them. The proposal says "they change config on
boot", which can also mean that a flag writes its value into the file. More in
[discovery](discovery-01.md#sources-and-their-order).

Why it matters: it decides whether a headless start with `--allowed-hosts` lasts beyond that run.

- **A (recommended). A flag wins over its environment variable, which wins over the file, for that
  run only: nothing is written. The page shows the file's value, and when a flag or a variable
  overrides it, says so next to it: "Set by --allowed-hosts for this run".**
  - [pro] a one-off start never changes your file; every product and guideline checked works this
    way.
  - [con] a value edited on the page while a flag overrides it only takes effect at a start without
    the flag.
  - Why recommended: it keeps the file the one lasting source, as the proposal's dotfiles goal needs.
- **B. A flag or variable given at start is written into the file, then the server reads the file.**
  - [pro] one value at a time, nothing to explain on the page.
  - [con] a start for a test changes your settings for good, and a variable in a shell profile
    rewrites the file at every start.

**Answer:**

## Q4: Which of today's values become settings?

The four variables and the flags are not one kind of value. Allowed host names and the port last;
the repository to open and `--no-open` describe one start; the data folder says where the files
are, so it cannot be read from one of them. More in
[discovery](discovery-01.md#which-values-become-settings).

Why it matters: it is the content of the first real category.

- **A (recommended). Allowed host names, the port, and whether the server opens a browser when it
  starts. The repository to open and the data folder stay a flag and a variable only.**
  - [pro] every lasting value in the file; nothing circular.
  - [con] one more setting than today's variables, for `--no-open`.
  - Why recommended: a headless machine sets "do not open a browser" once instead of at every start.
- **B. Allowed host names and the port only.**
  - [pro] exactly the lasting variables of today.
  - [con] a headless start still needs `--no-open` every time.
- **C. All four variables, the repository to open and the data folder included.**
  - [pro] the file holds everything `.env` held.
  - [con] the data folder cannot come from a file inside the folders it moves, and the repository
    to open is better chosen in the UI.

**Answer:**

## Q5: Where does the settings page live?

Every page today is under a repository, `/r/<name>/`, while the server's settings are the machine's,
and the settings to come mix both: models and run options for every repository, renaming for one.
VS Code and Zed open settings from a gear or a shortcut, Vibe Kanban from its sidebar. On a phone,
the page shows its list of categories, then a category as its own page, as the
[UI layout](../decisions/ui-layout.md) decision asks; on a desktop, the categories on the left and
the open category on the right. More in [discovery](discovery-01.md#where-the-page-lives).

Why it matters: the address and the entry are what every later setting is reached through, and the
interface redesign in Now will build on them.

- **A (recommended). One page at `/r/<name>/settings/<category>`, opened from a Settings entry in
  the sidebar's footer, beside the theme switch. Machine-wide categories show the same values from
  every repository; a "This repository" category holds that repository's settings.**
  - [pro] reached from where you are, with the sidebar kept; one page for both kinds of settings.
  - [con] the same machine-wide values appear under every repository's address.
  - Why recommended: settings for one repository are coming (renaming, run options), and one page
    for both avoids a second one later.
- **B. A page outside repositories, at `/settings/<category>`, opened from the repository menu, and
  a second page for a repository's settings when one is needed.**
  - [pro] the address says the settings are the machine's.
  - [con] a page without the sidebar's context, a second settings page later, and the shared text
    field hook needs a key outside repositories.

**Answer:**

## Q6: How do the settings to come show now?

You asked for placeholders that show the page's structure. Their future features change the agents
decision, which today forbids changing the agent's model and allows one session per feature; a
placeholder that only names them changes nothing. More in
[discovery](discovery-01.md#placeholder-categories).

Why it matters: placeholders stay on the page until each future feature replaces them, and anything
drawn now is designed before its feature's own questions.

- **A (recommended). Each future category is listed, Agents, Runs, Reviews, and This repository, and
  shows its planned settings as plain lines with the feature that will bring them: "Model for each
  step, with the Codex runtime".**
  - [pro] the full structure shows; nothing to test or remove but text.
  - [con] less concrete than real controls.
  - Why recommended: it shows the shape without deciding how each future setting works.
- **B. Each planned setting as a disabled control: a model picker per step, a session mode switch,
  review fields.**
  - [pro] the page looks as it will.
  - [con] each control decides a design its feature has not asked about yet, and is code to remove.
- **C. No placeholders: only the categories with real settings.**
  - [pro] nothing that does not work.
  - [con] the structure you asked to see does not show.

**Answer:**

## Q7: Do Sign out and Sign out everywhere move to the settings page?

Basic security puts both in the repository menu, and its spec review said "this feature will be
part of the settings page". GitHub keeps Sign out in its account menu, and lists signed-in sessions,
each with a way to revoke it, in its settings. Basic security already stores each device's session
with its creation and last use. More in [discovery](discovery-01.md#signing-out).

Why it matters: it decides where a signed-in phone signs out, and whether you can see which devices
are signed in.

- **A (recommended). Both move to a Sign-in category of the settings page, and leave the repository
  menu.**
  - [pro] what your spec review asked; the repository menu stays about repositories.
  - [con] signing out takes one more step.
  - Why recommended: it follows your review note, with no new scope.
- **B. Both move to a Sign-in category, which also lists the signed-in devices, with when each was
  signed in and last used, each with its own Sign out.**
  - [pro] you see a lost phone and sign it out alone, without signing out everywhere.
  - [con] a new list and route, and devices only known by their dates, since basic security stores
    no device name.
- **C. Both stay in the repository menu; the Sign-in category only points to it.**
  - [pro] no change to basic security's work.
  - [con] account actions in a menu of repositories.

**Answer:**

## Q8: Does renaming a repository stay a placeholder?

The proposal lists it among the placeholders, but says "at least in the UI". A repository's name is
its address, `/r/<name>/`, and the [repositories](../decisions/repositories.md) decision promises
that names never change, "so links keep working". A rename breaks old links and preview addresses;
sessions survive, keyed by the folder's path. More in
[discovery](discovery-01.md#renaming-a-repository).

Why it matters: a real rename changes a decision and breaks links; a display name adds a second name
to keep apart.

- **A (recommended). A placeholder in "This repository" now; renaming comes as its own change.**
  - [pro] no decision changes in this feature; the proposal's list of placeholders as written.
  - [con] a hand edit of `repositories.json` stays the only way until then.
  - Why recommended: the proposal puts it among the placeholders, and its question of links deserves
    its own change.
- **B. A real rename now: the name changes in the list and in every address, and old links break.**
  - [pro] one name everywhere.
  - [con] a change to the repositories decision; bookmarks and links in notes break.
- **C. A display name now, shown in the UI, while the address keeps the name it was added with.**
  - [pro] links never break.
  - [con] two names per repository, and an address that no longer matches what you see.

**Answer:**

## Settled without the human

- **The order of sources** is the flag, then the environment variable, then the file, then the
  default, the order of the Command Line Interface Guidelines, in one function of the server. A
  checkout's `.env` keeps working for `vp dev` as an environment source; the packaged server still
  reads none. See [discovery](discovery-01.md#command-line-interface-guidelines).
- **Allowed host names apply at once**: the server watches the file as it watches
  `repositories.json`, and rebuilds its host check on a change. The port applies at the next start,
  and the page says so under it; there is no restart button, since a server started by `npx` cannot
  restart itself reliably. See [discovery](discovery-01.md#important-reads).
- **Removing the host name the page is using** asks first, in a dialog naming it: "This browser
  reaches Uraeda through mac.tail1234.ts.net. Removing it cuts this browser off.", with
  "Remove" and "Cancel". See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **Host names are edited as a list**, one line per name, each added, edited in place, or removed,
  saved on Enter or its Save button, as the [UI behaviour](../decisions/ui-behaviour.md) decision
  asks. The core checks each name is a host name, and the port a number from 1 to 65535.
- **A file that cannot be read** is never overwritten: the server starts with the defaults for its
  values, prints the error, and the page shows it in a banner and refuses changes until the file is
  fixed, as the list of repositories already does. A hand edit while the page is open shows on the
  page at once. See [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **The core owns the file**: finding it, reading, validating, and writing it atomically, as it owns
  `repositories.json`, so `ura` can read the same settings when a later feature needs them. Its
  folder can be moved with `URAEDA_CONFIG_DIR`, like `CLAUDE_CONFIG_DIR` and `GH_CONFIG_DIR`, which
  the tests use too. There is no `ura config` command: a hand edit is the command-line path. See
  [discovery](discovery-01.md#rules-and-their-owners).
- **Sign-in has no setting**, since basic security's decision forbids turning it off by a setting.
  Signing out is an action, not a value. See
  [discovery](discovery-01.md#sign-in-among-the-settings).
- **The theme stays in the sidebar's footer**, per browser, as today: it is a choice of the device,
  not of the machine, and the footer keeps it one tap away.
- **This feature is built on basic security once merged**: editing accepted host names from a page
  is only safe behind sign-in, and both features change the same files. The spec is written once
  basic security is on `main`. Per-repository and per-feature overrides wait for the run options
  feature in Next; the file leaves room for them in its own tables. See
  [discovery](discovery-01.md#overlaps-with-work-in-flight).

**Notes:**
