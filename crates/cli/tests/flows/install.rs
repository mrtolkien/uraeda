//! `ura init` and `ura install`: the skill is installed or updated without a terminal, never over
//! a file a human edited, and never through a link.

use std::fs;
use std::os::unix::fs::symlink;
use std::path::Path;
use std::process::{Command, Stdio};

use crate::common::*;

const AGENTS: &str = ".agents/skills/uraeda";
const CLAUDE: &str = ".claude/skills/uraeda";
const OLD: &str = "old text\n";

fn write(path: &Path, text: &str) {
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, text).unwrap();
}

fn entries(dir: &Path) -> usize {
    fs::read_dir(dir).map_or(0, |entries| entries.count())
}

fn sha256(text: &str) -> String {
    let mut child = Command::new("sha256sum")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .unwrap();
    std::io::Write::write_all(child.stdin.as_mut().unwrap(), text.as_bytes()).unwrap();
    String::from_utf8(child.wait_with_output().unwrap().stdout).unwrap()[..64].to_string()
}

/// Makes an installed skill look installed by an older `ura`: `references/plan.md` unedited and
/// different from this binary's, and `SKILL.md` edited by the human.
fn make_older(skill: &Path) {
    let manifest = fs::read_to_string(skill.join(".ura-manifest")).unwrap();
    let old = sha256(OLD);
    let manifest: Vec<String> = manifest
        .lines()
        .map(|line| match line.split_once("  ") {
            Some((_, path)) if path == "SKILL.md" || path == "references/plan.md" => {
                format!("{old}  {path}")
            }
            _ => line.to_string(),
        })
        .collect();
    write(&skill.join(".ura-manifest"), &(manifest.join("\n") + "\n"));
    write(&skill.join("references/plan.md"), OLD);
    write(&skill.join("SKILL.md"), "edited by the human\n");
}

#[test]
fn the_skill_is_installed_for_the_user_or_the_repository_from_any_folder() {
    let repo = TestRepo::new();
    repo.write("crates/a.txt", "a\n");
    let home = repo.home();
    let env = [("HOME", home.to_str().unwrap())];

    let user = ura_in(
        repo.path(),
        &["install", "--user", "--agents", "--claude"],
        &env,
    );
    let here = ura_in(
        &repo.path().join("crates"),
        &["install", "--repo", "--agents", "--claude"],
        &env,
    );

    assert_eq!(
        (user.code, here.code),
        (0, 0),
        "{}{}",
        user.stderr,
        here.stderr
    );
    for base in [&home, &repo.path().to_path_buf()] {
        assert!(base.join(AGENTS).join("SKILL.md").is_file());
        assert!(base.join(AGENTS).join(".ura-manifest").is_file());
        assert!(
            base.join(CLAUDE).join("SKILL.md").is_file(),
            "the claude folder reads the same skill"
        );
    }
    assert!(
        !repo.exists("crates/.agents"),
        "a repository's copy is at its top level"
    );
    let worktree = repo.parent().join("wt");
    repo.git(&[
        "worktree",
        "add",
        "--quiet",
        "-b",
        "wt",
        worktree.to_str().unwrap(),
    ]);
    assert_eq!(
        ura_in(&worktree, &["install", "--repo", "--agents"], &env).code,
        0
    );
    assert!(
        worktree.join(AGENTS).join("SKILL.md").is_file(),
        "a linked worktree has its own top level"
    );
}

#[test]
fn without_a_terminal_a_missing_choice_is_named_and_nothing_is_written() {
    let cases: [&[&str]; 4] = [&[], &["--user"], &["--agents"], &["--no-input", "--agents"]];
    for flags in cases {
        let repo = TestRepo::new();
        let mut args = vec!["install"];
        args.extend_from_slice(flags);

        let output = ura(&repo, &args);

        assert_eq!(output.code, 1, "{flags:?}");
        assert_eq!(entries(&repo.home()), 0, "{flags:?}");
        assert_eq!(repo.porcelain(), "", "{flags:?}");
    }
    let repo = TestRepo::new();
    assert_eq!(
        ura(&repo, &["install", "--user", "--repo", "--agents"]).code,
        1,
        "conflicting flags"
    );
}

#[test]
fn init_sets_up_specs_only_keeps_what_exists_and_never_asks() {
    let repo = TestRepo::new();
    repo.write("crates/a.txt", "a\n");
    repo.write("specs/CONSTITUTION.md", "# Ours\n");
    let home = repo.home();
    let env = [("HOME", home.to_str().unwrap())];
    ura_in(repo.path(), &["install", "--user", "--agents"], &env);

    let output = ura_in(&repo.path().join("crates"), &["init"], &env);

    assert_eq!(output.code, 0, "{}", output.stderr);
    for file in [
        "specs/README.md",
        "specs/PRIORITIES.md",
        "specs/INBOX.md",
        "specs/drafts/.gitkeep",
    ] {
        assert!(repo.exists(file), "{file}");
    }
    assert_eq!(
        repo.read("specs/CONSTITUTION.md"),
        "# Ours\n",
        "a human's file is kept"
    );
    assert!(
        !repo.exists(".agents") && !repo.exists(".claude"),
        "init sets up specs only"
    );
    repo.write("specs/INBOX.md", "# Inbox\n\n- Ours\n");
    assert_eq!(ura_in(repo.path(), &["init"], &env).code, 0);
    assert_eq!(repo.read("specs/INBOX.md"), "# Inbox\n\n- Ours\n");

    let bare = TestRepo::new();
    let no_skill = ura(&bare, &["init"]);
    assert_eq!(
        no_skill.code, 0,
        "init without a skill found names the command and does not prompt"
    );
    let outside = tempfile::TempDir::new().unwrap();
    assert_eq!(
        ura_in(outside.path(), &["init"], &[]).code,
        1,
        "outside a repository"
    );
}

#[test]
fn an_update_changes_the_files_nobody_edited_and_keeps_the_ones_a_human_did() {
    let repo = TestRepo::new();
    let skill = repo.home().join(AGENTS);
    ura(&repo, &["install", "--user", "--agents"]);
    make_older(&skill);

    let output = ura(&repo, &["install", "--user", "--update"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert_ne!(
        fs::read_to_string(skill.join("references/plan.md")).unwrap(),
        OLD,
        "the unedited file is updated"
    );
    assert_eq!(
        fs::read_to_string(skill.join("SKILL.md")).unwrap(),
        "edited by the human\n"
    );
    let plan = fs::read_to_string(skill.join("references/plan.md")).unwrap();
    let manifest = fs::read_to_string(skill.join(".ura-manifest")).unwrap();
    assert!(
        manifest.contains(&format!("{}  references/plan.md", sha256(&plan))),
        "the manifest lists what was written"
    );
}

#[test]
fn an_update_drops_files_an_older_skill_had_unless_edited() {
    let repo = TestRepo::new();
    let skill = repo.home().join(AGENTS);
    ura(&repo, &["install", "--user", "--agents"]);
    let hash = sha256("old\n");
    let mut manifest = fs::read_to_string(skill.join(".ura-manifest")).unwrap();
    manifest.push_str(&format!(
        "{hash}  references/old.md\n{hash}  references/edited.md\n"
    ));
    write(&skill.join(".ura-manifest"), &manifest);
    write(&skill.join("references/old.md"), "old\n");
    write(&skill.join("references/edited.md"), "edited\n");

    ura(&repo, &["install", "--user", "--update"]);

    assert!(
        !skill.join("references/old.md").exists(),
        "an unedited file the skill no longer has is dropped"
    );
    assert!(
        skill.join("references/edited.md").exists(),
        "an edited one is kept"
    );
}

#[test]
fn an_update_touches_nothing_it_did_not_install() {
    let repo = TestRepo::new();
    let home = repo.home();
    let nothing = ura(&repo, &["install", "--user", "--update"]);
    assert_eq!(nothing.code, 0);
    assert_eq!(entries(&home), 0, "nothing installed: nothing written");

    let checkout = home.join("dev/skill");
    write(&checkout.join("SKILL.md"), "ours\n");
    fs::create_dir_all(home.join(".claude/skills")).unwrap();
    symlink(&checkout, home.join(CLAUDE)).unwrap();
    write(&home.join(AGENTS).join("SKILL.md"), "npx\n");

    let skipped = ura(&repo, &["install", "--user", "--update"]);

    assert_eq!(skipped.code, 0);
    assert_eq!(
        (entries(&checkout), entries(&home.join(AGENTS))),
        (1, 1),
        "a link and a foreign folder are skipped"
    );
    assert_eq!(
        fs::read_to_string(checkout.join("SKILL.md")).unwrap(),
        "ours\n"
    );
}

#[test]
fn a_manifest_path_outside_the_skill_is_ignored() {
    let repo = TestRepo::new();
    let skill = repo.home().join(AGENTS);
    ura(&repo, &["install", "--user", "--agents"]);
    let outside = skill.parent().unwrap().join("outside.txt");
    write(&outside, "x\n");
    let mut manifest = fs::read_to_string(skill.join(".ura-manifest")).unwrap();
    manifest.push_str(&format!("{}  ../outside.txt\n", sha256("x\n")));
    write(&skill.join(".ura-manifest"), &manifest);

    let output = ura(&repo, &["install", "--user", "--update"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert!(
        outside.is_file(),
        "a path outside the skill is never deleted"
    );
}

#[test]
fn an_install_or_update_never_writes_through_a_link() {
    // A link where the skill goes, to a checkout of the human's.
    let repo = TestRepo::new();
    let home = repo.home();
    let checkout = home.join("dev/skill");
    write(&checkout.join("SKILL.md"), "ours\n");
    fs::create_dir_all(home.join(".claude/skills")).unwrap();
    symlink(&checkout, home.join(CLAUDE)).unwrap();

    let output = ura(&repo, &["install", "--user", "--agents", "--claude"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert_eq!(entries(&checkout), 1);
    assert_eq!(
        fs::read_to_string(checkout.join("SKILL.md")).unwrap(),
        "ours\n"
    );
    assert!(home.join(AGENTS).join("SKILL.md").is_file());

    // Links inside an installed skill, to files of the human's.
    let repo = TestRepo::new();
    let skill = repo.home().join(AGENTS);
    ura(&repo, &["install", "--user", "--agents"]);
    make_older(&skill);
    let theirs = repo.home().join("theirs");
    write(&theirs.join("plan.md"), OLD);
    fs::remove_file(skill.join("references/plan.md")).unwrap();
    symlink(theirs.join("plan.md"), skill.join("references/plan.md")).unwrap();

    ura(&repo, &["install", "--user", "--update"]);

    assert_eq!(
        fs::read_to_string(theirs.join("plan.md")).unwrap(),
        OLD,
        "the human's file is not written through the link"
    );
}

#[test]
fn a_failed_first_install_leaves_nothing() {
    use std::os::unix::fs::PermissionsExt;
    if Command::new("id")
        .arg("-u")
        .output()
        .is_ok_and(|id| String::from_utf8_lossy(&id.stdout).trim() == "0")
    {
        return;
    }
    let repo = TestRepo::new();
    let skills = repo.home().join(".agents/skills");
    fs::create_dir_all(&skills).unwrap();
    fs::set_permissions(&skills, fs::Permissions::from_mode(0o555)).unwrap();

    let output = ura(&repo, &["install", "--user", "--agents"]);

    fs::set_permissions(&skills, fs::Permissions::from_mode(0o755)).unwrap();
    assert_eq!(output.code, 1);
    assert_eq!(
        entries(&skills),
        0,
        "no half-written skill, no temporary folder"
    );
}
