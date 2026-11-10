{
  description = "Uraeda: the ura CLI, and the development shell with Node, pnpm, the pinned Rust toolchain, and Native Shell";

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

      # Native Shell's CLI, `nsh`, with the runtimes it runs and packages a TSX app on: the release's
      # prebuilt distribution, pinned by its version and its hash. The version is also the `nsh-*`
      # crates' in `Cargo.toml` and `minRuntime` in `app/nsh.json`, and the release's commit is in
      # `AGENTS.md`: they move together. NSH releases it for x86_64 Linux only, so the app builds
      # there.
      nshFor =
        pkgs:
        pkgs.stdenv.mkDerivation (finalAttrs: {
          pname = "nsh";
          version = "0.4.0";
          src = pkgs.fetchurl {
            url = "https://github.com/longbridge/nsh/releases/download/v${finalAttrs.version}/nsh-linux-x86_64.tar.gz";
            hash = "sha256-iAYSGuv0C7Ufj7aqcDci+7ASU/mkNXWcGNU77s4eyXY=";
          };
          nativeBuildInputs = [ pkgs.autoPatchelfHook ];
          buildInputs = gtkFor pkgs ++ [ pkgs.stdenv.cc.cc.lib ];
          # `nsh` finds its runtimes in `bin/../runtime`. Android's, GPUI's, and the embedding
          # kits, 650 MB of the distribution, are left out: the app targets GTK and the web.
          installPhase = ''
            mkdir -p $out/runtime
            cp -r bin $out/bin
            cp -r runtime/linux runtime/web $out/runtime/
          '';
          dontStrip = true;
        });

      # What NSH's GTK backend builds against and runs on: GTK 4, which must be 4.14 or newer, and
      # WebKitGTK 6.0 for web views.
      gtkFor =
        pkgs: with pkgs; [
          gtk4
          webkitgtk_6_0
          pango
          cairo
          gdk-pixbuf
          glib
          graphene
          harfbuzz
          fontconfig
        ];

      # `hidden-display <command>` runs a command on an X display of its own that no screen shows:
      # every run of the app by an agent or a check goes through it, so no window opens on the
      # human's display. GTK prefers the session's Wayland display, so the command loses it. It
      # also gets a session bus of its own: what the app sends there, a notification first,
      # reaches no desktop. Xvfb picks its own free display number (`-d`), so several runs start
      # at once, as the checks of `crates/app/tests/outside.rs` do.
      hiddenDisplayFor =
        pkgs:
        pkgs.writeShellScriptBin "hidden-display" ''
          exec env -u WAYLAND_DISPLAY GDK_BACKEND=x11 \
            ${pkgs.dbus}/bin/dbus-run-session --config-file=${hiddenBusFor pkgs} -- \
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
              nodejs_24
              # pnpm downloads the exact version pinned in package.json's devEngines.
              pnpm
              (rust-bin.fromRustupToolchainFile ./rust-toolchain.toml)
              # The Rust tests' runner, and their coverage.
              cargo-nextest
              cargo-llvm-cov
            ]
            # The app, on Native Shell: GTK's build tools, clang for QuickJS' bindings, and the
            # display no screen shows.
            ++ lib.optionals stdenv.hostPlatform.isLinux [
              pkg-config
              clang
              (hiddenDisplayFor pkgs)
              # Real key presses and clicks on the hidden display, for the checks of
              # `crates/app/tests/outside.rs`.
              xdotool
            ]
            ++ lib.optionals (stdenv.hostPlatform.system == "x86_64-linux") [ (nshFor pkgs) ];
          buildInputs = pkgs.lib.optionals pkgs.stdenv.hostPlatform.isLinux (gtkFor pkgs);
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
            # A worktree, whose `.git` is a file, without a build or a task cache yet starts from
            # the main checkout's: see `packages/server/scripts/worktree-seed.ts`.
            root=$(git rev-parse --show-toplevel 2>/dev/null)
            if [ -f "$root/.git" ] && { [ ! -e "$root/target" ] || [ ! -e "$root/node_modules/.vite/task-cache" ]; }; then
              node "$root/packages/server/scripts/worktree-seed.ts" "$root" || true
            fi
            unset root
          '';
          # QuickJS' bindings are generated with libclang.
          LIBCLANG_PATH = "${pkgs.llvmPackages.libclang.lib}/lib";
          # `nsh check` runs this TypeScript, the version NSH pins, and downloads none.
          NSH_TSC = "${pkgs.typescript}/bin/tsc";
          # The browsers of the screenshot scripts in `packages/web/scripts/`: the playwright package pins
          # the same version as nixpkgs' driver, so its browsers run here without a download.
          PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright-driver.browsers}";
          PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "true";
          PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
          # WebKit needs an EGL driver, which machines without a GPU stack, like CI's, lack.
          __EGL_VENDOR_LIBRARY_DIRS = "${pkgs.mesa}/share/glvnd/egl_vendor.d";
          # The browsers' fonts, the same on every machine: text in the screenshots does not depend on the
          # fonts a machine has installed.
          FONTCONFIG_FILE = pkgs.writeText "fonts.conf" ''
            <?xml version="1.0"?>
            <!DOCTYPE fontconfig SYSTEM "fonts.dtd">
            <fontconfig>
              <include>${pkgs.fontconfig.out}/etc/fonts/conf.d</include>
              <dir>${pkgs.dejavu_fonts}/share/fonts</dir>
              <cachedir prefix="xdg">uraeda-fontconfig</cachedir>
            </fontconfig>
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
