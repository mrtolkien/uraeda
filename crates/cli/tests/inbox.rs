//! `ura inbox`: the inbox of the default branch, by category, agents' note files included.

mod common;

use common::*;

/// A repository with an `INBOX.md` of one note under "Deferred fixes", and an agent's note file
/// about `feature-state` under the same category that no line of `INBOX.md` links.
fn repo() -> TestRepo {
    let repo = TestRepo::new();
    specs(
        &repo,
        "# Priorities\n\n## Now\n\n## Next\n\n## Later\n\n## Blocked\n",
    );
    repo.write(
        "specs/INBOX.md",
        "# Inbox\n\n## Deferred fixes\n\n- Human's note\n",
    );
    repo.write(
        "specs/notes/feature-state-the-workspace-record.md",
        "---\nagent: true\nabout: feature-state\ncategory: Deferred fixes\n---\n\n\
         # The workspace record's `running` is read by no view\n\n\
         Remove it, or name what reads it.\n",
    );
    repo.commit("chore: inbox and an agent's note");
    repo
}

/// US2, key scenario 3: once an agent's note is merged, `ura inbox` prints each category's
/// name, then its notes, an agent's note file with its marks and its title as plain text.
#[test]
fn ura_inbox_prints_the_notes_by_category() {
    let repo = repo();

    let output = ura(&repo, &["inbox"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert!(
        output.stdout.contains(
            "Deferred fixes\n- Human's note\n\
             - [agent] [feature-state] The workspace record's running is read by no view\n"
        ),
        "{}",
        output.stdout
    );
}

/// US2, more scenario 7: `--json` prints each note with its category, text, marks, and file, with
/// the version.
#[test]
fn ura_inbox_json_gives_a_note_file_its_marks_and_path() {
    let repo = repo();

    let output = ura(&repo, &["inbox", "--json"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    let json: serde_json::Value = serde_json::from_str(&output.stdout).expect("JSON");
    assert_eq!(json["version"], 1);
    let notes = json["notes"].as_array().expect("notes");
    let human = &notes[0];
    assert_eq!(human["category"], "Deferred fixes");
    assert_eq!(human["agent"], false);
    assert_eq!(human["about"], serde_json::Value::Null);
    assert_eq!(human["file"], serde_json::Value::Null);
    let agent = &notes[1];
    assert_eq!(agent["category"], "Deferred fixes");
    assert_eq!(agent["agent"], true);
    assert_eq!(agent["about"], "feature-state");
    assert_eq!(
        agent["file"],
        "specs/notes/feature-state-the-workspace-record.md"
    );
}
