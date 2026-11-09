mod common;

use std::collections::BTreeMap;

use common::repo::TestRepo;
use common::texts::{clarifications, plan, proposal, record, spec};
use uraeda_core::behind;
use uraeda_core::git::Git;
use uraeda_core::pulls::{self, PullRequestState, PullRequestView, PullRequests};
use uraeda_core::steps::{CatchUp, StepName};
use uraeda_core::workspace::{Feature, Kind};

/// A row of `gh pr list --json headRefName,headRefOid,number,url,isDraft,reviewDecision`, its head
/// the number's digit repeated.
fn row(branch: &str, number: u32, draft: bool, decision: &str) -> String {
    let head = head(number);
    format!(
        r#"{{"headRefName":"{branch}","headRefOid":"{head}","number":{number},"url":"https://github.com/o/r/pull/{number}","isDraft":{draft},"reviewDecision":"{decision}"}}"#
    )
}

/// The head of pull request `number`, in the rows: its last digit, 40 times.
fn head(number: u32) -> String {
    (number % 10).to_string().repeat(40)
}

fn view(number: u32, state: PullRequestState) -> PullRequestView {
    PullRequestView {
        number,
        url: format!("https://github.com/o/r/pull/{number}"),
        state,
        head: head(number),
    }
}

/// US1.2 to US1.4, review focus 2: changes requested win over a proposal file, and each row is kept
/// by its own branch name.
#[test]
fn parse_rows() {
    let rows = [
        (
            "a draft",
            format!("[{}]", row("2026-10-20-x", 31, true, "")),
            Some(vec![("2026-10-20-x", view(31, PullRequestState::Draft))]),
        ),
        (
            "an open one",
            format!("[{}]", row("2026-10-20-x", 31, false, "REVIEW_REQUIRED")),
            Some(vec![("2026-10-20-x", view(31, PullRequestState::Open))]),
        ),
        (
            "changes requested on a draft",
            format!("[{}]", row("2026-10-20-x", 31, true, "CHANGES_REQUESTED")),
            Some(vec![(
                "2026-10-20-x",
                view(31, PullRequestState::ChangesRequested),
            )]),
        ),
        ("an empty list", "[]".to_string(), Some(vec![])),
        ("invalid JSON", "not json".to_string(), None),
        (
            "another branch's row",
            format!(
                "[{},{}]",
                row("2026-10-20-other", 7, false, ""),
                row("2026-10-20-x", 31, true, "")
            ),
            Some(vec![
                ("2026-10-20-other", view(7, PullRequestState::Open)),
                ("2026-10-20-x", view(31, PullRequestState::Draft)),
            ]),
        ),
    ];
    for (name, json, expected) in rows {
        let expected: Option<BTreeMap<String, PullRequestView>> = expected.map(|rows| {
            rows.into_iter()
                .map(|(branch, view)| (branch.to_string(), view))
                .collect()
        });

        assert_eq!(pulls::parse(json.as_bytes()), expected, "{name}");
    }
}

/// A failed `gh` keeps the last known pull requests for up to 10 minutes, then gives them up.
#[test]
fn a_failed_fetch_keeps_the_last_snapshot_for_ten_minutes() {
    let root = std::path::PathBuf::from("/tmp/uraeda-pulls-settle-test");
    let start = std::time::SystemTime::UNIX_EPOCH + std::time::Duration::from_secs(1_000_000);
    let minutes = |n: u64| start + std::time::Duration::from_secs(60 * n);
    let known = PullRequests::open([("b".to_string(), view(31, PullRequestState::Open))]);

    assert!(pulls::settle(&root, known.clone(), start));
    assert!(!pulls::settle(&root, PullRequests::Unavailable, minutes(9)));
    assert_eq!(pulls::latest(&root), known);
    assert!(pulls::settle(&root, PullRequests::Unavailable, minutes(11)));
    assert_eq!(pulls::latest(&root), PullRequests::Unavailable);
}

/// Review: a failed call for the merged pull requests keeps the open ones, with the merged ones
/// last known, or none; a failed call for the open ones gives nothing.
#[test]
fn a_failed_merged_call_keeps_the_open_pull_requests() {
    let open = || {
        Some(BTreeMap::from([(
            "b".to_string(),
            view(31, PullRequestState::Open),
        )]))
    };
    let last = merged(&head(7));
    let PullRequests::Known { merged: before, .. } = &last else {
        unreachable!()
    };
    let rows = [
        ("last known", &last, before.clone()),
        ("none known", &PullRequests::Unavailable, BTreeMap::new()),
    ];
    for (name, last, merged) in rows {
        let expected = PullRequests::Known {
            open: open().unwrap(),
            merged,
        };

        assert_eq!(pulls::known(open(), None, last), expected, "{name}");
    }
    assert_eq!(
        pulls::known(None, Some(BTreeMap::new()), &last),
        PullRequests::Unavailable
    );
}

/// The head of the merged pull request #75 of the test feature's branch.
fn merged(head: &str) -> PullRequests {
    let json = format!(
        r#"[{{"headRefName":"2026-10-10-x","headRefOid":"{head}","number":75,"url":"https://github.com/o/r/pull/75"}}]"#
    );
    PullRequests::Known {
        open: BTreeMap::new(),
        merged: pulls::parse_merged(json.as_bytes()).unwrap(),
    }
}

/// The test feature's branch, `parent` then `tip`: the two commits' hashes.
fn branch(repo: &TestRepo) -> (String, String) {
    branch_named(repo, "2026-10-10-x")
}

/// A branch of `name`, `parent` then `tip`: the two commits' hashes.
fn branch_named(repo: &TestRepo, name: &str) -> (String, String) {
    let head = || repo.git(&["rev-parse", "HEAD"]).trim().to_string();
    repo.switch_new(name);
    repo.write("a.md", "a\n");
    repo.commit("feat: the work");
    let parent = head();
    repo.write("b.md", "b\n");
    repo.commit("feat: more work");
    let tip = head();
    repo.switch("main");
    (parent, tip)
}

/// US5 more 1: a pull request merged on GitHub whose head is the branch's latest commit makes its
/// feature done, without a fetch; one whose head lacks it leaves the feature's step as it is. A head
/// never fetched counts as merged when the branch has nothing unpushed (R2).
#[test]
fn a_merged_pull_request_holding_the_tip_makes_the_feature_done() {
    let repo = TestRepo::new();
    let (parent, tip) = branch(&repo);
    let git = Git::discover(repo.path()).unwrap();
    let rows = [
        ("its head is the tip", tip.clone(), None, StepName::Done),
        (
            "commits after its head",
            parent.clone(),
            None,
            StepName::Finish,
        ),
        (
            "its head never fetched, never pushed",
            head(7),
            None,
            StepName::Finish,
        ),
        (
            "its head never fetched, all pushed",
            head(7),
            Some(&tip),
            StepName::Done,
        ),
        (
            "its head never fetched, commits unpushed",
            head(7),
            Some(&parent),
            StepName::Finish,
        ),
    ];
    for (name, head, pushed, expected) in rows {
        let remote = "refs/remotes/origin/2026-10-10-x";
        match pushed {
            Some(commit) => repo.git(&["update-ref", remote, commit]),
            None => repo.git(&["update-ref", "-d", remote]),
        };
        let mut feature =
            Feature::from_record(Kind::Feature, "2026-10-10-x", record("feature", "X"));

        merged(&head).apply(&mut feature, &git);

        assert_eq!(feature.step.name, expected, "{name}");
    }
}

/// Review: an open pull request wins over a merged one of the same branch; a feature still being
/// built is not done by a merged pull request holding its tip; a change's branch ahead of its pull
/// request reaches Push, as a feature's does, until the branch is at its remote tip: then `gh` has
/// not seen the push yet, and the pull request waits on the human.
#[test]
fn an_open_pull_request_and_the_implementation_keep_their_steps() {
    let repo = TestRepo::new();
    let (_, tip) = branch(&repo);
    let (change_parent, change_tip) = branch_named(&repo, "change/2026-10-10-x");
    let git = Git::discover(repo.path()).unwrap();
    let open_on = |branch: &str, head: &str| {
        let mut view = view(31, PullRequestState::Open);
        view.head = head.to_string();
        BTreeMap::from([(branch.to_string(), view)])
    };
    let PullRequests::Known {
        merged: merged_tip, ..
    } = merged(&tip)
    else {
        unreachable!()
    };
    let texts = |files: Vec<(&str, String)>| {
        files
            .into_iter()
            .map(|(name, text)| (name.to_string(), text))
            .collect::<BTreeMap<_, _>>()
    };
    let answered = clarifications("answered", "Answered on 2026-10-08.", &["A"]);
    let building = texts(vec![
        ("proposal.md", proposal()),
        ("clarifications-01.md", answered),
        ("spec.md", spec("approved", 1, 1)),
        ("plan.md", plan("approved", 1, &[("One", 0, 2)])),
    ]);
    let rows = [
        (
            "open and merged",
            Feature::from_record(Kind::Feature, "2026-10-10-x", record("feature", "X")),
            PullRequests::Known {
                open: open_on("2026-10-10-x", &tip),
                merged: merged_tip.clone(),
            },
            StepName::PullRequest,
            None,
        ),
        (
            "still being built",
            Feature::from_texts(Kind::Feature, "2026-10-10-x", building),
            merged(&tip),
            StepName::Implementation,
            None,
        ),
        (
            "a change ahead of its pull request, pushed before",
            Feature::from_texts(
                Kind::Change,
                "2026-10-10-x",
                texts(vec![("proposal.md", proposal())]),
            ),
            PullRequests::Known {
                open: open_on("change/2026-10-10-x", &change_parent),
                merged: BTreeMap::new(),
            },
            StepName::Push,
            Some(&change_parent),
        ),
        (
            "a change ahead of its pull request, pushed",
            Feature::from_texts(
                Kind::Change,
                "2026-10-10-x",
                texts(vec![("proposal.md", proposal())]),
            ),
            PullRequests::Known {
                open: open_on("change/2026-10-10-x", &change_parent),
                merged: BTreeMap::new(),
            },
            StepName::PullRequest,
            Some(&change_tip),
        ),
    ];
    for (name, mut feature, pull_requests, expected, pushed) in rows {
        let remote = "refs/remotes/origin/change/2026-10-10-x";
        match pushed {
            Some(commit) => repo.git(&["update-ref", remote, commit]),
            None => repo.git(&["update-ref", "-d", remote]),
        };

        pull_requests.apply(&mut feature, &git);

        assert_eq!(feature.step.name, expected, "{name}");
    }
}

/// What the default branch gains after the test feature's branch started from it.
#[derive(Clone, Copy)]
enum Gain {
    /// `src/a.rs`, in a commit `feat: code`, pushed to `origin/main`.
    Code,
    /// A line of `specs/PRIORITIES.md`, and `specs/proposals/y.md` renamed to a started folder's
    /// `proposal.md`, as `chore(<slug>): start` does, pushed.
    OwnFiles,
    /// `specs/decisions/x.md`, in a commit `decision: x`, pushed.
    Decision,
    /// The code commit, pushed, then the branch rebased on it.
    CodeRebased,
    /// The code commit on the local `main` only, `origin/main` at the commit before.
    CodeLocalOnly,
    /// The code commit, the repository without `origin/main`.
    CodeNoRemote,
    /// The code commit, pushed, then merged into `origin/<branch>`, as GitHub's "Update branch"
    /// does, the local branch left where it was.
    CodeRemoteMerged,
    /// The code commit, pushed, merged into the branch, then a line of `specs/PRIORITIES.md`,
    /// pushed.
    CodeMergedThenOwn,
    /// `README.md` renamed to a note, in a commit `chore: note`, pushed.
    RenamedIntoNotes,
}

/// Makes `main` gain `gain` after `branch` started from it.
fn gain(repo: &TestRepo, branch: &str, gain: Gain) {
    let before = repo.git(&["rev-parse", "main"]).trim().to_string();
    match gain {
        Gain::OwnFiles => {
            repo.write("specs/PRIORITIES.md", "# Priorities\n\n## Now\n\n- Y\n");
            repo.remove("specs/proposals/y.md");
            repo.write("specs/2026-10-11-y/proposal.md", "# Y\n\nWhy y.\n");
            repo.commit("chore(y): start");
        }
        Gain::Decision => {
            repo.write("specs/decisions/x.md", "# X\n");
            repo.commit("decision: x");
        }
        Gain::RenamedIntoNotes => {
            repo.remove("README.md");
            repo.write("specs/notes/readme/note.md", "# Test\n");
            repo.commit("chore: note");
        }
        _ => {
            repo.write("src/a.rs", "fn a() {}\n");
            repo.commit("feat: code");
        }
    }
    match gain {
        Gain::CodeLocalOnly => {
            repo.git(&["update-ref", "refs/remotes/origin/main", &before]);
        }
        Gain::CodeNoRemote => {}
        _ => {
            repo.git(&["update-ref", "refs/remotes/origin/main", "main"]);
        }
    }
    match gain {
        Gain::CodeRebased => {
            repo.git(&["rebase", "--quiet", "main", branch]);
            repo.switch("main");
        }
        Gain::CodeRemoteMerged => {
            let local = repo.git(&["rev-parse", branch]).trim().to_string();
            repo.switch(branch);
            repo.git(&["merge", "--quiet", "--no-edit", "main"]);
            repo.switch("main");
            let remote = format!("refs/remotes/origin/{branch}");
            repo.git(&["update-ref", &remote, branch]);
            repo.git(&["update-ref", &format!("refs/heads/{branch}"), &local]);
        }
        Gain::CodeMergedThenOwn => {
            repo.switch(branch);
            repo.git(&["merge", "--quiet", "--no-edit", "main"]);
            repo.switch("main");
            repo.write("specs/PRIORITIES.md", "# Priorities\n\n## Now\n\n- Y\n");
            repo.commit("chore: prioritize");
            repo.git(&["update-ref", "refs/remotes/origin/main", "main"]);
        }
        _ => {}
    }
}

/// A row of the behind rule's table: its name, whether the branch is a change's, what main gains,
/// the pull request's head, with `{b}` for the branch, and the catch-up's reference and subject
/// when it catches up.
type BehindRow = (
    &'static str,
    bool,
    Gain,
    &'static str,
    Option<(&'static str, &'static str)>,
);

/// The rows of [`a_pull_request_behind_the_default_branch_catches_up`].
fn behind_rows() -> [BehindRow; 11] {
    let code = Some(("implementation", "feat: code"));
    [
        ("main gained code", false, Gain::Code, "{b}", code),
        (
            "only priorities and a started proposal",
            false,
            Gain::OwnFiles,
            "{b}",
            None,
        ),
        (
            "a decision",
            false,
            Gain::Decision,
            "{b}",
            Some(("implementation", "decision: x")),
        ),
        (
            "the branch holds main's tip",
            false,
            Gain::CodeRebased,
            "{b}",
            None,
        ),
        (
            "only the local default branch moved",
            false,
            Gain::CodeLocalOnly,
            "{b}",
            None,
        ),
        ("no remote", false, Gain::CodeNoRemote, "{b}", code),
        (
            "a change's branch",
            true,
            Gain::Code,
            "{b}",
            Some(("change", "feat: code")),
        ),
        (
            "behind and ahead of its pull request",
            false,
            Gain::Code,
            "{b}~1",
            code,
        ),
        (
            "origin's branch holds main's tip, the local one stale",
            false,
            Gain::CodeRemoteMerged,
            "origin/{b}",
            None,
        ),
        (
            "merged main, then main gained only priorities",
            false,
            Gain::CodeMergedThenOwn,
            "{b}",
            None,
        ),
        (
            "a file not main's own renamed into specs/notes/",
            false,
            Gain::RenamedIntoNotes,
            "{b}",
            Some(("implementation", "chore: note")),
        ),
    ]
}

/// US1 1 and 3, more 1 and 2; review focus 1 and 2; the edge cases without a remote and with a
/// local merge not pushed: an open pull request whose branch lacks the default branch's tip, and
/// whose missing commits change more than the default branch's own files, catches up; its step
/// names the commit to catch up with.
#[test]
fn a_pull_request_behind_the_default_branch_catches_up() {
    for (name, is_change, moved, head, catches_up) in behind_rows() {
        let repo = TestRepo::new();
        repo.write("specs/proposals/y.md", "# Y\n\nWhy y.\n");
        repo.commit("proposal(y): add");
        let branch = if is_change {
            "change/2026-10-10-x"
        } else {
            "2026-10-10-x"
        };
        branch_named(&repo, branch);
        gain(&repo, branch, moved);
        let rev = |revision: &str| repo.git(&["rev-parse", revision]).trim().to_string();
        let mut view = view(31, PullRequestState::Open);
        view.head = rev(&head.replace("{b}", branch));
        let mut feature = if is_change {
            let texts = BTreeMap::from([("proposal.md".to_string(), proposal())]);
            Feature::from_texts(Kind::Change, "2026-10-10-x", texts)
        } else {
            Feature::from_record(Kind::Feature, "2026-10-10-x", record("feature", "X"))
        };
        let git = Git::discover(repo.path()).unwrap();

        PullRequests::open([(branch.to_string(), view)]).apply(&mut feature, &git);

        let expected = match catches_up {
            Some(_) => StepName::CatchUp,
            None => StepName::PullRequest,
        };
        assert_eq!(feature.step.name, expected, "{name}");
        if let Some((reference, _)) = catches_up {
            let reference = format!("skills/uraeda/references/{reference}.md");
            assert_eq!(feature.step.reference, Some(reference), "{name}");
        }
        let catch_up = catches_up.map(|(_, subject)| CatchUp {
            branch: "main".to_string(),
            commit: rev("main"),
            subject: subject.to_string(),
        });
        assert_eq!(feature.step.catch_up, catch_up, "{name}");
    }
}

/// SC-005: reading again with the same branch tip and default branch's tip computes no diff; a new
/// default tip is read anew.
#[test]
fn behind_reads_once_per_pair_of_tips() {
    let repo = TestRepo::new();
    branch(&repo);
    repo.write("specs/PRIORITIES.md", "# Priorities\n");
    repo.commit("chore: prioritize");
    repo.git(&["update-ref", "refs/remotes/origin/main", "main"]);
    let git = Git::discover(repo.path()).unwrap();
    let before = behind::diffs();

    let own = behind::catch_up(&git, "2026-10-10-x");
    let own_again = behind::catch_up(&git, "2026-10-10-x");
    gain(&repo, "2026-10-10-x", Gain::Code);
    let code = behind::catch_up(&git, "2026-10-10-x");
    let code_again = behind::catch_up(&git, "2026-10-10-x");

    assert_eq!((own, own_again), (None, None));
    assert!(code.is_some());
    assert_eq!(code_again, code);
    assert_eq!(behind::diffs(), before + 2);
}

/// Review: a diff git could not read reads as not behind, and is read again next time, not kept.
#[test]
fn a_diff_git_cannot_read_is_not_kept() {
    let repo = TestRepo::new();
    branch(&repo);
    gain(&repo, "2026-10-10-x", Gain::Code);
    let tree = repo.git(&["rev-parse", "main:src"]).trim().to_string();
    let object = repo
        .path()
        .join(".git/objects")
        .join(&tree[..2])
        .join(&tree[2..]);
    let hidden = repo.path().join("hidden-object");
    std::fs::rename(&object, &hidden).unwrap();

    let unreadable = behind::catch_up(&Git::discover(repo.path()).unwrap(), "2026-10-10-x");
    std::fs::rename(&hidden, &object).unwrap();
    let readable = behind::catch_up(&Git::discover(repo.path()).unwrap(), "2026-10-10-x");

    assert_eq!(unreadable, None);
    assert!(readable.is_some());
}

/// Review: a `proposal.md` is the default branch's own only in a started folder, a feature's or a
/// change's, which the start renames from `specs/proposals/`; not in another folder of `specs/`.
#[test]
fn only_a_started_folders_proposal_is_the_default_branchs_own() {
    let rows = [
        ("a feature's", "specs/2026-10-11-y/proposal.md", true),
        ("a change's", "specs/changes/2026-10-11-y/proposal.md", true),
        ("in the decisions", "specs/decisions/proposal.md", false),
        ("in the UI guides", "specs/ui/proposal.md", false),
        (
            "an undated folder's change",
            "specs/changes/y/proposal.md",
            false,
        ),
        (
            "in a feature's subfolder",
            "specs/2026-10-11-y/x/proposal.md",
            false,
        ),
    ];
    for (name, path, own) in rows {
        assert_eq!(behind::default_branch_own(path), own, "{name}");
    }
}
