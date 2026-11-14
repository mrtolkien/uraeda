{
  description = "Uraeda: the ura CLI, and the development shell with the pinned Rust toolchain and the tools of the justfile";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
    rust-overlay.url = "github:oxalica/rust-overlay";
    rust-overlay.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs =
    { nixpkgs, rust-overlay, ... }:
    let
      systems = [
        "aarch64-darwin"
        "aarch64-linux"
        "x86_64-linux"
      ];
      forAllSystems =
        f:
        nixpkgs.lib.genAttrs systems (
          system:
          f (
            import nixpkgs {
              inherit system;
              overlays = [ rust-overlay.overlays.default ];
            }
          )
        );

      # `hidden-display <command>` runs a command on an X display of its own that no screen shows,
      # 1400 by 800: every window an agent or a check opens, Obsidian's for the vault's sync, goes
      # through it, so no window opens on the human's display. The command loses the session's
      # Wayland display, so Electron apps take `--ozone-platform=x11`. It also gets a session bus of
      # its own, so what it sends there reaches no desktop. Xvfb picks its own free display number
      # (`-d`), so several runs start at once. What runs there is never a person's use, so it runs
      # through `scripts/isolated.sh`: data, configuration, cache, and state folders of its own, and
      # a check that it wrote nothing in the person's.
      hiddenDisplayFor =
        pkgs:
        pkgs.writeShellScriptBin "hidden-display" ''
          exec ${pkgs.bash}/bin/bash ${./scripts/isolated.sh} env -u WAYLAND_DISPLAY GDK_BACKEND=x11 \
            ${pkgs.dbus}/bin/dbus-run-session --dbus-daemon=${pkgs.dbus}/bin/dbus-daemon --config-file=${hiddenBusFor pkgs} -- \
            ${pkgs.xvfb-run}/bin/xvfb-run -d -s "-screen 0 1400x800x24 -nolisten tcp" "$@"
        '';

      # The hidden display's session bus. It names no folder of services, so it starts none: the
      # stock configuration started the machine's desktop portal there, which reached for the
      # human's compositor.
      hiddenBusFor =
        pkgs:
        pkgs.writeText "hidden-bus.conf" ''
          <!DOCTYPE busconfig PUBLIC "-//freedesktop//DTD D-Bus Bus Configuration 1.0//EN"
            "http://www.freedesktop.org/standards/dbus/1.0/busconfig.dtd">
          <busconfig>
            <type>session</type>
            <keep_umask/>
            <listen>unix:tmpdir=/tmp</listen>
            <auth>EXTERNAL</auth>
            <policy context="default">
              <allow send_destination="*" eavesdrop="true"/>
              <allow eavesdrop="true"/>
              <allow own="*"/>
            </policy>
          </busconfig>
        '';
    in
    {
      formatter = forAllSystems (pkgs: pkgs.nixfmt-tree);

      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          packages =
            with pkgs;
            [
              (rust-bin.fromRustupToolchainFile ./rust-toolchain.toml)
              # The Rust tests' runner, and their coverage.
              cargo-nextest
              cargo-llvm-cov
              # The recipes of the `justfile`: every check and build is a `just <recipe>`.
              just
              # Git, which the workflow's code, the sandbox, the tests' repositories, and
              # `just release` run: in a pure shell, `nix develop -i`, the machine's is not there.
              git
              # The formatter of what Cargo does not read: Markdown, JSON, TOML.
              oxfmt
              # The release: cargo-dist, at the version `dist-workspace.toml` pins, and the
              # workflows' linter.
              cargo-dist
              actionlint
            ]
            ++ lib.optionals stdenv.hostPlatform.isLinux [
              # `flock`, with which `scripts/isolated.sh` shares the machine's heavy slots.
              util-linux
              (hiddenDisplayFor pkgs)
            ]
            # On a Mac, `flock` for `scripts/isolated.sh`'s heavy slots, util-linux's being Linux's.
            ++ lib.optionals stdenv.hostPlatform.isDarwin [ flock ];
          # `nix develop` points the temporary folder at a `nix-shell.*` folder of its own, and
          # writes its shell's startup file in a `nix-develop-<its pid>-*` one: it removes neither
          # when it runs a command (`-c`), so every command left two in /tmp, with what the command
          # wrote there, thousands a day. The shell removes both, the startup file being read
          # already, and uses the temporary folder it was started in.
          shellHook = ''
            if [ -n "''${NIX_BUILD_TOP:-}" ] && [ "''${TMPDIR:-}" = "$NIX_BUILD_TOP" ]; then
              TMPDIR=$(dirname "$NIX_BUILD_TOP")
              rmdir "$NIX_BUILD_TOP" 2>/dev/null
              rm -rf "$TMPDIR"/nix-develop-$$-*
              export TMPDIR TMP="$TMPDIR" TEMP="$TMPDIR" TEMPDIR="$TMPDIR"
              unset NIX_BUILD_TOP
            fi
            # A worktree, whose `.git` is a file, without a build yet starts from the closest
            # checkout's: see `scripts/worktree-seed.sh`.
            root=$(git rev-parse --show-toplevel 2>/dev/null)
            if [ -f "$root/.git" ] && [ ! -e "$root/target" ]; then
              "$root/scripts/worktree-seed.sh" "$root" || true
            fi
            unset root
          '';
        };
      });

      # `nix run github:mrtolkien/uraeda`: the ura CLI, built from source with the pinned toolchain.
      packages = forAllSystems (
        pkgs:
        let
          toolchain = pkgs.rust-bin.fromRustupToolchainFile ./rust-toolchain.toml;
          rustPlatform = pkgs.makeRustPlatform {
            cargo = toolchain;
            rustc = toolchain;
          };
        in
        {
          default = rustPlatform.buildRustPackage {
            pname = "ura";
            version = (builtins.fromTOML (builtins.readFile ./Cargo.toml)).workspace.package.version;
            src = ./.;
            cargoLock.lockFile = ./Cargo.lock;
            cargoBuildFlags = [
              "-p"
              "uraeda-cli"
            ];
            doCheck = false;
            # Tab completion, where fish and zsh find it: each script asks `ura` at every Tab. The
            # scripts come from running `ura`, which a cross build cannot.
            nativeBuildInputs = [ pkgs.installShellFiles ];
            postInstall = pkgs.lib.optionalString (pkgs.stdenv.buildPlatform.canExecute pkgs.stdenv.hostPlatform) ''
              installShellCompletion --cmd ura \
                --fish <(COMPLETE=fish $out/bin/ura) \
                --zsh <(COMPLETE=zsh $out/bin/ura)
            '';
            meta.mainProgram = "ura";
          };
        }
      );
    };
}
