# Contributing to Uraeda

Uraeda's tools are a Rust core, the `ura` CLI with the server inside it, and
[an app on Native Shell](#the-app-on-native-shell), drawn in a desktop window and in a browser. The
[repository's layout](AGENTS.md#repository-layout) says what lives where, and the
[stack](specs/decisions/stack.md) and [toolchain](specs/decisions/toolchain.md) decisions why.
Uraeda builds itself with its own workflow: its files are in [`specs/`](specs/), and what is being
built now is in [specs/PRIORITIES.md](specs/PRIORITIES.md).

## Building the tools

Everything runs in the dev shell, `nix develop`, which pins every tool: Rust, `just`, Native Shell's
CLI, the formatters, and the libraries the app links. Nothing is installed in a checkout, and no
check needs Node. Every check and build is a recipe of the [`justfile`](justfile), and `just` lists
them:

```sh
nix develop                              # the dev shell; or `nix develop -c just <recipe>`
just task uraeda-server uraeda-protocol  # after a Rust change: formatting, Clippy, the crates' tests
just task-app                            # after an app change: formatting, lints, types, the app's tests
just check                               # everything builds: every crate with its tests, the app's types
just ready                               # before a push: every check and test
just fmt                                 # format Rust, TSX, Markdown, JSON, and TOML
just test -p uraeda-core                 # the Rust tests, with cargo-nextest's arguments
just bench                               # the benchmarks of the specs' success criteria, on demand
cargo run -p uraeda-cli -- status        # ura, from source
```

Turn the commit hook on once in a clone: it formats the files a commit stages, as `just fmt` does,
and never touches what the commit leaves out. Every worktree of the clone shares the setting. A
clone made before the move to Native Shell points at `.vite-hooks/_`, which no longer exists, so it
ran no hook: the same command replaces it.

```sh
git config core.hooksPath .githooks
```

## The app, on Native Shell

The UI is one TSX app on [Native Shell](https://nsh.dev) (NSH), in [`app/`](app/), with its Rust
crate in [`crates/app/`](crates/app/). It talks to the server, [`crates/server/`](crates/server/),
over [`crates/protocol/`](crates/protocol/), and edits text through [`crates/vim/`](crates/vim/).
`nix develop` on x86_64 Linux brings what they build with: NSH's CLI, `nsh`, GTK 4 and WebKitGTK
6.0, clang, and a display no screen shows. On an Apple silicon Mac it brings `nsh` with its AppKit,
iOS, and web runtimes; the Mac app needs Xcode's command line tools too, and the iOS app Xcode.
Without Nix, install NSH 0.5.0, the version of the `nsh-*` crates in [`Cargo.toml`](Cargo.toml),
with what its [installation page](https://nsh.dev/docs/installation) lists for Linux.

```sh
just app-check                         # cargo check of the app's crate, then the types of its TSX
just app-test                          # the app's tests, app/**/*.test.tsx, with no display
just app-dev                           # the app in a GTK window, reloading as its TSX changes
hidden-display just app-dev            # the same, on a display no screen shows
just app                               # the app itself, uraeda, on this machine's server and folders
just sandbox                           # the whole app to review: sample projects, a fake agent, no sign-in
just sandbox --reset                   # the same, its sample projects built again
just sandbox --long-chat               # the same, with a chat of 20,000 messages
just sandbox --no-app                  # the server alone, on 4420
just walk                              # a day's work through the app, a picture per step, in target/shots/walk/
just app-shots /r/sample/inbox         # a screen's pictures, in both themes, at a desktop's and a phone's width
just gallery                           # every component of the library, in one app
just sandboxed scripts/nsh.sh test     # a command beside a fresh sandbox, its address in URAEDA_SANDBOX
just web-build                         # the app for a browser, in target/web/, which ura serve serves
just web-test                          # that build in a real browser: sign-in, the home page, its pictures
just app-dev                           # on a Mac: the app in an AppKit window, over `just sandbox --no-app`
just package-macos                     # the Mac app as a release ships it, in target/macos/
just app-ios                           # the app in the iOS Simulator, on a Mac, with hot reload
just package-ios                       # the iOS app as a device installs it, in target/ios/
just install-ios                       # that app, built and installed on the phone that is plugged in
```

The recipes run `nsh` through [`scripts/nsh.sh`](scripts/nsh.sh), which builds in the repository's
`target/` and keeps the versions of [`Cargo.lock`](Cargo.lock): run any other `nsh` command the same
way, as `just nsh build`. `just app-check` also writes NSH's types in `app/.nsh/`. Every test,
picture, and sandbox recipe runs through [`scripts/isolated.sh`](scripts/isolated.sh): its data,
configuration, and cache folders are temporary, and never yours. The sandbox keeps its state in
`.sandbox/` until `--reset`, and never reads your projects, your data, or a real agent.

### macOS

On a Mac, `just app-dev` runs the app on AppKit, reloading as its TSX changes, over the sandbox that
`just sandbox --no-app` started (`just sandbox` alone starts both). It opens a window on your
screen: macOS has no hidden display. The checks' pictures draw in windows too:
`nsh test --target macos` puts them on a second display when there is one, and in the background.
Leave `--window-size` larger than the screen out: a window macOS shrinks as it opens keeps its
texts' first layout, wrapped too wide, until each changes.

`nix develop -c just package-macos` packages the app as a release ships it, in `target/macos/`:
`Uraeda.app` and `uraeda-app-aarch64-macos.zip`, with its `.sha256`
([`scripts/macos.sh`](scripts/macos.sh)). `nsh package --target macos` builds NSH's AppKit runner
with the app's crate and the TSX compiled for release; the script puts `ura`, built with the
`release-app` profile, beside the runner in `Contents/MacOS/`, and signs the bundle again, ad hoc.
`--open` opens it after: it finds this Mac's server through its status file, or starts the `ura`
beside it in `ura serve`'s data folder, with your login shell's `PATH`, and keeps the device's token
in the login keychain ([`crates/app/src/local.rs`](crates/app/src/local.rs)). A development run and
the checks work with the sandbox instead, and never start a server. The look the Mac takes, the
toolbar, the menu bar, the system's menus and alerts, is in
[`specs/ui/wide.md`](specs/ui/wide.md#macos).

### iOS

On a Mac with Xcode, `just app-ios` runs the app in the iOS Simulator, reloading as its TSX changes.
Its first page asks for a server: "Use this Mac's sandbox" takes the one `just sandbox --no-app`
started, which the simulator reaches at `127.0.0.1` as the Mac does. The field takes any other
address, as a sandbox started with `--sign-in --port 4431`, whose
`ura pair --data-dir <its folder>/data` prints a code and a link to pair with.
`--device "iPhone 17 Pro"` picks a simulator. An extension's page runs in the frame page of the
server's web build, `extension.html`: on a Mac, `nsh component add web` once, then `just web-build`,
and a sandbox started with `URAEDA_WEB_BUILD=$PWD/target/web`. `just package-ios` builds the app
with no development server, in `target/ios/`, and installs and starts it in the simulator; with
`--target ios --sign "<identity>" --profile <file>.mobileprovision` it writes a device's `.ipa`
instead (`security find-identity -v -p codesigning` lists the identities).

A text field keeps the texts it told its owner until its owner gives the last of them back
([`vim_bridge/echo.rs`](crates/app/src/vim_bridge/echo.rs)): a late echo of an older one never puts
the caret back, which lost keys typed fast on a busy phone.

#### On a phone

Once the phone is set up (below), putting a new version on it is one command, with the phone plugged
in and unlocked:

```sh
nix develop -c just install-ios        # build, install, and start the app on the phone
```

It finds the profile, the certificate, and the phone itself ([`scripts/ios.sh`](scripts/ios.sh),
[`scripts/ios-device.py`](scripts/ios-device.py)), builds the app with no development server,
installs it, and starts it. `URAEDA_IOS_DEVICE` names another phone, by the identifier
`xcrun devicectl list devices` prints. Run it again for every new version of the app.

**Every 7 days on a free Apple account**, the profile and the certificate expire, and the app stops
opening ("every provisioning profile has expired" is what the command says). Open the Xcode project
of the one-time setup, run it on the phone once (▶), which makes a new profile, and run
`just install-ios` again. A paid account's last a year.

**The one-time setup**, on a Mac signed in to Xcode with an Apple ID, which gives a free "Personal
Team":

1. Plug the phone in, unlock it, and tap "Trust". In Xcode, Window, Devices and Simulators, select
   the phone and wait for it to be prepared. Then, on the phone, Settings, Privacy & Security, at
   the bottom, turn Developer Mode on: iOS shows it only after Xcode has prepared the phone. It
   restarts.
2. In Xcode, File, New, Project, iOS, App, with the Team set to your Personal Team and a Bundle
   Identifier of your own, as `uraeda.uraeda`. Run it on the phone (▶). Xcode makes the certificate
   and the profile, in `~/Library/Developer/Xcode/UserData/Provisioning Profiles/`. The app's bundle
   ID is that of the profile, so nothing here names it.
3. Install once with `just install-ios`. On the phone, Settings, General, VPN & Device Management,
   under Developer App, tap your certificate, Trust. Then open the app.

The app asks for its server on its first page: the address of the Mac that runs `ura serve` as the
phone reaches it, `https://<your Mac>.<tailnet>.ts.net` over Tailscale, then the code `ura pair`
prints ([docs/app.md](docs/app.md#reaching-it-from-another-device)).
`just package-ios --target ios --id <the ID> --sign "<identity>" --profile <the profile>` builds the
`.ipa` alone.

`nix develop -c just package` packages the app as a release ships it, in `target/package/`: the
folder `uraeda/`, the same as a tarball and as an AppImage, each with its `.sha256`.
[`scripts/package.sh`](scripts/package.sh) compiles the TSX with `nsh build --release`, builds
`uraeda` and `ura` with Cargo's `release-app` profile, and makes them run outside Nix, on the
system's loader and libraries. It puts the launcher, the desktop entry, and the icon of
[`app/package/`](app/package/) around them, the icons rendered at each size from the SVG. NSH's own
`nsh package` is not used: its program is NSH's runner, without the app's host, which starts the
server and pairs the device. It prints the libraries the app links and the newest glibc it needs.

### Benchmarks

The [performance decision](specs/decisions/performance.md)'s targets are measured on demand, never
in a check: a timing under other builds' load proves nothing, and fails for no reason.

```sh
nix develop -c just bench-navigation   # a key to its page drawn with its data, every page and action
nix develop -c just frames scrolling   # a scene's frames: streaming, scrolling, glass, or reading
nix develop -c just frames glass software   # the same on Xvfb, which paints in software
```

Both build every crate optimised, in `target/optimised/`, since a development build's engine and
JavaScript interpreter run several times slower than a release's. Both draw on the machine's GPU, on
a display no screen shows (`hidden-display --gpu`: a headless Weston with its GL renderer, at 120
Hz), which needs the GL driver where Nix's programs find it, `/run/opengl-driver`. Run each once, on
a quiet machine, and say the machine's load with the numbers. A development build of the app also
warns in its console when an interaction takes more than 100 ms to draw
([`app/ui/timing.ts`](app/ui/timing.ts)).

To upgrade NSH, change its version and hash in [`flake.nix`](flake.nix), the `nsh-*` crates in
`Cargo.toml`, `minRuntime` in [`app/nsh.json`](app/nsh.json), and the version and commit in
[`AGENTS.md`](AGENTS.md#native-shell-nsh), in one commit.

## Settings while developing

`ura serve` reads its settings from the settings file, and from variables of its environment or of
the `.env` in your config folder, as [the app's page](docs/app.md#settings) says: `URAEDA_PORT`,
`URAEDA_ALLOWED_HOSTS`, `URAEDA_DATA_DIR`, and the switches of the runs. No `.env` of a checkout is
ever read. To try a build on folders of its own, beside your own Uraeda:

```sh
cargo run -p uraeda-cli -- serve --port 0 --data-dir /tmp/uraeda-data
```

## The agents' integrations

The server's runtimes for Claude Code and Codex are tested on recordings of the real agents, in
[`fixtures/runtimes/`](fixtures/runtimes/README.md), played by stand-ins: no check runs an agent.
When Claude Code or Codex changes and sessions break, check the runtime against the installed agent,
with two short messages each. Both spend a little of the account's plan, and only run when asked
for:

```sh
cargo nextest run -p uraeda-server -E 'test(/^claude::real::/)' --run-ignored only --no-capture
cargo nextest run -p uraeda-server -E 'test(/^codex::real::/)' --run-ignored only --no-capture
```

## The README's screenshots

The README shows Home, a round of questions, and a spec of the sandbox's realistic project, at a
desktop's and a phone's width, in both themes. After a change to how these pages look, take them
again with `just app-shots <address>`, which writes each page's four pictures in
`target/shots/app/`, and copy them over the 12 PNG files of `docs/images/screenshots/`:

```sh
just app-shots /r/realistic/                                              # home
just app-shots /r/realistic/f/2026-10-21-leader-key/clarifications-01.md  # questions
just app-shots /r/realistic/f/2026-10-19-leader-key/spec.md               # spec
```

## Releasing

On an up-to-date `main`, `just release` asks for the release's name, writes the notes in
`CHANGELOG.md` under `<version> - <name>`, the GitHub release's title, sets the version, tags, and
pushes:

```sh
just release 1.4.0
just release 1.4.0 --name "Vim mode + git page"
just release 1.4.0 --dry-run     # the notes alone: nothing changes
```

A pushed tag runs [`release.yml`](.github/workflows/release.yml), which cargo-dist writes from
[`dist-workspace.toml`](dist-workspace.toml): `just dist generate` writes it again after a change
there, and `just release-plan` fails while it is out of date. Its jobs build the app for a browser
once ([`build-web.yml`](.github/workflows/build-web.yml)), then `ura`, which holds it, for each
platform, and the Linux app with `just package` in the dev shell
([`build-app.yml`](.github/workflows/build-app.yml)), all from the tag's commit, so they share its
version. Only once every build passed does the `host` job create the GitHub release, with every file
at once; the Homebrew formula follows.

A release that stopped part way is completed at the same version: on the tag's run, "Re-run failed
jobs". A failed build released nothing, so its re-run builds what failed, reuses what passed, and
releases it all. A failed `host` job left no release either: `gh release create` deletes its draft
when an upload fails. Only a run cancelled during that upload leaves a draft, to delete by hand. A
run that created the release never replaces a file of it: run again, it stops at the release that
exists, and only the jobs after it, such as Homebrew's, are re-run. GitHub re-runs a run's jobs for
30 days.

## Licenses

The code is under the [MIT](LICENSE-MIT) or [Apache-2.0](LICENSE-APACHE) licenses, at your option.

The app bundles the [Monaspace](https://github.com/githubnext/monaspace),
[Atkinson Hyperlegible Next](https://github.com/googlefonts/atkinson-hyperlegible-next),
[Literata](https://github.com/googlefonts/literata),
[JetBrains Mono](https://github.com/JetBrains/JetBrainsMono), and
[Inter](https://github.com/rsms/inter) fonts, under the SIL Open Font License 1.1.

The shipped colour themes, in `crates/core/themes/`, take their colours from their projects, each
file's header naming its source, its version, and its license: Catppuccin, Dracula and Alucard,
GitHub's Primer, Gruvbox, Kanagawa, Nord, Atom's One Dark and One Light, Rosé Pine, Solarized, and
the Tokyo Night VS Code theme (Tokyo Night Light), under the MIT license; and folke's
tokyonight.nvim (Tokyo Night, Storm, and Moon), under the Apache-2.0 license.

The harnesses' marks are [Codicons](https://github.com/microsoft/vscode-codicons)' drawings, by
Microsoft, under the Creative Commons Attribution 4.0 license (CC BY 4.0). The app's other icons are
[Lucide](https://lucide.dev)'s, under the ISC license.
