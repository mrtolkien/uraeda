//! Waking a session, against a fake `t3` program: a script that prints canned JSON and records
//! what it is sent.

use std::path::{Path, PathBuf};

use uraeda_serve::config::Wake;
use uraeda_serve::wake::{Woken, message, wake_blocking};

#[test]
fn the_message_is_one_sentence() {
    assert_eq!(
        message("The human answered round 01 of recurring-tasks"),
        "The human answered round 01 of recurring-tasks: continue."
    );
    assert_eq!(message("Approved."), "Approved: continue.");
}

#[test]
fn a_missing_program_fails_plainly() {
    let how = Wake::T3 {
        program: PathBuf::from("/nonexistent/t3"),
    };
    let woken = wake_blocking(&how, Path::new("/m"), Path::new("/m"), "x");
    let Woken::Failed(text) = woken else {
        panic!("{woken:?}")
    };
    assert!(text.contains("not found"), "{text}");
}

#[cfg(unix)]
mod script {
    use super::*;
    use std::os::unix::fs::PermissionsExt;

    struct Fake {
        dir: tempfile::TempDir,
        main: PathBuf,
        tree: PathBuf,
    }

    /// `threads` are (id, title, settled, updatedAt, worktreePath), where `MAIN` and `TREE` in the
    /// path stand for the two folders.
    fn fake(threads: &[(&str, &str, bool, &str, Option<&str>)]) -> Fake {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().canonicalize().unwrap();
        let main = root.join("main");
        let tree = root.join("tree");
        std::fs::create_dir_all(&main).unwrap();
        std::fs::create_dir_all(&tree).unwrap();
        let list: Vec<String> = threads
            .iter()
            .map(|(id, title, settled, at, _)| {
                format!(
                    r#"{{"threadId":"{id}","title":"{title}","settled":{settled},"updatedAt":"{at}"}}"#
                )
            })
            .collect();
        std::fs::write(root.join("list.json"), format!("[{}]", list.join(","))).unwrap();
        for (id, _, _, _, path) in threads {
            let path = match path {
                Some(p) => format!(
                    "\"{}\"",
                    p.replace("MAIN", main.to_str().unwrap())
                        .replace("TREE", tree.to_str().unwrap())
                ),
                None => "null".into(),
            };
            std::fs::write(
                root.join(format!("show-{id}.json")),
                format!(r#"{{"thread":{{"threadId":"{id}","worktreePath":{path}}}}}"#),
            )
            .unwrap();
        }
        let script = format!(
            r#"#!/bin/sh
d='{d}'
if [ "$1 $2" = "thread list" ]; then cat "$d/list.json"
elif [ "$1 $2" = "thread show" ]; then cat "$d/show-$4.json"
elif [ "$1 $2" = "thread send" ]; then printf '%s|%s\n' "$3" "$4" >> "$d/sent"
else exit 2; fi
"#,
            d = root.display()
        );
        let program = root.join("t3");
        std::fs::write(&program, script).unwrap();
        std::fs::set_permissions(&program, std::fs::Permissions::from_mode(0o755)).unwrap();
        Fake { dir, main, tree }
    }

    impl Fake {
        fn wake(&self, worktree: &Path) -> Woken {
            let how = Wake::T3 {
                program: self.dir.path().join("t3"),
            };
            wake_blocking(&how, &self.main, worktree, "hello: continue.")
        }

        fn sent(&self) -> String {
            std::fs::read_to_string(self.dir.path().join("sent")).unwrap_or_default()
        }
    }

    #[test]
    fn a_thread_in_the_worktree_is_told() {
        let f = fake(&[
            ("a", "Other", false, "2026-01-02", Some("MAIN")),
            ("b", "Mine", false, "2026-01-01", Some("TREE")),
        ]);
        assert_eq!(
            f.wake(&f.tree),
            Woken::Told {
                title: "Mine".into()
            }
        );
        assert_eq!(f.sent(), "b|hello: continue.\n");
    }

    #[test]
    fn no_session_when_none_matches() {
        let f = fake(&[("a", "Other", false, "2026-01-02", Some("MAIN"))]);
        assert_eq!(f.wake(&f.tree), Woken::NoSession);
        assert_eq!(f.sent(), "");
    }

    #[test]
    fn settled_threads_are_skipped() {
        let f = fake(&[("a", "Done", true, "2026-01-02", Some("TREE"))]);
        assert_eq!(f.wake(&f.tree), Woken::NoSession);
        assert_eq!(f.sent(), "");
    }

    #[test]
    fn the_newest_matching_thread_is_told() {
        let f = fake(&[
            ("old", "Old", false, "2026-01-01", Some("TREE")),
            ("new", "New", false, "2026-01-05", Some("TREE")),
        ]);
        assert_eq!(
            f.wake(&f.tree),
            Woken::Told {
                title: "New".into()
            }
        );
        assert_eq!(f.sent(), "new|hello: continue.\n");
    }

    #[test]
    fn the_main_checkout_matches_a_null_worktree() {
        let f = fake(&[("a", "In main", false, "2026-01-02", None)]);
        assert_eq!(
            f.wake(&f.main),
            Woken::Told {
                title: "In main".into()
            }
        );
        assert_eq!(f.sent(), "a|hello: continue.\n");
        // A null worktree is not a thread of another worktree.
        let f = fake(&[("a", "In main", false, "2026-01-02", None)]);
        assert_eq!(f.wake(&f.tree), Woken::NoSession);
    }

    #[test]
    fn an_unreadable_answer_is_a_failure() {
        let f = fake(&[]);
        std::fs::write(f.dir.path().join("list.json"), "not json").unwrap();
        assert!(matches!(f.wake(&f.tree), Woken::Failed(_)));
    }
}
