mod common;

use std::fs;
use std::path::Path;
use std::process::Command;

use common::*;

const AGENTS: &str = ".agents/skills/uraeda";
const CLAUDE: &str = ".claude/skills/uraeda";
const NOTE: &str = "Claude Code reads the user's copy, other agents the repository's";

fn entries(dir: &Path) -> usize {
    fs::read_dir(dir).map_or(0, |entries| entries.count())
}

fn is_link(path: &Path) -> bool {
    fs::symlink_metadata(path).is_ok_and(|meta| meta.file_type().is_symlink())
}

fn is_real_folder(path: &Path) -> bool {
    fs::symlink_metadata(path).is_ok_and(|meta| meta.is_dir())
}

fn write(path: &Path, text: &str) {
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, text).unwrap();
}

#[cfg(unix)]
fn symlink(target: &Path, link: &Path) {
    fs::create_dir_all(link.parent().unwrap()).unwrap();
    std::os::unix::fs::symlink(target, link).unwrap();
}

#[test]
fn installs_for_the_user_in_both_folders() {
    let repo = TestRepo::new();
    let home = repo.home();

    let output = ura(&repo, &["install", "--user", "--agents", "--claude"]);

    assert_eq!(
        output.stdout,
        format!(
            "created ~/.agents/skills/uraeda/ ({} files)\n\
             linked  ~/.claude/skills/uraeda -> ../../.agents/skills/uraeda\n",
            skill_files()
        ),
        "{}",
        output.stderr
    );
    assert!(home.join(AGENTS).join("SKILL.md").is_file());
    assert!(home.join(AGENTS).join(".ura-manifest").is_file());
    let link = fs::read_link(home.join(CLAUDE)).unwrap();
    assert_eq!(link.to_str(), Some("../../.agents/skills/uraeda"));
    assert!(home.join(CLAUDE).join("SKILL.md").is_file());
    assert!(!repo.exists(".agents"));
    assert_eq!(output.code, 0);
}

#[test]
fn installs_for_claude_alone() {
    let repo = TestRepo::new();
    let home = repo.home();

    let output = ura(&repo, &["install", "--user", "--claude"]);

    assert!(is_real_folder(&home.join(CLAUDE)), "{}", output.stderr);
    assert!(home.join(CLAUDE).join(".ura-manifest").is_file());
    assert!(!home.join(".agents").exists());
    assert_eq!(output.code, 0);
}

#[test]
fn installs_for_agents_alone() {
    let repo = TestRepo::new();
    let home = repo.home();

    let output = ura(&repo, &["install", "--user", "--agents"]);

    assert!(
        home.join(AGENTS).join("SKILL.md").is_file(),
        "{}",
        output.stderr
    );
    assert!(!home.join(".claude").exists());
    assert_eq!(output.code, 0);
}

#[test]
fn installs_in_the_repository_from_a_subfolder() {
    let repo = TestRepo::new();
    repo.write("crates/a.txt", "a\n");
    let home = repo.home();

    let output = ura_in(
        &repo.path().join("crates"),
        &["install", "--repo", "--agents", "--claude"],
        &[("HOME", home.to_str().unwrap())],
    );

    assert!(
        repo.exists(".agents/skills/uraeda/SKILL.md"),
        "{}",
        output.stderr
    );
    let link = fs::read_link(repo.path().join(CLAUDE)).unwrap();
    assert_eq!(link.to_str(), Some("../../.agents/skills/uraeda"));
    assert!(!repo.exists("crates/.agents"));
    assert_eq!(entries(&home), 0);
    assert_eq!(
        output.stdout,
        format!(
            "created .agents/skills/uraeda/ ({} files)\n\
             linked  .claude/skills/uraeda -> ../../.agents/skills/uraeda\n",
            skill_files()
        )
    );
}

#[test]
fn installs_in_a_linked_worktree_at_its_own_top_level() {
    let repo = TestRepo::new();
    let worktree = repo.parent().join("wt");
    repo.git(&[
        "worktree",
        "add",
        "--quiet",
        "-b",
        "wt",
        worktree.to_str().unwrap(),
    ]);
    let home = repo.home();

    let output = ura_in(
        &worktree,
        &["install", "--repo", "--agents"],
        &[("HOME", home.to_str().unwrap())],
    );

    assert!(
        worktree.join(AGENTS).join("SKILL.md").is_file(),
        "{}",
        output.stderr
    );
    assert!(!repo.exists(".agents"));
}

#[test]
fn without_a_terminal_names_the_missing_flags() {
    let cases: &[(&[&str], &str)] = &[
        (
            &[],
            "ura: no terminal to ask: pass --user or --repo, and --agents, --claude, or both\n",
        ),
        (
            &["--user"],
            "ura: no terminal to ask: pass --agents, --claude, or both\n",
        ),
        (
            &["--agents"],
            "ura: no terminal to ask: pass --user or --repo\n",
        ),
        (
            &["--no-input", "--agents"],
            "ura: no terminal to ask: pass --user or --repo\n",
        ),
    ];
    for (flags, stderr) in cases {
        let repo = TestRepo::new();
        let mut args = vec!["install"];
        args.extend_from_slice(flags);

        let output = ura(&repo, &args);

        assert_eq!(output.stderr, *stderr, "{flags:?}");
        assert_eq!(output.code, 1, "{flags:?}");
        assert_eq!(entries(&repo.home()), 0, "{flags:?}");
        assert_eq!(repo.porcelain(), "", "{flags:?}");
    }
}

/// Makes an installed skill look installed by an older `ura`: `references/plan.md` unedited and
/// different from this binary's, and `SKILL.md` edited by the human.
fn make_older(skill: &Path) {
    let manifest = fs::read_to_string(skill.join(".ura-manifest")).unwrap();
    let old_hash = sha256(OLD);
    let manifest = manifest
        .lines()
        .map(|line| match line.split_once("  ") {
            Some((_, path)) if path == "SKILL.md" || path == "references/plan.md" => {
                format!("{old_hash}  {path}")
            }
            _ => line.to_string(),
        })
        .collect::<Vec<_>>()
        .join("\n");
    write(&skill.join(".ura-manifest"), &(manifest + "\n"));
    write(&skill.join("references/plan.md"), OLD);
    write(&skill.join("SKILL.md"), "edited by the human\n");
}

const OLD: &str = "old text\n";

fn assert_updated(skill: &Path, output: &Output) {
    assert_ne!(
        fs::read_to_string(skill.join("references/plan.md")).unwrap(),
        OLD
    );
    assert_eq!(
        fs::read_to_string(skill.join("SKILL.md")).unwrap(),
        "edited by the human\n"
    );
    let dir = skill
        .strip_prefix(skill.ancestors().nth(3).unwrap())
        .unwrap();
    assert_eq!(
        output.stdout,
        format!(
            "kept    ~/{dir}/SKILL.md: edited since installed\n\
             updated ~/{dir}/ (1 file)\n",
            dir = dir.display()
        ),
        "{}",
        output.stderr
    );
    assert_eq!(output.code, 0);
}

#[test]
fn updates_the_files_nobody_edited() {
    let repo = TestRepo::new();
    let skill = repo.home().join(AGENTS);
    ura(&repo, &["install", "--user", "--agents"]);
    make_older(&skill);

    let output = ura(&repo, &["install", "--user", "--agents"]);

    assert_updated(&skill, &output);
}

#[test]
fn update_keeps_edited_files() {
    let repo = TestRepo::new();
    let skill = repo.home().join(AGENTS);
    ura(&repo, &["install", "--user", "--agents"]);
    make_older(&skill);

    let output = ura(&repo, &["install", "--user", "--update"]);

    assert_eq!(
        output.stdout,
        "kept    ~/.agents/skills/uraeda/SKILL.md: edited since installed\n\
         updated ~/.agents/skills/uraeda/ (1 file)\n",
        "{}",
        output.stderr
    );
    assert_updated(&skill, &output);
}

#[test]
fn update_follows_what_was_installed() {
    let repo = TestRepo::new();
    let home = repo.home();
    ura(&repo, &["install", "--user", "--claude"]);
    make_older(&home.join(CLAUDE));

    let output = ura(&repo, &["install", "--user", "--update"]);

    assert_updated(&home.join(CLAUDE), &output);
    assert!(!home.join(".agents").exists());
}

#[test]
fn update_with_nothing_installed() {
    let repo = TestRepo::new();

    let output = ura(&repo, &["install", "--user", "--update"]);

    assert_eq!(
        output.stdout, "nothing to update: ura installed no skill in ~/\n",
        "{}",
        output.stderr
    );
    assert_eq!(output.code, 0);
    assert_eq!(entries(&repo.home()), 0);

    let output = ura(&repo, &["install", "--repo", "--update"]);

    assert_eq!(
        output.stdout, "nothing to update: ura installed no skill in this repository\n",
        "{}",
        output.stderr
    );
    assert_eq!(output.code, 0);
    assert_eq!(repo.porcelain(), "");
}

#[cfg(unix)]
#[test]
fn update_skips_links_and_foreign_folders() {
    let repo = TestRepo::new();
    let home = repo.home();
    let checkout = home.join("dev/skill");
    write(&checkout.join("SKILL.md"), "ours\n");
    symlink(&checkout, &home.join(CLAUDE));
    write(&home.join(AGENTS).join("SKILL.md"), "npx\n");

    let output = ura(&repo, &["install", "--user", "--update"]);

    assert_eq!(
        output.stdout, "nothing to update: ura installed no skill in ~/\n",
        "{}",
        output.stderr
    );
    assert_eq!(output.code, 0);
    assert_eq!(entries(&checkout), 1);
    assert_eq!(
        fs::read_to_string(checkout.join("SKILL.md")).unwrap(),
        "ours\n"
    );
    assert_eq!(entries(&home.join(AGENTS)), 1);
    assert_eq!(
        fs::read_to_string(home.join(AGENTS).join("SKILL.md")).unwrap(),
        "npx\n"
    );
}

#[test]
fn update_without_a_scope() {
    let repo = TestRepo::new();

    let output = ura(&repo, &["install", "--update"]);

    assert_eq!(
        output.stderr,
        "ura: no terminal to ask: pass --user or --repo\n"
    );
    assert_eq!(output.code, 1);
    assert_eq!(entries(&repo.home()), 0);
}

#[test]
fn run_again_keeps_everything() {
    let repo = TestRepo::new();
    let manifest = repo.home().join(AGENTS).join(".ura-manifest");
    ura(&repo, &["install", "--user", "--agents", "--claude"]);
    let written = fs::metadata(&manifest).unwrap().modified().unwrap();

    let output = ura(&repo, &["install", "--user", "--agents", "--claude"]);

    assert_eq!(
        output.stdout,
        "kept    ~/.agents/skills/uraeda/: up to date\nkept    ~/.claude/skills/uraeda\n"
    );
    assert_eq!(
        fs::metadata(&manifest).unwrap().modified().unwrap(),
        written
    );
}

#[test]
fn drops_files_an_older_skill_had() {
    let repo = TestRepo::new();
    let skill = repo.home().join(AGENTS);
    ura(&repo, &["install", "--user", "--agents"]);
    let hash = sha256("old\n");
    let mut manifest = fs::read_to_string(skill.join(".ura-manifest")).unwrap();
    manifest.push_str(&format!("{hash}  references/old.md\n"));
    manifest.push_str(&format!("{hash}  references/edited.md\n"));
    write(&skill.join(".ura-manifest"), &manifest);
    write(&skill.join("references/old.md"), "old\n");
    write(&skill.join("references/edited.md"), "edited\n");

    let output = ura(&repo, &["install", "--user", "--agents"]);

    assert!(
        !skill.join("references/old.md").exists(),
        "{}",
        output.stdout
    );
    assert_eq!(
        fs::read_to_string(skill.join("references/edited.md")).unwrap(),
        "edited\n"
    );
    assert_eq!(output.code, 0, "{}", output.stderr);
}

#[cfg(unix)]
#[test]
fn a_link_is_never_written_through() {
    // A link at .claude/skills/uraeda, to a checkout.
    let repo = TestRepo::new();
    let home = repo.home();
    let checkout = home.join("dev/skill");
    write(&checkout.join("SKILL.md"), "ours\n");
    symlink(&checkout, &home.join(CLAUDE));

    let output = ura(&repo, &["install", "--user", "--agents", "--claude"]);

    assert!(
        output.stdout.ends_with(&format!(
            "kept    ~/.claude/skills/uraeda: a link to {}\n",
            checkout.display()
        )),
        "{}{}",
        output.stdout,
        output.stderr
    );
    assert_eq!(
        fs::read_to_string(checkout.join("SKILL.md")).unwrap(),
        "ours\n"
    );
    assert_eq!(entries(&checkout), 1);
    assert!(home.join(AGENTS).join("SKILL.md").is_file());

    // A link at .agents/skills/uraeda: kept, and .claude/skills/uraeda linked to it.
    let repo = TestRepo::new();
    let home = repo.home();
    let checkout = home.join("dev/skill");
    write(&checkout.join("SKILL.md"), "ours\n");
    symlink(&checkout, &home.join(AGENTS));

    let output = ura(&repo, &["install", "--user", "--agents", "--claude"]);

    assert_eq!(
        output.stdout,
        format!(
            "kept    ~/.agents/skills/uraeda: a link to {}\n\
             linked  ~/.claude/skills/uraeda -> ../../.agents/skills/uraeda\n",
            checkout.display()
        ),
        "{}",
        output.stderr
    );
    assert_eq!(
        fs::read_to_string(checkout.join("SKILL.md")).unwrap(),
        "ours\n"
    );
    assert_eq!(entries(&checkout), 1);
    assert!(is_link(&home.join(CLAUDE)));
}

#[cfg(unix)]
#[test]
fn links_through_a_linked_claude_folder() {
    // ~/.claude, a link to a dotfiles folder: the link's target starts from the real folder.
    let repo = TestRepo::new();
    let home = repo.home();
    fs::create_dir_all(home.join("dotfiles/claude")).unwrap();
    symlink(&home.join("dotfiles/claude"), &home.join(".claude"));

    let output = ura(&repo, &["install", "--user", "--agents", "--claude"]);

    assert_eq!(
        output.stdout,
        format!(
            "created ~/.agents/skills/uraeda/ ({} files)\n\
             linked  ~/.claude/skills/uraeda -> ../../../.agents/skills/uraeda\n",
            skill_files()
        ),
        "{}",
        output.stderr
    );
    assert!(home.join(CLAUDE).join("SKILL.md").is_file());
    assert_eq!(output.code, 0);

    let output = ura(&repo, &["install", "--user", "--agents", "--claude"]);

    assert_eq!(
        output.stdout,
        "kept    ~/.agents/skills/uraeda/: up to date\nkept    ~/.claude/skills/uraeda\n",
        "{}",
        output.stderr
    );
}

#[cfg(unix)]
#[test]
fn a_link_with_ura_s_target_elsewhere_is_named() {
    // ura's target, from a linked ~/.claude, reaches another folder than ~/.agents's copy.
    let repo = TestRepo::new();
    let home = repo.home();
    fs::create_dir_all(home.join("dotfiles/claude/skills")).unwrap();
    symlink(&home.join("dotfiles/claude"), &home.join(".claude"));
    symlink(
        Path::new("../../.agents/skills/uraeda"),
        &home.join("dotfiles/claude/skills/uraeda"),
    );

    let output = ura(&repo, &["install", "--user", "--agents", "--claude"]);

    assert!(
        output
            .stdout
            .ends_with("kept    ~/.claude/skills/uraeda: a link to ../../.agents/skills/uraeda\n"),
        "{}{}",
        output.stdout,
        output.stderr
    );
    assert_eq!(output.code, 0);
}

#[cfg(unix)]
#[test]
fn a_dangling_link_is_kept() {
    let repo = TestRepo::new();
    let home = repo.home();
    let gone = home.join("gone");
    symlink(&gone, &home.join(CLAUDE));

    let output = ura(&repo, &["install", "--user", "--agents", "--claude"]);

    assert!(
        output.stdout.ends_with(&format!(
            "kept    ~/.claude/skills/uraeda: a link to {}\n",
            gone.display()
        )),
        "{}{}",
        output.stdout,
        output.stderr
    );
    assert!(is_link(&home.join(CLAUDE)));
    assert!(!gone.exists());
    assert_eq!(output.code, 0);
}

#[test]
fn a_folder_without_a_manifest_is_kept() {
    let repo = TestRepo::new();
    let home = repo.home();
    write(&home.join(AGENTS).join("SKILL.md"), "npx\n");

    let output = ura(&repo, &["install", "--user", "--agents"]);

    assert_eq!(
        output.stdout,
        "kept    ~/.agents/skills/uraeda: not installed by ura\n"
    );
    assert_eq!(entries(&home.join(AGENTS)), 1);
    assert_eq!(
        fs::read_to_string(home.join(AGENTS).join("SKILL.md")).unwrap(),
        "npx\n"
    );

    let output = ura(&repo, &["install", "--user", "--agents", "--claude"]);

    assert_eq!(
        output.stdout,
        "kept    ~/.agents/skills/uraeda: not installed by ura\n\
         linked  ~/.claude/skills/uraeda -> ../../.agents/skills/uraeda\n"
    );
    assert_eq!(entries(&home.join(AGENTS)), 1);
}

#[test]
fn claude_alone_then_both_updates_both() {
    let repo = TestRepo::new();
    let home = repo.home();
    ura(&repo, &["install", "--user", "--claude"]);

    let output = ura(&repo, &["install", "--user", "--agents", "--claude"]);

    assert_eq!(
        output.stdout,
        format!(
            "created ~/.agents/skills/uraeda/ ({} files)\n\
             kept    ~/.claude/skills/uraeda/: up to date\n",
            skill_files()
        )
    );
    assert!(is_real_folder(&home.join(CLAUDE)));
    assert!(is_real_folder(&home.join(AGENTS)));
    assert!(home.join(AGENTS).join(".ura-manifest").is_file());
}

#[test]
fn notes_a_copy_at_the_other_scope() {
    let repo = TestRepo::new();
    repo.write(".agents/skills/uraeda/SKILL.md", "committed\n");

    let output = ura(&repo, &["install", "--user", "--agents"]);

    assert_eq!(
        output.stdout.lines().last(),
        Some(format!("note    another copy in .agents/skills/uraeda: {NOTE}").as_str()),
        "{}",
        output.stderr
    );

    let repo = TestRepo::new();
    write(&repo.home().join(AGENTS).join("SKILL.md"), "npx\n");

    let output = ura(&repo, &["install", "--repo", "--agents"]);

    assert_eq!(
        output.stdout.lines().last(),
        Some(format!("note    another copy in ~/.agents/skills/uraeda: {NOTE}").as_str()),
        "{}",
        output.stderr
    );
    assert!(repo.exists(".agents/skills/uraeda/.ura-manifest"));
}

#[test]
fn outside_a_repository() {
    let folder = tempfile::TempDir::new().unwrap();
    let home = tempfile::TempDir::new().unwrap();
    let env = [("HOME", home.path().to_str().unwrap())];

    let output = ura_in(folder.path(), &["install", "--agents"], &env);

    assert_eq!(
        output.stdout.lines().next(),
        Some("Install the Uraeda skill for: your user"),
        "{}",
        output.stderr
    );
    assert!(home.path().join(AGENTS).join("SKILL.md").is_file());
    assert_eq!(output.code, 0);

    let output = ura_in(folder.path(), &["install", "--repo", "--agents"], &env);

    assert_eq!(
        output.stderr,
        "ura: not in a git repository: run git init first\n"
    );
    assert_eq!(output.code, 1);
    assert_eq!(entries(folder.path()), 0);
}

#[test]
fn conflicting_flags() {
    for flags in [["--user", "--repo"], ["--update", "--agents"]] {
        let repo = TestRepo::new();
        let mut args = vec!["install"];
        args.extend_from_slice(&flags);

        let output = ura(&repo, &args);

        assert!(
            output.stderr.starts_with("ura: the argument"),
            "{flags:?}: {}",
            output.stderr
        );
        assert_eq!(output.code, 1);
        assert_eq!(entries(&repo.home()), 0);
    }
}

#[test]
fn home_not_set() {
    let repo = TestRepo::new();
    let args = ["install", "--user", "--agents"];

    for output in [
        ura_without_home(repo.path(), &args),
        ura_in(repo.path(), &args, &[("HOME", "")]),
    ] {
        assert_eq!(
            output.stderr,
            "ura: HOME is not set: set it, or pass --repo\n"
        );
        assert_eq!(output.code, 1);
    }
    assert!(!repo.exists(".agents"));
}

#[test]
fn a_stale_temporary_folder_is_replaced() {
    let repo = TestRepo::new();
    let home = repo.home();
    write(&home.join(".agents/skills/uraeda.ura-tmp/x.md"), "stale\n");

    let output = ura(&repo, &["install", "--user", "--agents"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert!(!home.join(".agents/skills/uraeda.ura-tmp").exists());
    assert!(!home.join(AGENTS).join("x.md").exists());
    assert!(home.join(AGENTS).join("SKILL.md").is_file());
}

#[cfg(unix)]
#[test]
fn a_failed_first_install_leaves_nothing() {
    use std::os::unix::fs::PermissionsExt;
    let root = Command::new("id").arg("-u").output().unwrap();
    if String::from_utf8_lossy(&root.stdout).trim() == "0" {
        return;
    }
    let repo = TestRepo::new();
    let skills = repo.home().join(".agents/skills");
    fs::create_dir_all(&skills).unwrap();
    fs::set_permissions(&skills, fs::Permissions::from_mode(0o555)).unwrap();

    let output = ura(&repo, &["install", "--user", "--agents"]);

    fs::set_permissions(&skills, fs::Permissions::from_mode(0o755)).unwrap();
    assert!(
        output
            .stderr
            .starts_with("ura: could not write ~/.agents/skills/uraeda"),
        "{}",
        output.stderr
    );
    assert_eq!(output.code, 1);
    assert_eq!(entries(&skills), 0);
}

#[test]
fn the_manifest_checks_with_sha256sum() {
    let repo = TestRepo::new();
    ura(&repo, &["install", "--user", "--agents"]);

    let Ok(output) = Command::new("sha256sum")
        .args(["--check", "--quiet", ".ura-manifest"])
        .current_dir(repo.home().join(AGENTS))
        .output()
    else {
        return;
    };

    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stdout)
    );
}

fn sha256(text: &str) -> String {
    let output = Command::new("sha256sum")
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .spawn()
        .and_then(|mut child| {
            use std::io::Write;
            child.stdin.take().unwrap().write_all(text.as_bytes())?;
            child.wait_with_output()
        })
        .unwrap();
    String::from_utf8(output.stdout).unwrap()[..64].to_string()
}
