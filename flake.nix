{
  description = "Uraeda: the ura CLI, and the development shell with Node, pnpm, and the pinned Rust toolchain";

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
    in
    {
      formatter = forAllSystems (pkgs: pkgs.nixfmt-tree);

      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_24
            # pnpm downloads the exact version pinned in package.json's devEngines.
            pnpm
            (rust-bin.fromRustupToolchainFile ./rust-toolchain.toml)
            # The Rust tests' runner, and their coverage.
            cargo-nextest
            cargo-llvm-cov
            # The Neovim plugin's formatter, and the Neovim its tests run in.
            neovim
            stylua
          ];
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
          # mini.test, which the Neovim plugin's tests run on, pinned by the flake's lock.
          MINI_TEST = "${pkgs.vimPlugins.mini-test}";
          # The browsers of the web UI's layout tests: the playwright package pins the same version
          # as nixpkgs' driver, so its browsers run here without a download.
          PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright-driver.browsers}";
          PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "true";
          PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
          # WebKit needs an EGL driver, which machines without a GPU stack, like CI's, lack.
          __EGL_VENDOR_LIBRARY_DIRS = "${pkgs.mesa}/share/glvnd/egl_vendor.d";
          # The browsers' fonts, the same on every machine: text measured in the layout tests does not
          # depend on the fonts a machine has installed.
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
