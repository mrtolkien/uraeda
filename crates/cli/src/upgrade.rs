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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_the_install() {
        let home = Some(Path::new("/home/me/.cargo"));
        let install = |exe: &str| install(Path::new(exe), home);
        assert_eq!(install("/home/me/.cargo/bin/ura"), Install::Script);
        assert_eq!(
            install("/opt/homebrew/Cellar/ura/0.1.0/bin/ura"),
            Install::Homebrew
        );
        assert_eq!(
            install("/home/linuxbrew/.linuxbrew/Cellar/ura/0.1.0/bin/ura"),
            Install::Homebrew
        );
        assert_eq!(
            install("/nix/store/abc-uraeda-cli-0.1.0/bin/ura"),
            Install::Nix
        );
        assert_eq!(install("/home/me/uraeda/target/debug/ura"), Install::Other);
        assert_eq!(install("/home/me/.cargo/bin/sub/ura"), Install::Other);
    }

    fn parts(command: &Command) -> (String, Vec<String>) {
        let program = command.get_program().to_string_lossy().into_owned();
        let args = command
            .get_args()
            .map(|arg| arg.to_string_lossy().into_owned())
            .collect();
        (program, args)
    }

    #[test]
    fn the_script_updates_the_skill_after_the_installer() {
        let command = installer(
            &Install::Script,
            "v0.2.0",
            Path::new("/home/me/.cargo/bin/ura"),
        );
        let (program, args) = parts(&command);
        assert_eq!(program, "sh");
        assert_eq!(
            args,
            [
                "-c".to_string(),
                INSTALL.to_string(),
                "sh".to_string(),
                format!("{RELEASES}/download/v0.2.0/uraeda-cli-installer.sh"),
                "/home/me/.cargo/bin/ura".to_string(),
            ]
        );
        assert!(INSTALL.starts_with("set -e\n"));
        assert_eq!(
            INSTALL.lines().last(),
            Some(r#""$2" install --user --update --no-input"#)
        );
    }

    #[test]
    fn homebrew_updates_the_skill_after_brew() {
        let command = installer(
            &Install::Homebrew,
            "v0.2.0",
            Path::new("/opt/homebrew/Cellar/ura/0.1.0/bin/ura"),
        );
        let (program, args) = parts(&command);
        assert_eq!(program, "sh");
        assert_eq!(args, ["-c", BREW, "sh", "mrtolkien/tap/ura"]);
        assert_eq!(
            BREW.lines().collect::<Vec<_>>(),
            [
                "set -e",
                r#"brew upgrade "$1""#,
                r#""$(brew --prefix "$1")/bin/ura" install --user --update --no-input"#,
            ]
        );
    }

    #[test]
    fn the_latest_release_installs_nothing() {
        assert!(!newer("0.2.0", "0.2.0"));
        assert!(newer("0.1.0", "0.2.0"));
    }

    #[test]
    fn reads_the_tag() {
        let version = |url: &str| tag_version(url).map(|(_, version)| version);
        assert_eq!(
            version(&format!("{RELEASES}/tag/v0.2.0\n")),
            Some("0.2.0".into())
        );
        assert_eq!(
            version(&format!("{RELEASES}/tag/uraeda-cli-v0.2.0-rc.1")),
            Some("0.2.0-rc.1".into())
        );
        assert_eq!(version(&format!("{RELEASES}/latest")), None);
        assert_eq!(version(&format!("{RELEASES}/tag/v")), None);
    }
}
