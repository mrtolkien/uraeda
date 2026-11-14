//! `ura sandbox`: `ura serve` over sample projects, for Uraeda's own development. Every page is
//! tried on it.
//!
//! - **Its folder** holds everything it reads and writes: `projects/` (`sample`, `empty`,
//!   `broken`, `realistic`, `bare`, and `sample`'s `origin`), `config/` (the settings naming the
//!   projects), `data/` (the token, and the vault `Uraeda`), and `bin/` (a `gh` that lists the
//!   sample's pull requests). It is kept until a reset builds it again. Nothing reads or writes
//!   the human's own folders.
//! - **Its builders read the checkout it was built from**: its `fixtures/` and the skill's
//!   templates, at run time. A build of `ura` outside a checkout has no sandbox to give.

mod git;
mod origin;
mod others;
mod sample;
mod texts;

use std::fs;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

/// The port the sandbox asks for, away from `ura serve`'s.
pub const PORT: u16 = 4420;

/// The sample projects' last day, which the sandbox makes today with `URA_TODAY`: the core reads
/// it from the process's environment.
pub const TODAY: &str = "2026-10-21";

/// What changes the sample projects: a sandbox built by other builders is stale.
const BUILDERS: &str = "5";

/// The sample projects, each in a folder of its name.
const PROJECTS: [&str; 5] = ["sample", "empty", "broken", "realistic", "bare"];

/// The sandbox's flags.
#[derive(clap::Args)]
pub struct Args {
    /// Build the sample projects again, from the checkout's fixtures
    #[arg(long)]
    reset: bool,
    /// The port on 127.0.0.1, 4420 by default; 0 takes a free one
    #[arg(long)]
    port: Option<u16>,
    /// The sandbox's folder, `.sandbox/` of the checkout by default
    #[arg(long, value_hint = clap::ValueHint::DirPath)]
    folder: Option<PathBuf>,
}

/// Prepares the sandbox, then runs `ura serve` over it until it is stopped. It prints the pages'
/// address first, as `ura serve` does, then the sandbox's folder.
pub fn run(args: Args) -> Result<ExitCode, String> {
    let cwd = std::env::current_dir().map_err(|error| error.to_string())?;
    let folder = args
        .folder
        .map_or_else(default_folder, |folder| cwd.join(folder));
    let stale = prepare(&folder, args.reset)?;
    if stale {
        eprintln!(
            "ura: the sample projects were built by older code: run with --reset to rebuild them"
        );
    }
    let bin = folder.join("bin");
    let path = std::env::var_os("PATH").unwrap_or_default();
    let path = std::env::join_paths(std::iter::once(bin).chain(std::env::split_paths(&path)))
        .map_err(|error| error.to_string())?;
    // The core reads today from the process: the sample projects' last day, so their dates read
    // as they were written. Their `gh` comes first on the `PATH`. No thread runs yet.
    // SAFETY: set before `ura serve` starts any thread.
    unsafe {
        std::env::set_var("URA_TODAY", TODAY);
        std::env::set_var("PATH", path);
    }
    eprintln!("ura: the sandbox's folder is {}", folder.display());
    let options = uraeda_serve::Options {
        port: Some(args.port.unwrap_or(PORT)),
        config_dir: folder.join("config"),
        data_dir: folder.join("data"),
        cwd: folder.join("projects/sample"),
    };
    uraeda_serve::run(options).map_err(|error| error.to_string())?;
    Ok(ExitCode::SUCCESS)
}

/// The checkout this build of `ura` comes from, whose fixtures the builders read.
fn checkout() -> PathBuf {
    let manifest = Path::new(env!("CARGO_MANIFEST_DIR"));
    manifest.ancestors().nth(2).unwrap_or(manifest).to_owned()
}

/// The sandbox's folder in the checkout: `.sandbox/`, ignored by git.
fn default_folder() -> PathBuf {
    checkout().join(".sandbox")
}

/// A path of the checkout's `fixtures/`.
fn fixture(path: &str) -> PathBuf {
    checkout().join("fixtures").join(path)
}

/// A fixture's text.
fn fixture_text(path: &str) -> Result<String, String> {
    let file = fixture(path);
    fs::read_to_string(&file).map_err(|error| format!("{}: {error}", file.display()))
}

/// The sandbox in a folder, built when it is missing, unfinished, or a reset asks for it, and
/// kept as it is otherwise. Says whether older builders built it.
///
/// # Errors
///
/// What stopped a build: a folder that cannot be written, a fixture missing outside a checkout,
/// or git failing. A build that fails leaves no stamp, so the next one starts again.
fn prepare(folder: &Path, reset: bool) -> Result<bool, String> {
    if !fixture("repo").is_dir() {
        let checkout = checkout();
        return Err(format!(
            "the sandbox is built from a checkout of Uraeda, and {} is none: run `just sandbox` there",
            checkout.display()
        ));
    }
    let stamp = folder.join("stamp");
    let built = fs::read_to_string(&stamp).ok();
    if reset || built.is_none() {
        build(folder)?;
        fs::write(&stamp, BUILDERS).map_err(|error| error.to_string())?;
    }
    Ok(built.is_some_and(|built| built != BUILDERS) && !reset)
}

/// What builds a sample project in its folder.
type Builder<'a> = &'a (dyn Fn(&Path) -> Result<(), String> + Sync);

/// Builds the sandbox in a folder, replacing what is there.
fn build(folder: &Path) -> Result<(), String> {
    if folder.exists() {
        fs::remove_dir_all(folder).map_err(|error| format!("{}: {error}", folder.display()))?;
    }
    let projects = folder.join("projects");
    // Each project in a thread of its own: they share nothing.
    let builders: [(&str, Builder); 5] = [
        ("sample", &sample::build),
        ("empty", &|path| others::empty(path).map(drop)),
        ("broken", &others::broken),
        ("realistic", &others::realistic),
        ("bare", &others::bare),
    ];
    std::thread::scope(|scope| {
        let built: Vec<_> = builders
            .iter()
            .map(|(name, builder)| {
                let path = projects.join(name);
                scope.spawn(move || builder(&path))
            })
            .collect();
        let results = built.into_iter().map(|thread| {
            thread
                .join()
                .unwrap_or_else(|_| Err("a builder panicked".to_owned()))
        });
        results.collect::<Result<Vec<()>, String>>()
    })?;
    for name in ["sample", "realistic"] {
        worktrees(&git::Repo {
            path: projects.join(name),
        })?;
    }
    config(&folder.join("config"), &projects)?;
    gh(&folder.join("bin"))
}

/// A worktree for each branch not checked out yet: `ura serve` reads features in worktrees, as a
/// session host makes them.
fn worktrees(repo: &git::Repo) -> Result<(), String> {
    let listed = repo.git(&["worktree", "list", "--porcelain"])?;
    let out: Vec<&str> = listed
        .lines()
        .filter_map(|line| line.strip_prefix("branch refs/heads/"))
        .collect();
    let branches = repo.git(&["for-each-ref", "--format=%(refname:short)", "refs/heads"])?;
    for branch in branches.lines() {
        if !out.contains(&branch) {
            repo.worktree(branch)?;
        }
    }
    Ok(())
}

/// The settings: `ura serve` over the sample projects.
fn config(config_dir: &Path, projects: &Path) -> Result<(), String> {
    let listed: Vec<String> = PROJECTS
        .iter()
        .map(|name| format!("{:?}", projects.join(name).to_string_lossy()))
        .collect();
    let text = format!("[serve]\nrepositories = [{}]\n", listed.join(", "));
    fs::create_dir_all(config_dir).map_err(|error| error.to_string())?;
    fs::write(config_dir.join("config.toml"), text).map_err(|error| error.to_string())
}

/// A `gh` that lists the sample's open pull requests, first on `ura serve`'s `PATH`.
fn gh(bin: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt as _;
    let rows: Vec<serde_json::Value> = sample::PULL_REQUESTS
        .iter()
        .map(|(branch, number, draft, changes)| {
            serde_json::json!({
                "headRefName": branch,
                "headRefOid": "0".repeat(40),
                "isDraft": draft,
                "number": number,
                "reviewDecision": if *changes { "CHANGES_REQUESTED" } else { "" },
                "url": format!("https://github.com/mrtolkien/uraeda/pull/{number}"),
            })
        })
        .collect();
    let listed = serde_json::Value::Array(rows).to_string();
    fs::create_dir_all(bin).map_err(|error| error.to_string())?;
    let file = bin.join("gh");
    fs::write(&file, format!("#!/bin/sh\ncat <<'EOF'\n{listed}\nEOF\n"))
        .and_then(|()| fs::set_permissions(&file, fs::Permissions::from_mode(0o755)))
        .map_err(|error| format!("{}: {error}", file.display()))
}
