mod common;

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use common::*;
use tempfile::TempDir;

/// A config folder and a data folder of their own, for `ura extension` to read and write.
struct Folders {
    config: TempDir,
    data: TempDir,
}

impl Folders {
    fn new() -> Folders {
        Folders {
            config: TempDir::new().unwrap(),
            data: TempDir::new().unwrap(),
        }
    }

    /// Runs `ura extension <args>` in `dir`.
    fn ura(&self, dir: &Path, args: &[&str]) -> Output {
        self.ura_with(dir, args, &[])
    }

    /// Runs `ura extension <args>` in `dir`, with more environment variables.
    fn ura_with(&self, dir: &Path, args: &[&str], env: &[(&str, &str)]) -> Output {
        let mut all = vec!["extension"];
        all.extend_from_slice(args);
        let mut env = env.to_vec();
        env.push(("URAEDA_CONFIG_DIR", self.config.path().to_str().unwrap()));
        env.push(("URAEDA_DATA_DIR", self.data.path().to_str().unwrap()));
        ura_in(dir, &all, &env)
    }

    /// The extension `name`'s folder.
    fn extension(&self, name: &str) -> PathBuf {
        self.config.path().join("extensions").join(name)
    }

    /// The settings file, after the comment a new one starts with.
    fn settings(&self) -> String {
        let text = fs::read_to_string(self.config.path().join("config.toml")).unwrap();
        let (_, tables) = text.split_once("\n\n").unwrap();
        tables.to_string()
    }
}

/// A manifest named `name`, titled `title`.
fn manifest(name: &str, title: &str) -> String {
    format!("name = \"{name}\"\ntitle = \"{title}\"\napi = 1\n")
}

/// A git repository holding the extension `name`, and its URL.
fn upstream(name: &str, title: &str) -> (TestRepo, String) {
    let repo = TestRepo::named(&format!("uraeda-{name}"));
    repo.write("extension.toml", &manifest(name, title));
    repo.commit("feat: the extension");
    let url = format!("file://{}", repo.path().display());
    (repo, url)
}

/// Runs `git` in `dir`, and returns its trimmed stdout, or `None` when it fails.
fn git(dir: &Path, args: &[&str]) -> Option<String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(dir)
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .output()
        .unwrap();
    output
        .status
        .success()
        .then(|| String::from_utf8(output.stdout).unwrap().trim().to_string())
}

fn head(dir: &Path) -> String {
    git(dir, &["rev-parse", "HEAD"]).unwrap()
}

#[test]
fn add_clones_pins_and_turns_on() {
    let folders = Folders::new();
    let elsewhere = TempDir::new().unwrap();
    let (repo, url) = upstream("deploy", "Deploy");
    let commit = head(repo.path());

    let output = folders.ura(elsewhere.path(), &["add", &url, "--all"]);

    assert_eq!(output.stderr, "");
    assert_eq!(output.stdout, "Turned Deploy on for: every repository\n");
    assert_eq!(output.code, 0);
    let folder = folders.extension("deploy");
    assert_eq!(head(&folder), commit);
    // Pinned: no branch checked out, which a later pull would move.
    assert_eq!(git(&folder, &["symbolic-ref", "--quiet", "HEAD"]), None);
    assert_eq!(
        fs::read_to_string(folder.join(".ura-source")).unwrap(),
        format!("url = \"{url}\"\ncommit = \"{commit}\"\nref = \"main\"\n")
    );
    assert_eq!(folders.settings(), "[extensions.deploy]\non = \"all\"\n");
    // Nothing is left of the clone's temporary folder.
    let names: Vec<String> = fs::read_dir(folders.config.path().join("extensions"))
        .unwrap()
        .map(|entry| entry.unwrap().file_name().into_string().unwrap())
        .collect();
    assert_eq!(names, ["deploy"]);

    let list = folders.ura(elsewhere.path(), &["list", "--json"]);
    let json: serde_json::Value = serde_json::from_str(&list.stdout).unwrap();
    assert_eq!(json["version"], 1);
    let deploy = json["extensions"]
        .as_array()
        .unwrap()
        .iter()
        .find(|extension| extension["name"] == "deploy")
        .unwrap();
    assert_eq!(
        (
            &deploy["title"],
            &deploy["on_all"],
            &deploy["source"]["commit"]
        ),
        (
            &serde_json::json!("Deploy"),
            &serde_json::json!(true),
            &serde_json::json!(commit)
        )
    );
    let text = folders.ura(elsewhere.path(), &["list"]);
    assert_eq!(
        text.row("deploy"),
        [
            "deploy",
            "Deploy",
            "every repository",
            &format!("{url} at {}", &commit[..7])
        ]
    );

    let again = folders.ura(elsewhere.path(), &["add", &url, "--all"]);
    assert_eq!(
        again.stderr,
        "ura: deploy is already installed: run ura extension update deploy\n"
    );
    assert_eq!(again.code, 1);

    let (_inbox, inbox_url) = upstream("inbox", "My inbox");
    let built_in = folders.ura(elsewhere.path(), &["add", &inbox_url, "--all"]);
    assert_eq!(
        built_in.stderr,
        "ura: inbox is taken by a built-in extension\n"
    );
    assert_eq!(built_in.code, 1);
    assert!(!folders.extension("inbox").exists());

    let (_sessions, sessions_url) = upstream("sessions", "My sessions");
    let reserved = folders.ura(elsewhere.path(), &["add", &sessions_url, "--all"]);
    assert_eq!(reserved.stderr, "ura: sessions is reserved by Uraeda\n");
    assert_eq!(reserved.code, 1);
    assert!(!folders.extension("sessions").exists());
}

#[test]
fn update_shows_the_diff_and_moves_only_with_yes() {
    let folders = Folders::new();
    let elsewhere = TempDir::new().unwrap();
    let (repo, url) = upstream("deploy", "Deploy");
    let old = head(repo.path());
    assert_eq!(
        folders.ura(elsewhere.path(), &["add", &url, "--all"]).code,
        0
    );
    repo.write("server.ts", "export default () => {};\n");
    repo.commit("feat: a server");
    repo.write("extension.toml", &manifest("deploy", "Deploys"));
    repo.commit("feat: a new title");
    let new = head(repo.path());
    let diff = git(repo.path(), &["diff", &format!("{old}..{new}")]).unwrap();
    let folder = folders.extension("deploy");

    let asked = folders.ura(elsewhere.path(), &["update", "deploy"]);

    assert_eq!(asked.stderr, "");
    assert_eq!(
        asked.stdout,
        format!(
            "Deploy: {} -> {}\n{diff}\nDeploy stays at {}: pass --yes to move it\n",
            &old[..7],
            &new[..7],
            &old[..7]
        )
    );
    assert_eq!(asked.code, 0);
    assert_eq!(head(&folder), old);

    let moved = folders.ura(elsewhere.path(), &["update", "deploy", "--yes"]);

    assert_eq!(
        moved.stdout,
        format!(
            "Deploy: {} -> {}\n{diff}\nMoved Deploy to {}\n",
            &old[..7],
            &new[..7],
            &new[..7]
        )
    );
    assert_eq!(moved.code, 0);
    assert_eq!(head(&folder), new);
    assert_eq!(git(&folder, &["symbolic-ref", "--quiet", "HEAD"]), None);
    assert_eq!(
        fs::read_to_string(folder.join(".ura-source")).unwrap(),
        format!("url = \"{url}\"\ncommit = \"{new}\"\nref = \"main\"\n")
    );

    let current = folders.ura(elsewhere.path(), &["update", "deploy"]);
    assert_eq!(
        current.stdout,
        format!("Deploys is up to date at {}\n", &new[..7])
    );
    assert_eq!(current.code, 0);
}

#[test]
fn remove_keeps_settings() {
    let folders = Folders::new();
    let elsewhere = TempDir::new().unwrap();
    let (_repo, url) = upstream("deploy", "Deploy");
    assert_eq!(
        folders.ura(elsewhere.path(), &["add", &url, "--all"]).code,
        0
    );
    let settings = folders.config.path().join("config.toml");

    let output = folders.ura(elsewhere.path(), &["remove", "deploy"]);

    assert_eq!(output.stderr, "");
    assert_eq!(
        output.stdout,
        format!(
            "Removed Deploy: its settings stay in {}\n",
            settings.display()
        )
    );
    assert_eq!(output.code, 0);
    assert!(!folders.extension("deploy").exists());
    assert_eq!(folders.settings(), "[extensions.deploy]\non = \"all\"\n");

    // A linked folder loses its link, never its files.
    let wiki = TempDir::new().unwrap();
    fs::write(wiki.path().join("extension.toml"), manifest("wiki", "Wiki")).unwrap();
    let wiki_path = wiki.path().to_str().unwrap();
    assert_eq!(
        folders
            .ura(elsewhere.path(), &["add", wiki_path, "--all"])
            .code,
        0
    );
    assert_eq!(folders.ura(elsewhere.path(), &["remove", "wiki"]).code, 0);
    assert!(!folders.extension("wiki").is_symlink());
    assert!(wiki.path().join("extension.toml").exists());

    let built_in = folders.ura(elsewhere.path(), &["remove", "inbox"]);
    assert_eq!(
        built_in.stderr,
        "ura: inbox is built in: turn it off in Settings, Extensions\n"
    );
    assert_eq!(built_in.code, 1);
}

#[test]
fn add_without_a_terminal_needs_where() {
    let folders = Folders::new();
    let repo = TestRepo::named("uraeda");
    let listed = ura_in(
        repo.path(),
        &["add"],
        &[("URAEDA_DATA_DIR", folders.data.path().to_str().unwrap())],
    );
    assert_eq!(listed.code, 0, "{}", listed.stderr);
    let wiki = TempDir::new().unwrap();
    fs::write(wiki.path().join("extension.toml"), manifest("wiki", "Wiki")).unwrap();
    let wiki_path = wiki.path().to_str().unwrap();

    let asked = folders.ura(repo.path(), &["add", wiki_path]);

    assert_eq!(
        asked.stderr,
        "ura: no terminal to ask: pass --all or --here\n"
    );
    assert_eq!(asked.code, 1);
    assert!(!folders.extension("wiki").is_symlink());

    let here = folders.ura(repo.path(), &["add", wiki_path, "--here"]);

    assert_eq!(here.stderr, "");
    assert_eq!(here.stdout, "Turned Wiki on for: uraeda\n");
    assert_eq!(here.code, 0);
    assert_eq!(
        fs::read_link(folders.extension("wiki")).unwrap(),
        fs::canonicalize(wiki.path()).unwrap()
    );
    assert_eq!(folders.settings(), "[extensions.wiki]\non = [\"uraeda\"]\n");

    let update = folders.ura(repo.path(), &["update", "wiki"]);
    assert_eq!(
        update.stderr,
        "ura: wiki is linked: update its folder yourself\n"
    );
    assert_eq!(update.code, 1);

    let elsewhere = TempDir::new().unwrap();
    let outside = folders.ura(elsewhere.path(), &["add", wiki_path, "--here"]);
    assert_eq!(
        outside.stderr,
        "ura: this folder is in no repository of Uraeda's list: run ura add, or pass --all or \
         --repo <name>\n"
    );
    assert_eq!(outside.code, 1);
}

#[test]
fn a_linked_folder_is_never_fetched_whatever_it_holds() {
    let folders = Folders::new();
    let elsewhere = TempDir::new().unwrap();
    let (_repo, url) = upstream("deploy", "Deploy");
    assert_eq!(
        folders.ura(elsewhere.path(), &["add", &url, "--all"]).code,
        0
    );
    // A clone moved out and linked back: its `.ura-source` is the owner's, not `ura`'s to move.
    let owned = TempDir::new().unwrap();
    let moved = owned.path().join("deploy");
    fs::rename(folders.extension("deploy"), &moved).unwrap();
    std::os::unix::fs::symlink(&moved, folders.extension("deploy")).unwrap();
    let commit = head(&moved);

    let update = folders.ura(elsewhere.path(), &["update", "deploy", "--yes"]);

    assert_eq!(
        update.stderr,
        "ura: deploy is linked: update its folder yourself\n"
    );
    assert_eq!(update.code, 1);
    assert_eq!(head(&moved), commit);
    let folder = fs::canonicalize(&moved).unwrap();
    let text = folders.ura(elsewhere.path(), &["list"]);
    let linked = format!("linked {}", folder.display());
    assert_eq!(text.row("deploy")[3], linked);
    let list = folders.ura(elsewhere.path(), &["list", "--json"]);
    let json: serde_json::Value = serde_json::from_str(&list.stdout).unwrap();
    let deploy = &json["extensions"].as_array().unwrap().last().unwrap();
    assert_eq!(
        (&deploy["is_linked"], &deploy["source"]),
        (&serde_json::json!(true), &serde_json::Value::Null)
    );
}

#[test]
fn update_shows_control_characters_of_the_diff_escaped() {
    let folders = Folders::new();
    let elsewhere = TempDir::new().unwrap();
    let (repo, url) = upstream("deploy", "Deploy");
    assert_eq!(
        folders.ura(elsewhere.path(), &["add", &url, "--all"]).code,
        0
    );
    repo.write(
        "server.ts",
        "// \u{1b}[2J\u{1b}]0;owned\u{7}\r\tdone\u{7f}\u{9b}\n",
    );
    repo.commit("feat: a server");

    let asked = folders.ura(elsewhere.path(), &["update", "deploy"]);

    assert!(
        asked
            .stdout
            .contains("+// ^[[2J^[]0;owned^G^M\tdone^?\\u{9b}\n"),
        "{}",
        asked.stdout
    );
    assert!(
        !asked
            .stdout
            .contains(['\u{1b}', '\u{7}', '\r', '\u{7f}', '\u{9b}'])
    );
}

#[test]
fn a_clone_runs_none_of_the_users_hooks() {
    let folders = Folders::new();
    let elsewhere = TempDir::new().unwrap();
    let (repo, url) = upstream("deploy", "Deploy");
    let hooks = TempDir::new().unwrap();
    let ran = hooks.path().join("ran");
    let hook = hooks.path().join("post-checkout");
    fs::write(
        &hook,
        format!("#!/bin/sh\necho ran >> '{}'\n", ran.display()),
    )
    .unwrap();
    fs::set_permissions(
        &hook,
        <fs::Permissions as std::os::unix::fs::PermissionsExt>::from_mode(0o755),
    )
    .unwrap();
    let config = hooks.path().join("gitconfig");
    fs::write(
        &config,
        format!("[core]\n\thooksPath = {}\n", hooks.path().display()),
    )
    .unwrap();
    let env = [("GIT_CONFIG_GLOBAL", config.to_str().unwrap())];

    let added = folders.ura_with(elsewhere.path(), &["add", &url, "--all"], &env);
    repo.write("server.ts", "export default () => {};\n");
    repo.commit("feat: a server");
    let moved = folders.ura_with(elsewhere.path(), &["update", "deploy", "--yes"], &env);

    assert_eq!(
        (added.code, moved.code),
        (0, 0),
        "{}{}",
        added.stderr,
        moved.stderr
    );
    assert!(!ran.exists(), "a hook ran");
}

#[test]
fn add_removes_what_an_earlier_add_left_and_undoes_off_when_it_fails() {
    let folders = Folders::new();
    let elsewhere = TempDir::new().unwrap();
    let extensions = folders.config.path().join("extensions");
    fs::create_dir_all(extensions.join(".adding-1/.git")).unwrap();
    // Too long a folder name for the move in place, after `on = []` is written.
    let long = "a".repeat(300);
    let repo = TestRepo::named("uraeda-long");
    repo.write("extension.toml", &manifest(&long, "Long"));
    repo.commit("feat: the extension");
    let url = format!("file://{}", repo.path().display());

    let failed = folders.ura(elsewhere.path(), &["add", &url, "--all"]);

    assert!(
        failed
            .stderr
            .starts_with(&format!("ura: cannot move {long} in place")),
        "{}",
        failed.stderr
    );
    assert_eq!(failed.code, 1);
    assert_eq!(fs::read_dir(&extensions).unwrap().count(), 0);
    let settings =
        fs::read_to_string(folders.config.path().join("config.toml")).unwrap_or_default();
    assert!(!settings.contains(&long), "{settings}");
}

#[test]
fn add_refuses_a_repository_not_in_the_list_before_cloning() {
    let folders = Folders::new();
    let elsewhere = TempDir::new().unwrap();
    let (_repo, url) = upstream("deploy", "Deploy");

    let output = folders.ura(elsewhere.path(), &["add", &url, "--repo", "nowhere"]);

    assert_eq!(
        output.stderr,
        "ura: no repository named nowhere in Uraeda's list\n"
    );
    assert_eq!(output.code, 1);
    assert!(!folders.extension("deploy").exists());
}
