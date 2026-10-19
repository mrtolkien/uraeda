//! `ura upgrade`: the latest release, with the installer `ura` came from.

use std::os::unix::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Command, ExitCode};

const RELEASES: &str = "https://github.com/mrtolkien/uraeda/releases";
const FORMULA: &str = "mrtolkien/tap/ura";

/// Downloads the installer to a file, so a failed download fails the upgrade, runs it, then
/// updates the user's skill with the new binary, at `$2`. `set -e` stops at the first failure.
const INSTALL: &str = r#"set -e
installer=$(mktemp)
trap 'rm -f "$installer"' EXIT
curl --proto '=https' --tlsv1.2 -LsSf "$1" -o "$installer"
sh "$installer"
"$2" install --user --update --no-input"#;

/// Upgrades the formula `$1`, then updates the user's skill with the new binary.
const BREW: &str = r#"set -e
brew upgrade "$1"
"$(brew --prefix "$1")/bin/ura" install --user --update --no-input"#;

#[derive(Debug, PartialEq)]
enum Install {
    Script,
    Homebrew,
    Nix,
    Other,
}

pub fn run() -> Result<ExitCode, String> {
    let exe = std::env::current_exe()
        .and_then(std::fs::canonicalize)
        .map_err(|error| format!("could not find ura's executable: {error}"))?;
    let install = install(&exe, cargo_home().as_deref());
    match install {
        Install::Nix => return Err("ura comes from Nix: update its flake input instead".into()),
        Install::Other => {
            return Err(format!(
                "{} was not installed by the installer script or Homebrew: reinstall it as the \
                 README says",
                exe.display()
            ));
        }
        Install::Script | Install::Homebrew => {}
    }
    let current = env!("CARGO_PKG_VERSION");
    let (tag, latest) = latest()?;
    if !newer(current, &latest) {
        println!("ura {current} is the latest release");
        return Ok(ExitCode::SUCCESS);
    }
    println!("upgrading ura {current} to {latest}");
    // Replaces this process, so the installer can overwrite a running executable.
    let error = installer(&install, &tag, &exe).exec();
    Err(format!("could not run the installer: {error}"))
}

/// Whether the latest release differs from the running version.
fn newer(current: &str, latest: &str) -> bool {
    latest != current
}

/// The shell that installs the release `tag`, then updates the user's skill, for `ura` at `exe`.
fn installer(install: &Install, tag: &str, exe: &Path) -> Command {
    let mut command = Command::new("sh");
    match install {
        Install::Homebrew => command.args(["-c", BREW, "sh", FORMULA]),
        _ => command
            .args(["-c", INSTALL, "sh"])
            .arg(format!("{RELEASES}/download/{tag}/uraeda-cli-installer.sh"))
            .arg(exe),
    };
    command
}

/// Where the installer script puts binaries: `$CARGO_HOME`, or `~/.cargo`.
fn cargo_home() -> Option<PathBuf> {
    std::env::var_os("CARGO_HOME")
        .filter(|home| !home.is_empty())
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|home| Path::new(&home).join(".cargo")))
        .map(|home| std::fs::canonicalize(&home).unwrap_or(home))
}

/// How the executable at a canonical path was installed.
fn install(exe: &Path, cargo_home: Option<&Path>) -> Install {
    if exe.starts_with("/nix/store") {
        Install::Nix
    } else if exe.components().any(|part| part.as_os_str() == "Cellar") {
        Install::Homebrew
    } else if cargo_home.is_some_and(|home| exe.parent() == Some(&home.join("bin"))) {
        Install::Script
    } else {
        Install::Other
    }
}

/// The latest release's tag and version, from where GitHub redirects `releases/latest`.
fn latest() -> Result<(String, String), String> {
    let output = Command::new("curl")
        .args(["--proto", "=https", "--tlsv1.2", "-fsSL", "-o", "/dev/null"])
        .args(["-w", "%{url_effective}"])
        .arg(format!("{RELEASES}/latest"))
        .output()
        .map_err(|error| format!("could not run curl: {error}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "could not find the latest release: {}",
            stderr.trim()
        ));
    }
    let url = String::from_utf8_lossy(&output.stdout);
    tag_version(&url).ok_or_else(|| format!("could not find the latest release: no tag in {url}"))
}

/// A release URL's tag, `v1.2.3` or `uraeda-cli-v1.2.3`, and its version.
fn tag_version(url: &str) -> Option<(String, String)> {
    let (_, tag) = url.trim().rsplit_once("/tag/")?;
    let version = tag
        .strip_prefix("uraeda-cli-")
        .unwrap_or(tag)
        .strip_prefix('v')?;
    (!version.is_empty()).then(|| (tag.to_string(), version.to_string()))
}
