{
  description = "Uraeda: the ura CLI, and the development shell with the pinned Rust toolchain, Native Shell, and the tools of the justfile";

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
      # prebuilt distribution, pinned by its version and its hashes. The version is also the `nsh-*`
      # crates' in `Cargo.toml` and `minRuntime` in `app/nsh.json`, and the release's commit is in
      # `AGENTS.md`: they move together. NSH releases it for x86_64 Linux only, so the app builds
      # there.
      nshFor =
        pkgs:
        pkgs.stdenv.mkDerivation (finalAttrs: {
          pname = "nsh";
          version = "0.5.0";
          src = pkgs.fetchurl {
            url = "https://github.com/longbridge/nsh/releases/download/v${finalAttrs.version}/nsh-linux-x86_64.tar.gz";
            hash = "sha256-pCK75dwqeuP/MI7lbgXXPVvsyB9XrfEUR/xXDc7mXg8=";
          };
          # The web runtime, a component of the release since 0.5.0: `nsh` would download it at the
          # first web build, into its own folder, which the store does not allow. Its record,
          # `components/web.json`, tells `nsh` it is installed. A new hash is what
          # `nix store prefetch-file --hash-type sha256 <url>` prints.
          web = pkgs.fetchurl {
            url = "https://github.com/longbridge/nsh/releases/download/v${finalAttrs.version}/nsh-web.tar.gz";
            hash = "sha256-F8TYtpDBKR/+7FnG3MbLlnvQPbtIZKyaYdPNPSGSxHc=";
          };
          nativeBuildInputs = [ pkgs.autoPatchelfHook ];
          buildInputs = gtkFor pkgs ++ [ pkgs.stdenv.cc.cc.lib ];
          # `nsh` finds its runtimes in `bin/../runtime`: Linux's, which the release holds, and the
          # web's. Android's, GPUI's, the terminal's, and the embedding kits are other components,
          # left out: the app targets GTK and the web.
          installPhase = ''
            mkdir -p $out/runtime
            cp -r bin $out/bin
            cp -r runtime/linux $out/runtime/
            tar -xzf $web --strip-components=1 -C $out nsh/runtime/web nsh/components/web.json
          '';
          dontStrip = true;
        });

      # The C compiler of the web build: Native Shell's `zlib` module links zstd's C library into
      # the WebAssembly module. The dev shell's `clang` is Nix's wrapper, which hardens every
      # object for this machine with a flag WebAssembly refuses, so this is clang itself, told
      # where its own headers are.
      wasmClangFor =
        pkgs:
        let
          clang = pkgs.llvmPackages.clang-unwrapped;
        in
        pkgs.writeShellScript "wasm-clang" ''
          exec ${clang}/bin/clang -resource-dir ${clang.lib}/lib/clang/${pkgs.lib.versions.major clang.version} "$@"
        '';

      # The headless browser of the web build's tests and pictures: Chromium, the one nixpkgs
      # pins for Playwright, driven over the DevTools protocol, by `nsh test --target web` and
      # by `crates/server/tests/browser.rs`. `web-browser` runs it, so no path names its
      # revision.
      webBrowserFor =
        pkgs:
        pkgs.writeShellScriptBin "web-browser" ''
          for chrome in ${pkgs.playwright-driver.browsers}/chromium-*/chrome-linux*/chrome; do
            exec "$chrome" "$@"
          done
          echo "web-browser: no Chromium in ${pkgs.playwright-driver.browsers}" >&2
          exit 1
        '';

      # The AppImage's runtime, the program at the head of every AppImage that mounts the image
      # appended to it: a static build, which needs no FUSE library on the machine. `just package`
      # writes the AppImage as this runtime followed by the app's squashfs image, as appimagetool
      # does, which nixpkgs does not have.
      appimageRuntimeFor =
        pkgs:
        pkgs.fetchurl {
          url = "https://github.com/AppImage/type2-runtime/releases/download/20251108/runtime-x86_64";
          hash = "sha256-L8qLRDySUQ8Ug6iD9gBhrQm0a5eLJjHIB82HOkfsJg0=";
        };

      # What NSH's GTK backend builds against and runs on: GTK 4, which must be 4.14 or newer,
      # WebKitGTK 6.0 for web views, and, since NSH 0.5.0, GStreamer for its sounds, which the
      # backend links whether or not an app plays one.
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
          gst_all_1.gstreamer
          gst_all_1.gst-plugins-base
        ];

      # `hidden-display <command>` runs a command on an X display of its own that no screen shows:
      # every run of the app by an agent or a check goes through it, so no window opens on the
      # human's display. GTK prefers the session's Wayland display, so the command loses it. It
      # also gets a session bus of its own: what the app sends there, a notification first,
      # reaches no desktop. Xvfb picks its own free display number (`-d`), so several runs start
      # at once, as the checks of `crates/app/tests/outside.rs` do. What runs there is never a
      # person's use of the app, so it runs through `scripts/isolated.sh`: data, configuration,
      # cache, and state folders of its own, and a check that it wrote nothing in the person's.
      #
      # Xvfb draws in software. `hidden-display --gpu <command>` draws on the machine's GPU instead,
      # still on no screen: a headless Weston with its GL renderer, 1400 by 800 at 120 Hz, which
      # the command reaches as a Wayland display with no X display beside it, so a failure never
      # falls back to the person's. It needs the machine's GL driver where Nix's programs find it,
      # `/run/opengl-driver`, and a render node, `/dev/dri/renderD*`; without them Weston does not
      # start, and the run fails, naming its log.
      hiddenDisplayFor =
        pkgs:
        pkgs.writeShellScriptBin "hidden-display" ''
          if [ "''${1:-}" = "--gpu" ]; then
            shift
            exec ${pkgs.bash}/bin/bash ${./scripts/isolated.sh} env -u DISPLAY GDK_BACKEND=wayland \
              ${pkgs.dbus}/bin/dbus-run-session --dbus-daemon=${pkgs.dbus}/bin/dbus-daemon --config-file=${hiddenBusFor pkgs} -- \
              ${pkgs.bash}/bin/bash ${./scripts/gpu-display.sh} ${pkgs.weston}/bin/weston "$@"
          fi
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
              # The formatter and linter of what Cargo does not read: TSX, Markdown, JSON, TOML.
              oxfmt
              oxlint
              # The release: cargo-dist, at the version `dist-workspace.toml` pins, and the
              # workflows' linter.
              cargo-dist
              actionlint
            ]
            # The app, on Native Shell: GTK's build tools, clang for QuickJS' bindings, and the
            # display no screen shows.
            ++ lib.optionals stdenv.hostPlatform.isLinux [
              pkg-config
              clang
              # `flock`, with which `scripts/isolated.sh` shares the machine's heavy slots, and
              # `ps`, with which the server's tests find the processes a server left.
              util-linux
              procps
              (hiddenDisplayFor pkgs)
              # Real key presses and clicks on the hidden display, for the checks of
              # `crates/app/tests/outside.rs`.
              xdotool
              # `just package`: the binaries made to run outside Nix, the icons rendered from
              # their vector source, the desktop entry checked, and the AppImage's image.
              # The web build: its browser, for its tests and its pictures, and brotli, which
              # compresses the page and the fonts Native Shell leaves as they are.
              (webBrowserFor pkgs)
              brotli
              patchelf
              resvg
              desktop-file-utils
              squashfsTools
            ]
            # On a Mac, `flock` for `scripts/isolated.sh`'s heavy slots: util-linux's is Linux's.
            ++ lib.optionals stdenv.hostPlatform.isDarwin [ flock ]
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
            # A worktree, whose `.git` is a file, without a build yet starts from the closest
            # checkout's: see `scripts/worktree-seed.sh`.
            root=$(git rev-parse --show-toplevel 2>/dev/null)
            if [ -f "$root/.git" ] && [ ! -e "$root/target" ]; then
              "$root/scripts/worktree-seed.sh" "$root" || true
            fi
            unset root
          '';
          # The AppImage's runtime, for `just package`.
          URAEDA_APPIMAGE_RUNTIME = pkgs.lib.optionalString (
            pkgs.stdenv.hostPlatform.system == "x86_64-linux"
          ) "${appimageRuntimeFor pkgs}";
          # The web build's C code, zstd's: a clang and an archiver that write WebAssembly objects.
          CC_wasm32_unknown_unknown = "${wasmClangFor pkgs}";
          AR_wasm32_unknown_unknown = "${pkgs.llvmPackages.llvm}/bin/llvm-ar";
          # QuickJS' bindings are generated with libclang.
          LIBCLANG_PATH = "${pkgs.llvmPackages.libclang.lib}/lib";
          # `nsh check` runs this TypeScript, the version NSH pins, and downloads none.
          NSH_TSC = "${pkgs.typescript}/bin/tsc";
          # WebKit needs an EGL driver, which machines without a GPU stack, like CI's, lack.
          __EGL_VENDOR_LIBRARY_DIRS = "${pkgs.mesa}/share/glvnd/egl_vendor.d";
          # The fonts of the web build's browser and of what GTK draws outside the app's own, the
          # same on every machine: text in a picture does not depend on the fonts a machine has
          # installed.
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
