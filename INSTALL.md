# Installing Uraeda

Uraeda has two parts: the skill, the workflow your agent follows, and `ura`, the command-line tool
that checks the workflow's files and serves pages to answer and review on. Only the skill is needed.
The [README](README.md#getting-started) has the quick install. This page has every way.

## The skill

`ura install` installs the skill for your user, so every repository on your machine has it. It can
also install it for one repository, into the folders your agents read: `.agents/skills`,
`.claude/skills`, or both:

```sh
ura install                                # for your user
ura install --repo --agents --claude       # for this repository: your agents and Claude Code
ura install --update                       # every copy ura installed, keeping your edits
```

In a repository, `ura init` sets up `specs/` and offers to install the skill for your user, when
your agents have none.

Without `ura`, install the skill for any agent that reads [Agent Skills](https://agentskills.io/),
like Claude Code, Codex, Cursor, or OpenCode:

```sh
npx skills add mrtolkien/uraeda
```

## `ura`

`ura` is one binary, with nothing else to install. It runs on Linux and macOS, on x64 and arm64.
From a release:

```sh
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/mrtolkien/uraeda/releases/latest/download/uraeda-cli-installer.sh | sh
brew install mrtolkien/tap/ura                     # or with Homebrew
```

From source, with Cargo or Nix:

```sh
cargo install --git https://github.com/mrtolkien/uraeda uraeda-cli
nix run github:mrtolkien/uraeda -- --version       # built with the repository's pinned toolchain
```

`ura upgrade` installs the latest release, through the installer script or Homebrew, then updates
your skill. With Cargo, run `cargo install` again; with Nix, update the flake input.

`ura next` and `ura status` read your pull requests with the [GitHub CLI](https://cli.github.com/),
`gh`, when it is installed and signed in. Without it, they say they cannot see them.

### Tab completion

Tab completes `ura`'s commands, flags, and values in fish and zsh: the features and changes under
way after `ura next` and `ura review`, and the open questions after `ura answer`.

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

## The pages on your phone

`ura serve` listens on this machine only, on `127.0.0.1:4310`. To answer from your phone, put it on
your own network, with [Tailscale](https://tailscale.com/) for example, and name the address's host
in the settings file, `~/.config/uraeda/config.toml`:

```sh
tailscale serve --bg 4310
```

```toml
[serve]
hosts = ["laptop.tail1234.ts.net"]
```

On the phone, open the address `ura serve` prints with that name in place of `127.0.0.1:4310`, as
`https://laptop.tail1234.ts.net/`, and sign in with the token it printed under its address. The
token answers for you: keep it to yourself, in your password manager. Its "Obsidian setup" page
gives your phone a starter vault for your notes, which
[the CLI's page](docs/cli.md#your-notes-on-your-phone) explains.

## Coming from Uraeda 2

Version 3 has no app, no server of agent sessions, and no extensions: the last release with them is
[v2.1.0](https://github.com/mrtolkien/uraeda/releases/tag/v2.1.0). `ura upgrade` from 2.x installs
the small `ura`, and `ura serve` takes the place of `ura serve-app`'s pages. Delete the desktop app,
if you installed it, by hand.

`ura` 3 reads `config.toml` in `~/.config/uraeda/` as before, and keeps its token and the default
vault in `~/.local/share/uraeda/`. What the 2.x servers kept there and in `uraeda-next` is no longer
read, and can go: name the repositories `ura serve` shows in `[serve] repositories`.

Your agents run where you run them: Claude Code, Codex, or any agent that reads the skill, in a
terminal or a session host. With T3 Code, `ura serve` can tell the feature's session to continue
when you send answers, as [the CLI's page](docs/cli.md#ura-serve) says.
