# Installing Uraeda

Uraeda has four parts, each optional but the first: the skill, the workflow your agent follows;
`ura`, the command-line tool that checks and moves it, and serves it; the app, a desktop window that
drives it; and the web UI, which drives it from a browser. The [README](README.md#getting-started)
has the quick install. This page has every way.

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

## The app

The app is Uraeda's desktop window, on Linux x64 for now. It holds its own `ura`: on its machine, it
finds the server running, or starts `ura serve` and stops it when its window closes.

It needs GTK 4.14 or newer and WebKitGTK 6.0, which Ubuntu 24.04, Debian 13, Fedora 40, and later
releases have. A desktop usually has GTK already; WebKitGTK may need installing:

```sh
sudo apt install libgtk-4-1 libwebkitgtk-6.0-4    # Debian and Ubuntu
sudo dnf install gtk4 webkitgtk6.0                # Fedora
sudo pacman -S gtk4 webkitgtk-6.0                 # Arch
```

When one is missing or too old, the app says which, and how to install it, instead of starting.

Each release has the app in two forms, with the same files: an AppImage, one program to download and
run, and a tarball, a folder to unpack where you keep programs. Neither updates itself: install the
next release the same way.

### The AppImage

```sh
curl -LO https://github.com/mrtolkien/uraeda/releases/latest/download/uraeda-app-x86_64.AppImage
chmod +x uraeda-app-x86_64.AppImage
./uraeda-app-x86_64.AppImage
```

An AppImage mounts itself with FUSE, which desktops have. Where FUSE is missing, as in a container,
run it with `--appimage-extract-and-run`.

### The tarball

Unpack it, put `uraeda` and `ura` on your `PATH`, and give the desktop its entry and icons:

```sh
mkdir -p ~/.local/opt ~/.local/bin
curl -L https://github.com/mrtolkien/uraeda/releases/latest/download/uraeda-app-x86_64-linux.tar.gz | tar -xz -C ~/.local/opt
ln -sf ~/.local/opt/uraeda/uraeda ~/.local/opt/uraeda/ura ~/.local/bin/
cp -r ~/.local/opt/uraeda/share/. ~/.local/share/
```

Uraeda is then in the desktop's launcher, and `uraeda` starts it from a terminal. Its `ura` comes
with the app, so `ura upgrade` does not update it: install the next release's tarball instead.

### Another machine's server

`uraeda --server <address>` opens another machine's server instead of starting one, such as
`uraeda --server https://desktop.tail1234.ts.net`. That server is reached through a proxy, as
[the web UI's page](docs/web-ui.md) explains. On its first start, the app asks for a pairing code:
run `ura pair` on the server's machine, which prints a one-time code and its QR code, and type the
code in. The app keeps the device's token in the desktop's secret store, so it pairs once.

### Sessions of the web UI

<!-- TASK 61: `ura import-sessions`, run once, copies the web UI's sessions into the server of
`ura serve`. Task 61 writes this section. -->

## A server alone

On a server or a machine without a desktop, install `ura` alone, with the installer script or
Homebrew below, and run `ura serve`. It serves Uraeda on http://127.0.0.1:4320, on loopback only,
until it is stopped. Other devices reach it through a proxy, and pair with `ura pair`, as above.
Started in a terminal, its first start prints an access key, once, which signs a browser in: keep it
in a password manager. Started any other way, as a service or by the app, it prints none, so none
rests in a log: `ura key` on its machine shows one then, once.

## From source, with Nix

The repository's dev shell pins every tool that builds Uraeda. In a clone:

```sh
nix run github:mrtolkien/uraeda -- --version    # ura alone
nix develop -c just package                     # the app, as a release ships it
```

`just package` writes the tarball and the AppImage in `target/package/`, on x64 Linux.
[CONTRIBUTING.md](CONTRIBUTING.md) has the rest.

## Claude Code

The web UI's sessions run Claude Code by default, installed and signed in on the machine that runs
Uraeda. It needs a paid plan: Pro, Max, Team, Enterprise, or Console. Install it as its
[setup page](https://code.claude.com/docs/en/setup) says, for example:

```sh
curl -fsSL https://claude.ai/install.sh | bash
```

Claude Code is a built-in extension, `claude`: Settings, Extensions turns it off, in every
repository or some, and sets the command it runs, `claude` by default.

## Codex

The web UI's sessions can run Codex too, installed and signed in on the machine that runs Uraeda,
with a ChatGPT plan or an OpenAI API key. Install it as its
[documentation](https://developers.openai.com/codex/cli) says, then sign in, for example:

```sh
npm install -g @openai/codex
codex login
```

Codex is a built-in extension, `codex`, turned off and given its command, `codex` by default, the
same way. Its sessions run in its sandbox, which writes the session's folder only, with the network
off, whatever your `~/.codex/config.toml` says: its automatic reviewer approves each git write and
network command first.

Another agent runs through a runtime [extension](docs/extensions.md#runtimes) of yours. Without any
agent, the web UI still shows and edits every file, and its pages only commit.

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
