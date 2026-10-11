mod common;

use std::fs;
use std::process::Command;

use common::*;

const SKILL: &str = ".agents/skills/uraeda";

#[test]
fn sets_up_specs_and_the_skill_from_a_subfolder() {
    let repo = TestRepo::new();
    repo.write("crates/a.txt", "a\n");

    let output = ura_in(&repo.path().join("crates"), &["init"], &[]);

    for file in [
        "specs/README.md",
        "specs/CONSTITUTION.md",
        "specs/PRIORITIES.md",
        "specs/drafts/.gitkeep",
        "specs/backlog/.gitkeep",
        "specs/decisions/.gitkeep",
        "specs/bugs/.gitkeep",
        ".agents/skills/uraeda/SKILL.md",
        ".agents/skills/uraeda/references/spec.md",
        ".agents/skills/uraeda/.ura-manifest",
    ] {
        assert!(repo.exists(file), "{file}\n{}", output.stdout);
    }
    let link = fs::read_link(repo.path().join(".claude/skills/uraeda")).unwrap();
    assert_eq!(link.to_str(), Some("../../.agents/skills/uraeda"));
    assert!(repo.exists(".claude/skills/uraeda/SKILL.md"));
    assert_eq!(repo.subjects("HEAD").len(), 1);
    assert_eq!(
        output.stdout.lines().last(),
        Some("Next: ask your agent to write specs/CONSTITUTION.md with you, then commit.")
    );
    assert!(
        output.stdout.starts_with("created specs/README.md\n"),
        "{}",
        output.stdout
    );
    assert_eq!(output.code, 0, "{}", output.stderr);
}

#[test]
fn keeps_existing_files() {
    let repo = TestRepo::new();
    repo.write("specs/CONSTITUTION.md", "# Ours\n");

    let output = ura(&repo, &["init"]);

    assert_eq!(repo.read("specs/CONSTITUTION.md"), "# Ours\n");
    assert!(
        output.stdout.contains("kept    specs/CONSTITUTION.md\n"),
        "{}",
        output.stdout
    );
}

#[test]
fn updates_the_skill_files_nobody_edited() {
    let repo = TestRepo::new();
    ura(&repo, &["init"]);
    // An older install: two files differ from this binary's, one of them edited by the human.
    let manifest = repo.read(&format!("{SKILL}/.ura-manifest"));
    let old = "old text\n";
    let old_hash = sha256(old);
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
    repo.write(&format!("{SKILL}/.ura-manifest"), &(manifest + "\n"));
    repo.write(&format!("{SKILL}/references/plan.md"), old);
    repo.write(&format!("{SKILL}/SKILL.md"), "edited by the human\n");

    let output = ura(&repo, &["init"]);

    assert_ne!(repo.read(&format!("{SKILL}/references/plan.md")), old);
    assert_eq!(
        repo.read(&format!("{SKILL}/SKILL.md")),
        "edited by the human\n"
    );
    assert!(
        output
            .stdout
            .contains("kept    .agents/skills/uraeda/SKILL.md: edited since installed\n"),
        "{}",
        output.stdout
    );
    assert!(
        output
            .stdout
            .contains("updated .agents/skills/uraeda/ (1 file)\n"),
        "{}",
        output.stdout
    );
}

#[test]
fn no_skill() {
    let repo = TestRepo::new();

    ura(&repo, &["init", "--no-skill"]);

    assert!(repo.exists("specs/PRIORITIES.md"));
    assert!(!repo.exists(".agents"));
    assert!(!repo.exists(".claude"));
}

#[test]
fn outside_a_repository() {
    let folder = tempfile::TempDir::new().unwrap();

    let output = ura_in(folder.path(), &["init"], &[]);

    assert_eq!(
        output.stderr,
        "ura: not in a git repository: run git init first\n"
    );
    assert_eq!(output.code, 1);
    assert_eq!(fs::read_dir(folder.path()).unwrap().count(), 0);
}

#[test]
fn an_existing_claude_skill_folder_is_kept() {
    let repo = TestRepo::new();
    repo.write(".claude/skills/uraeda/SKILL.md", "ours\n");

    let output = ura(&repo, &["init"]);

    assert_eq!(repo.read(".claude/skills/uraeda/SKILL.md"), "ours\n");
    assert!(
        output.stdout.contains("kept    .claude/skills/uraeda\n"),
        "{}",
        output.stdout
    );
}

#[test]
fn the_manifest_checks_with_sha256sum() {
    let repo = TestRepo::new();
    ura(&repo, &["init"]);

    let Ok(output) = Command::new("sha256sum")
        .args(["--check", "--quiet", ".ura-manifest"])
        .current_dir(repo.path().join(SKILL))
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
