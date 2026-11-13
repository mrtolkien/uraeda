//! The repository's own tools, run through the `justfile`.
//!
//! `just release <version> [--name <name>] [--dry-run]` starts a release from an up-to-date
//! `main`. It asks for the release's name, unless `--name` gives it, writes the version's
//! section of `CHANGELOG.md` from the records added to `specs/done/` since the last tag, sets
//! the Cargo workspace's version, then, once confirmed, commits, tags `v<version>`, and pushes
//! both.
//!
//! The tag does the rest: `release.yml` releases `ura` and the Linux app, with the section's
//! heading, `<version> - <name>`, as the GitHub release's title and its body as the notes.
//!
//! `--dry-run` prints the notes and changes nothing.

mod notes;

use std::fs;
use std::io::{BufRead, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, ExitCode, Stdio};

use notes::{REPOSITORY, Record};

/// The checkout.
fn root() -> PathBuf {
    let manifest = Path::new(env!("CARGO_MANIFEST_DIR"));
    manifest.ancestors().nth(2).unwrap_or(manifest).to_owned()
}

fn main() -> ExitCode {
    let mut args = std::env::args().skip(1);
    let done = match args.next().as_deref() {
        Some("release") => release(args),
        _ => Err("usage: just release <version> [--name <name>] [--dry-run]".to_owned()),
    };
    match done {
        Ok(()) => ExitCode::SUCCESS,
        Err(problem) => {
            eprintln!("release: {problem}");
            ExitCode::FAILURE
        }
    }
}

/// What `release` was asked.
struct Asked {
    version: String,
    name: Option<String>,
    dry_run: bool,
}

fn asked(mut args: impl Iterator<Item = String>) -> Result<Asked, String> {
    let usage = "usage: just release <version> [--name <name>] [--dry-run]";
    let (mut version, mut name, mut dry_run) = (None, None, false);
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--dry-run" => dry_run = true,
            "--name" => name = Some(args.next().ok_or(usage)?),
            given if !given.starts_with('-') && version.is_none() => {
                version = Some(notes::version_of(given)?);
            }
            _ => return Err(usage.to_owned()),
        }
    }
    let version = version.ok_or(usage)?;
    Ok(Asked {
        version,
        name,
        dry_run,
    })
}

/// Runs git in the checkout, and gives what it printed.
fn git(args: &[&str]) -> Result<String, String> {
    let ran = Command::new("git").args(args).current_dir(root()).output();
    let ran = ran.map_err(|error| format!("git: {error}"))?;
    if !ran.status.success() {
        let said = String::from_utf8_lossy(&ran.stderr);
        return Err(format!("git {}: {}", args.join(" "), said.trim()));
    }
    Ok(String::from_utf8_lossy(&ran.stdout).trim().to_owned())
}

/// Refuses anything but a clean `main` at `origin/main`, with the tag still free.
fn check_checkout(tag: &str) -> Result<(), String> {
    if git(&["branch", "--show-current"])? != "main" {
        return Err("release from main".to_owned());
    }
    if !git(&["status", "--porcelain"])?.is_empty() {
        return Err("the checkout has uncommitted changes".to_owned());
    }
    git(&["fetch", "--quiet", "--tags", "origin", "main"])?;
    if git(&["rev-parse", "HEAD"])? != git(&["rev-parse", "origin/main"])? {
        return Err("main is not origin/main: pull or push first".to_owned());
    }
    if !git(&["tag", "--list", tag])?.is_empty() {
        return Err(format!("the tag {tag} already exists"));
    }
    Ok(())
}

/// The records added to `specs/done/` since the last version tag, or ever without one.
fn new_records() -> Result<Vec<Record>, String> {
    let tags = git(&["tag", "--list", "v*", "--sort=-v:refname"])?;
    let added = match tags.lines().next() {
        Some(last) => {
            let range = format!("{last}..HEAD");
            let records = ["--", "specs/done/*.md"];
            let diff = ["diff", "--name-only", "--diff-filter=A", &range];
            git(&[diff.as_slice(), records.as_slice()].concat())?
        }
        None => git(&["ls-files", "specs/done/*.md"])?,
    };
    let mut paths: Vec<&str> = added.lines().filter(|path| !path.is_empty()).collect();
    paths.sort_unstable();
    let read = |path: &&str| {
        let text = fs::read_to_string(root().join(path));
        let text = text.map_err(|error| format!("{path}: {error}"))?;
        Ok(notes::record(path, &text))
    };
    paths.iter().map(read).collect()
}

/// Asks a question on the terminal, and gives the answer.
fn ask(question: &str) -> Result<String, String> {
    print!("{question}");
    std::io::stdout()
        .flush()
        .map_err(|error| error.to_string())?;
    let mut answer = String::new();
    let read = std::io::stdin().lock().read_line(&mut answer);
    read.map_err(|error| error.to_string())?;
    Ok(answer.trim().to_owned())
}

/// Today's date, in UTC: `2026-11-12`.
fn today() -> Result<String, String> {
    let ran = Command::new("date").args(["-u", "+%F"]).output();
    let ran = ran.map_err(|error| format!("date: {error}"))?;
    Ok(String::from_utf8_lossy(&ran.stdout).trim().to_owned())
}

fn release(args: impl Iterator<Item = String>) -> Result<(), String> {
    let asked = asked(args)?;
    let (version, tag) = (&asked.version, format!("v{}", asked.version));
    let cargo = root().join("Cargo.toml");
    let manifest = fs::read_to_string(&cargo).map_err(|error| error.to_string())?;
    let current = notes::cargo_version(&manifest)?;
    if !notes::is_after(version, &current) {
        return Err(format!(
            "{version} does not come after the current version {current}"
        ));
    }
    let name = match asked.name {
        Some(name) => name.trim().to_owned(),
        None => ask("Release name, such as \"Vim mode + git page\": ")?,
    };
    if name.is_empty() {
        return Err("a release needs a name".to_owned());
    }
    let section = notes::notes(version, &name, &today()?, &new_records()?);
    println!("{section}");
    if asked.dry_run {
        return Ok(());
    }
    check_checkout(&tag)?;

    let changelog = root().join("CHANGELOG.md");
    let before = fs::read_to_string(&changelog).unwrap_or_default();
    let write =
        |file: &Path, text: String| fs::write(file, text).map_err(|error| error.to_string());
    write(&changelog, notes::add_section(&before, &section))?;
    write(&cargo, notes::set_cargo_version(&manifest, version)?)?;
    // Updates the workspace's own versions in Cargo.lock, without building.
    let mut metadata = Command::new("cargo");
    let metadata = metadata.args(["metadata", "--format-version", "1", "--offline"]);
    let locked = metadata.current_dir(root()).stdout(Stdio::null()).status();
    if !locked.is_ok_and(|status| status.success()) {
        return Err("cargo could not update Cargo.lock".to_owned());
    }
    println!("{}\n", git(&["status", "--short"])?);

    let question = format!("Commit, tag {tag}, and push both to origin? [y/N] ");
    let answer = ask(&question)?.to_lowercase();
    if answer != "y" && answer != "yes" {
        git(&["checkout", "--", "Cargo.toml", "Cargo.lock"])?;
        if git(&["status", "--porcelain", "CHANGELOG.md"])?.starts_with("??") {
            git(&["clean", "--force", "--quiet", "--", "CHANGELOG.md"])?;
        } else {
            git(&["checkout", "--", "CHANGELOG.md"])?;
        }
        println!("Stopped: nothing changed.");
        return Ok(());
    }
    git(&["add", "CHANGELOG.md", "Cargo.toml", "Cargo.lock"])?;
    let message = format!("chore: release {tag}");
    git(&["commit", "--quiet", "-m", &message])?;
    git(&["tag", &tag])?;
    git(&["push", "--atomic", "origin", "main", &tag])?;
    println!("Pushed {tag}: {REPOSITORY}/actions builds the release of ura and the Linux app.");
    Ok(())
}
