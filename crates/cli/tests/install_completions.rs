mod common;

use std::fs;
use std::path::Path;

use common::*;

const FISH_FILE: &str = ".config/fish/completions/ura.fish";
const FISH_LINE: &str = "COMPLETE=fish ura | source\n";

/// Runs `ura install` in `shell`, with the configuration folder in the repository's home folder.
fn install(repo: &TestRepo, shell: &str, args: &[&str]) -> Output {
    let home = repo.home();
    let config = home.join(".config");
    let mut all = vec!["install"];
    all.extend_from_slice(args);
    ura_in(
        repo.path(),
        &all,
        &[
            ("HOME", home.to_str().unwrap()),
            ("XDG_CONFIG_HOME", config.to_str().unwrap()),
            ("SHELL", shell),
        ],
    )
}

fn assert_no_skill(home: &Path) {
    assert!(!home.join(".agents").exists());
    assert!(!home.join(".claude").exists());
}

#[test]
fn in_fish_writes_the_completion_file_alone() {
    let repo = TestRepo::new();

    let output = install(&repo, "/usr/bin/fish", &["--completions"]);

    assert_eq!(
        output.stdout,
        format!("created ~/{FISH_FILE}\n"),
        "{}",
        output.stderr
    );
    assert_eq!(
        fs::read_to_string(repo.home().join(FISH_FILE)).unwrap(),
        FISH_LINE
    );
    assert_no_skill(&repo.home());
    assert_eq!(output.code, 0);
}

#[test]
fn in_fish_follows_xdg_config_home() {
    let repo = TestRepo::new();
    let xdg = repo.home().join("xdg");

    let output = ura_in(
        repo.path(),
        &["install", "--completions"],
        &[
            ("HOME", repo.home().to_str().unwrap()),
            ("XDG_CONFIG_HOME", xdg.to_str().unwrap()),
            ("SHELL", "fish"),
        ],
    );

    assert_eq!(output.stdout, "created ~/xdg/fish/completions/ura.fish\n");
    assert_eq!(
        fs::read_to_string(xdg.join("fish/completions/ura.fish")).unwrap(),
        FISH_LINE
    );
}

#[test]
fn in_fish_run_again_keeps_the_file() {
    let repo = TestRepo::new();
    install(&repo, "fish", &["--completions"]);

    let output = install(&repo, "fish", &["--completions"]);

    assert_eq!(output.stdout, format!("kept    ~/{FISH_FILE}\n"));
    assert_eq!(output.code, 0);
}

#[test]
fn in_fish_never_overwrites_a_file_of_the_user() {
    let repo = TestRepo::new();
    let file = repo.home().join(FISH_FILE);
    fs::create_dir_all(file.parent().unwrap()).unwrap();
    fs::write(&file, "complete -c ura -f\n").unwrap();

    let output = install(&repo, "fish", &["--completions"]);

    assert_eq!(
        output.stdout,
        format!(
            "kept    ~/{FISH_FILE}: not written by ura, add `{}` to it\n",
            FISH_LINE.trim()
        )
    );
    assert_eq!(fs::read_to_string(&file).unwrap(), "complete -c ura -f\n");
    assert_eq!(output.code, 0);
}

#[test]
fn in_zsh_names_the_line_to_add_and_writes_nothing() {
    let repo = TestRepo::new();

    let output = install(&repo, "/bin/zsh", &["--completions"]);

    assert_eq!(
        output.stdout,
        "note    Tab completion in zsh: add `source <(COMPLETE=zsh ura)` to ~/.zshrc, after compinit\n"
    );
    assert!(!repo.home().join(".zshrc").exists());
    assert_eq!(entries(&repo.home()), 0);
    assert_eq!(output.code, 0);
}

#[test]
fn in_another_shell_says_which_ones_it_sets_up() {
    let repo = TestRepo::new();

    let output = install(&repo, "/bin/bash", &["--completions"]);

    assert_eq!(
        output.stdout,
        "note    Tab completion: ura sets it up in fish and zsh, not in bash\n"
    );
    assert_eq!(entries(&repo.home()), 0);
    assert_eq!(output.code, 0);
}

#[test]
fn with_the_skill_flags_installs_both() {
    let repo = TestRepo::new();

    let output = install(&repo, "fish", &["--user", "--agents", "--completions"]);

    assert_eq!(
        output.stdout,
        format!(
            "created ~/.agents/skills/uraeda/ ({} files)\ncreated ~/{FISH_FILE}\n",
            skill_files()
        ),
        "{}",
        output.stderr
    );
    assert!(repo.home().join(FISH_FILE).is_file());
}

#[test]
fn without_the_flag_no_terminal_sets_nothing_up() {
    let repo = TestRepo::new();

    let output = install(&repo, "fish", &["--user", "--agents"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert!(!repo.home().join(FISH_FILE).exists());
}

fn entries(dir: &Path) -> usize {
    fs::read_dir(dir).map_or(0, |entries| entries.count())
}
