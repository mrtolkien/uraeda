# Installing Uraeda

Uraeda has three parts, each optional but the first: the skill, the workflow your agent follows;
`ura`, the command-line tool that checks and moves it; and the web UI, which drives it from a
browser. The [README](README.md#getting-started) has the quick install. This page has every way.

## The skill

`ura install` installs the skill for your user, so every repository on your machine has it. It can
also install it for one repository, into the folders your agents read: `.agents/skills`,
`.claude/skills`, or both:

```sh
ura install                                # for your user
ura install --user --agents --claude       # for your agents and Claude Code
```

In a repository, `ura init` sets up `specs/` and offers to install the skill for your user, when
your agents have none.

Without `ura`, install the skill for any agent that reads [Agent Skills](https://agentskills.io/),
like Claude Code, Codex, Cursor, or OpenCode:

```sh
npx skills add mrtolkien/uraeda
```

## `ura`

`ura` runs on Linux and macOS, on x64 and arm64. From a release:

```sh
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/mrtolkien/uraeda/releases/latest/download/uraeda-cli-installer.sh | sh
brew install mrtolkien/tap/ura                     # or with Homebrew
nix run github:mrtolkien/uraeda -- --version       # or with Nix, built from source
```

`ura upgrade` installs the latest release, through the installer script or Homebrew, then updates
your skill. With Nix, update the flake input.

### Tab completion

Tab completes `ura`'s commands, flags, and values in fish and zsh: proposals after `ura start`, the
features and changes under way after `ura next`, and the open questions after `ura answer`.

Homebrew and the Nix package install its scripts. A fish or zsh from the same package manager finds
them without setup. Another zsh needs their folder on its `fpath`, as Homebrew's
[shell completion](https://docs.brew.sh/Shell-Completion) page says, or the line below.

Otherwise, in fish, `ura install` offers to set it up, and `ura install --completions` does it
alone. In zsh, add one line to `~/.zshrc`, after `compinit`. Either way, the shell asks `ura` itself
at each Tab, so completion follows every upgrade:

```sh
echo 'COMPLETE=fish ura | source' > ~/.config/fish/completions/ura.fish  # fish, by hand
echo 'source <(COMPLETE=zsh ura)' >> ~/.zshrc                            # zsh
```

## Claude Code

The web UI's sessions run Claude Code, installed and signed in on the machine that runs Uraeda. It
needs a paid plan: Pro, Max, Team, Enterprise, or Console. Install it as its
[setup page](https://code.claude.com/docs/en/setup) says, for example:

```sh
curl -fsSL https://claude.ai/install.sh | bash
```

Without Claude Code, the web UI still shows and edits every file, and its pages only commit.

## The web UI

The web UI comes from npm, and needs Node 24 or later. In a repository, run it with `npx`: it starts
the server on http://127.0.0.1:4310 and opens the repository in your browser. Run it in another
repository and it opens in the server already running. For a lasting install, install it globally,
then run `uraeda`, and update it the same way:

```sh
npx @uraeda/ui                 # the web UI, for the repository you are in
npm i -g @uraeda/ui@latest     # a lasting install, then `uraeda`
```

In a repository whose `package.json` asks for another package manager in `devEngines`, npm refuses
to run `npx`, with `EBADDEVENGINES`. In a pnpm project, run `pnpm dlx @uraeda/ui`. Anywhere, install
it once with `npm i -g @uraeda/ui@latest` and run `uraeda`.

Its flags, sign-in, and settings are in [the web UI's page](docs/web-ui.md).
