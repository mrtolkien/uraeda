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
            # The Neovim plugin's formatter, and the Neovim its tests run in.
            neovim
            stylua
          ];
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
            meta.mainProgram = "ura";
          };
        }
      );
    };
}
