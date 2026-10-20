mod common;

use std::path::Path;

use common::*;

const PRIORITIES: &str = "# Priorities\n\n## Now\n\n## Next\n";

/// What `ura` answers when fish asks to complete `words`, the last one being completed: the
/// values, without their help.
fn complete_in(dir: &Path, words: &[&str], env: &[(&str, &str)]) -> Vec<String> {
    let mut args = vec!["--", "ura"];
    args.extend_from_slice(words);
    let mut env = env.to_vec();
    env.push(("COMPLETE", "fish"));
    let output = ura_in(dir, &args, &env);
    assert_eq!(output.code, 0, "{}", output.stderr);
    output
        .stdout
        .lines()
        .map(|line| line.split('\t').next().unwrap_or_default().to_string())
        .collect()
}

fn complete(repo: &TestRepo, words: &[&str]) -> Vec<String> {
    complete_in(repo.path(), words, &[])
}

/// The values that are not flags.
fn values(candidates: Vec<String>) -> Vec<String> {
    candidates
        .into_iter()
        .filter(|candidate| !candidate.starts_with('-'))
        .collect()
}

#[test]
fn registers_with_fish_and_zsh() {
    let repo = TestRepo::new();

    let fish = ura_in(repo.path(), &[], &[("COMPLETE", "fish")]);
    let zsh = ura_in(repo.path(), &[], &[("COMPLETE", "zsh")]);

    assert!(
        fish.stdout
            .starts_with("complete --keep-order --exclusive --command ura --arguments"),
        "{}",
        fish.stdout
    );
    assert!(zsh.stdout.starts_with("#compdef ura"), "{}", zsh.stdout);
    assert_eq!((fish.code, zsh.code), (0, 0));
}

/// Installed as `_ura` on `fpath`, zsh autoloads the script on the first Tab: it must complete
/// then, not only register itself for the next Tab.
#[test]
fn the_zsh_script_completes_when_autoloaded() {
    let repo = TestRepo::new();

    let zsh = ura_in(repo.path(), &[], &[("COMPLETE", "zsh")]);

    assert!(
        zsh.stdout.ends_with(
            "compdef _clap_dynamic_completer_ura ura\n\
             if [ \"$funcstack[1]\" = \"_ura\" ]; then\n    \
             _clap_dynamic_completer_ura \"$@\"\nfi\n"
        ),
        "{}",
        zsh.stdout
    );
}

#[test]
fn completes_commands_and_flags() {
    let repo = TestRepo::new();

    assert!(complete(&repo, &["sta"]).iter().eq(["start", "status"]));
    assert!(
        complete(&repo, &["review", "--plan-review", ""])
            .iter()
            .eq(["true", "false"])
    );
}

#[test]
fn start_completes_drafts_by_name() {
    let repo = TestRepo::new();
    specs(&repo, PRIORITIES);
    repo.write("specs/drafts/listener.md", &proposal());
    repo.write("specs/backlog/old-idea/proposal.md", &proposal());
    repo.commit("chore: drafts");

    assert_eq!(
        values(complete(&repo, &["start", ""])),
        ["old-idea", "listener"]
    );
    assert_eq!(values(complete(&repo, &["start", "li"])), ["listener"]);
}

#[test]
fn targets_complete_started_features_and_changes_by_slug() {
    let repo = TestRepo::new();
    specs(&repo, PRIORITIES);
    feature(&repo, "2026-10-10-cli-core", &[("proposal.md", proposal())]);
    feature(
        &repo,
        "change/2026-10-11-typo",
        &[("proposal.md", proposal())],
    );
    repo.write("specs/done/2026-10-01-old.md", &record("feature", "Old"));
    repo.commit("finish(old): Old");

    for words in [
        &["next", ""][..],
        &["review", ""],
        &["note", "a note", "--about", ""],
    ] {
        assert_eq!(
            values(complete(&repo, words)),
            ["cli-core", "typo"],
            "{words:?}"
        );
    }
    assert!(values(complete(&repo, &["check", "c"])).contains(&"cli-core".to_string()));
}

#[test]
fn category_completes_the_inbox_categories() {
    let repo = TestRepo::new();
    specs(&repo, PRIORITIES);
    repo.write(
        "specs/INBOX.md",
        "# Inbox\n\n## UI\n\n- A note.\n\n## Prompts\n\n- Another.\n",
    );
    repo.commit("chore: inbox");

    assert_eq!(
        complete(&repo, &["note", "a note", "--category", ""]),
        ["UI", "Prompts"]
    );
}

#[test]
fn answer_completes_the_waiting_round_and_its_open_questions() {
    let repo = TestRepo::new();
    specs(&repo, PRIORITIES);
    feature(
        &repo,
        "2026-10-10-waiting",
        &[
            ("proposal.md", proposal()),
            (
                "clarifications-01.md",
                clarifications(
                    "awaiting-human",
                    "2 questions, about 5 minutes.",
                    &["A", ""],
                ),
            ),
        ],
    );

    assert_eq!(
        values(complete(&repo, &["answer", ""])),
        ["waiting", "Q2", "notes"]
    );
}

#[test]
fn answer_completes_the_questions_of_the_round_typed() {
    let repo = TestRepo::new();
    specs(&repo, PRIORITIES);
    for folder in ["2026-10-10-first", "2026-10-11-second"] {
        feature(
            &repo,
            folder,
            &[
                ("proposal.md", proposal()),
                (
                    "clarifications-01.md",
                    clarifications(
                        "awaiting-human",
                        "2 questions, about 5 minutes.",
                        &["A", ""],
                    ),
                ),
            ],
        );
    }

    assert_eq!(
        values(complete(&repo, &["answer", ""])),
        ["first", "second"]
    );
    assert_eq!(
        values(complete(&repo, &["answer", "second", ""])),
        ["Q2", "notes"]
    );
    // From another feature's checkout, the round typed still wins.
    repo.switch("2026-10-10-first");
    assert_eq!(
        values(complete(&repo, &["answer", "second", ""])),
        ["Q2", "notes"]
    );
    // Once a question is typed, the next word is the answer: nothing to offer.
    assert_eq!(
        values(complete(&repo, &["answer", "second", "Q2", ""])),
        Vec::<String>::new()
    );
}

/// zsh passes every word of the line, the cursor's index apart: words after it are not typed yet.
#[test]
fn answers_zsh_with_the_cursor_s_index() {
    let repo = TestRepo::new();
    specs(&repo, PRIORITIES);
    feature(
        &repo,
        "2026-10-10-waiting",
        &[
            ("proposal.md", proposal()),
            (
                "clarifications-01.md",
                clarifications(
                    "awaiting-human",
                    "2 questions, about 5 minutes.",
                    &["A", ""],
                ),
            ),
        ],
    );

    let output = ura_in(
        repo.path(),
        &["--", "ura", "answer", "", "Q2"],
        &[
            ("COMPLETE", "zsh"),
            ("_CLAP_COMPLETE_INDEX", "2"),
            ("_CLAP_IFS", "\n"),
        ],
    );

    let values: Vec<&str> = output
        .stdout
        .lines()
        .filter(|line| !line.starts_with('-'))
        .collect();
    assert_eq!(
        values,
        [
            "waiting:2026-10-10-waiting",
            "Q2:Question 2?",
            "notes:The round's notes"
        ],
        "{}",
        output.stderr
    );
}

#[test]
fn answer_offers_nothing_for_an_answered_round() {
    let repo = TestRepo::new();
    specs(&repo, PRIORITIES);
    feature(
        &repo,
        "2026-10-10-done-asking",
        &[
            ("proposal.md", proposal()),
            (
                "clarifications-01.md",
                clarifications("answered", "Answered on 2026-10-10.", &["A"]),
            ),
        ],
    );
    repo.switch("2026-10-10-done-asking");

    assert_eq!(
        values(complete(&repo, &["answer", ""])),
        Vec::<String>::new()
    );
}

#[test]
fn clean_completes_merged_features_with_a_branch_left() {
    let repo = TestRepo::new();
    specs(&repo, PRIORITIES);
    feature(&repo, "2026-10-10-cli-core", &[("proposal.md", proposal())]);
    feature(&repo, "2026-10-01-old", &[("proposal.md", proposal())]);
    finish_and_merge(&repo, "2026-10-01-old");

    assert_eq!(values(complete(&repo, &["clean", ""])), ["old"]);
}

#[test]
fn completion_never_asks_github() {
    let repo = TestRepo::new();
    specs(&repo, PRIORITIES);
    feature(&repo, "2026-10-10-cli-core", &[("proposal.md", proposal())]);
    let bin = repo.parent().join("bin");
    std::fs::create_dir(&bin).unwrap();
    let asked = repo.parent().join("gh-asked");
    let gh = bin.join("gh");
    std::fs::write(&gh, format!("#!/bin/sh\ntouch {}\n", asked.display())).unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&gh, std::fs::Permissions::from_mode(0o755)).unwrap();
    }
    let path = format!(
        "{}:{}",
        bin.display(),
        std::env::var("PATH").unwrap_or_default()
    );

    let candidates = complete_in(repo.path(), &["next", ""], &[("PATH", &path)]);

    assert_eq!(values(candidates), ["cli-core"]);
    assert!(!asked.exists(), "completion ran gh");
}

#[test]
fn outside_a_repository_values_are_empty() {
    let folder = tempfile::TempDir::new().unwrap();

    assert_eq!(
        values(complete_in(folder.path(), &["start", ""], &[])),
        Vec::<String>::new()
    );
}
