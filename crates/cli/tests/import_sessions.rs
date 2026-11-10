mod common;

use std::fs;
use std::path::Path;

use common::*;

/// `ura import-sessions` in a folder, with `data` as the earlier server's data folder: the new
/// server's is then `data` with `-next` after its name.
fn import(dir: &Path, data: &Path, args: &[&str]) -> Output {
    let mut all = vec!["import-sessions"];
    all.extend_from_slice(args);
    ura_in(dir, &all, &[("URAEDA_DATA_DIR", data.to_str().unwrap())])
}

// The contract between `ura import-sessions` and the two servers' data folders: by default it
// reads the earlier server's, writes the new server's, and a second run imports nothing.
#[test]
fn import_sessions_copies_the_earlier_servers_sessions_once() {
    let home = tempfile::TempDir::new().unwrap();
    let old = home.path().join("data");
    let new = home.path().join("data-next");
    fs::create_dir(&old).unwrap();
    fs::copy(fixture("runner/old.sqlite"), old.join("runner.sqlite")).unwrap();
    let before = fs::read(old.join("runner.sqlite")).unwrap();

    let first = import(home.path(), &old, &[]);

    assert_eq!(first.stderr, "");
    assert_eq!(
        first.stdout,
        format!(
            "Imported 4 sessions, 9 turns, and 40 events from {} into {}.\n\
             3 turns of the earlier server were at work, waiting, or cut by its stop: they are \
             stopped here, as that server may still run them.\n\
             1 run waited to continue by itself there: here it waits for you.\n",
            old.join("runner.sqlite").display(),
            new.join("sessions.sqlite").display()
        )
    );
    assert_eq!(first.code, 0);
    assert!(new.join("sessions.sqlite").exists());
    assert_eq!(fs::read(old.join("runner.sqlite")).unwrap(), before);

    // A second run imports nothing, and says how to start again.
    let second = import(home.path(), &old, &[]);
    assert_eq!(
        second.stderr,
        "ura: the store already holds 4 sessions: nothing was imported. With --replace, they are \
         removed, and the earlier server's sessions are imported in their place\n"
    );
    assert_eq!((second.stdout.as_str(), second.code), ("", 1));

    let replaced = import(home.path(), &old, &["--replace"]);
    assert_eq!((replaced.stdout, replaced.code), (first.stdout, 0));

    // Each folder can be named: a relative one joins the current folder.
    let named = import(
        home.path(),
        &old,
        &["--from", "data", "--data-dir", "elsewhere"],
    );
    assert_eq!(named.code, 0, "{}", named.stderr);
    assert!(home.path().join("elsewhere/sessions.sqlite").exists());

    // A folder without the earlier server's store has nothing to import.
    let none = import(home.path(), &old, &["--from", "elsewhere"]);
    assert_eq!(
        none.stderr,
        format!(
            "ura: {} holds no runner.sqlite: there are no sessions to import\n",
            home.path().join("elsewhere").display()
        )
    );
    assert_eq!(none.code, 1);
}
