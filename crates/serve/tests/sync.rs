//! The vault's sync, as the phone's plugin uses it: a plan from both sides, then reads, writes, and
//! deletions that refuse a file changed on the desktop, git's files, and a page of another site.

mod support;

use serde_json::{Value, json};
use support::Server;
use support::repo::{FOLDER, fixture, settings};
use uraeda_vault::Vault;
use uraeda_vault::manifest::hash_bytes;

fn plan(server: &Server, files: Value, base: Value) -> Vec<Value> {
    let body = json!({ "files": files, "base": base, "stamp": "2026-11-14 1630" });
    let (status, bytes) = server.plugin("POST", "/vault/plan", body.to_string().as_bytes());
    assert_eq!(status, 200, "{}", String::from_utf8_lossy(&bytes));
    let answer: Value = serde_json::from_slice(&bytes).unwrap();
    answer["actions"].as_array().unwrap().clone()
}

#[test]
fn a_first_sync_pulls_the_notes_and_the_repositorys_files() {
    let repo = fixture(&[]);
    let dir = tempfile::tempdir().unwrap();
    let vault = Vault::new(dir.path().join("Uraeda"));
    std::fs::create_dir_all(vault.root().join("inbox")).unwrap();
    std::fs::write(vault.root().join("inbox/a.md"), "a").unwrap();
    let server = Server::syncing(settings(&repo), vault.clone());
    let actions = plan(&server, json!({}), json!({}));
    let pulled: Vec<&str> = actions
        .iter()
        .map(|a| a["path"].as_str().unwrap())
        .collect();
    let proposal = format!("projects/todo/specs/{FOLDER}/proposal.md");
    assert_eq!(
        pulled,
        [
            ".obsidian/plugins/uraeda/main.js",
            ".obsidian/plugins/uraeda/manifest.json",
            "inbox/a.md",
            "projects/todo/Board.base",
            proposal.as_str()
        ]
    );
    assert!(actions.iter().all(|a| a["do"] == "pull"));
    assert!(vault.root().join("wiki/gotchas").is_dir());
    assert!(vault.root().join("projects/todo/proposals").is_dir());

    let (status, bytes) = server.plugin("GET", &format!("/vault/file?path={}", proposal), b"");
    assert_eq!(
        (status, bytes.as_slice()),
        (200, b"# Recurring tasks\n".as_slice())
    );
}

#[test]
fn writes_hold_to_what_the_phone_expects() {
    let dir = tempfile::tempdir().unwrap();
    let vault = Vault::new(dir.path().join("Uraeda"));
    let server = Server::syncing(Default::default(), vault.clone());
    let file = |path: &str, expect: &str| format!("/vault/file?path={path}&expect={expect}");
    assert_eq!(server.plugin("PUT", &file("inbox/n.md", ""), b"one").0, 200);
    assert_eq!(
        std::fs::read(vault.root().join("inbox/n.md")).unwrap(),
        b"one"
    );
    // Written on the phone over an older version: refused, and the next plan keeps both.
    assert_eq!(server.plugin("PUT", &file("inbox/n.md", ""), b"two").0, 409);
    let one = hash_bytes(b"one");
    assert_eq!(
        server.plugin("PUT", &file("inbox/n.md", &one), b"two").0,
        200
    );
    assert_eq!(
        server.plugin("DELETE", &file("inbox/n.md", &one), b"").0,
        409
    );
    let two = hash_bytes(b"two");
    assert_eq!(
        server.plugin("DELETE", &file("inbox/n.md", &two), b"").0,
        200
    );
    assert_eq!(
        std::fs::read(vault.root().join(".trash/inbox/n.md")).unwrap(),
        b"two"
    );

    for refused in [
        "projects/todo/specs/spec.md",
        ".obsidian/plugins/uraeda/main.js",
        "../x.md",
    ] {
        assert_eq!(
            server.plugin("PUT", &file(refused, ""), b"x").0,
            403,
            "{refused}"
        );
    }
    assert_eq!(server.plugin("GET", &file("../etc/passwd", ""), b"").0, 404);
}

#[cfg(unix)]
#[test]
fn a_write_or_a_deletion_never_goes_through_a_link() {
    let dir = tempfile::tempdir().unwrap();
    let outside = dir.path().join("outside");
    std::fs::create_dir(&outside).unwrap();
    std::fs::write(outside.join("kept.md"), "kept").unwrap();
    let vault = Vault::new(dir.path().join("Uraeda"));
    let server = Server::syncing(Default::default(), vault.clone());
    std::fs::create_dir_all(vault.root().join("inbox")).unwrap();
    std::os::unix::fs::symlink(&outside, vault.root().join("inbox/alias")).unwrap();
    let file = |path: &str, expect: &str| format!("/vault/file?path={path}&expect={expect}");
    let kept = hash_bytes(b"kept");
    assert_eq!(
        server
            .plugin("PUT", &file("inbox/alias/new.md", ""), b"x")
            .0,
        403
    );
    assert_eq!(
        server
            .plugin("PUT", &file("inbox/alias/kept.md", &kept), b"x")
            .0,
        403
    );
    assert_eq!(
        server
            .plugin("DELETE", &file("inbox/alias/kept.md", &kept), b"")
            .0,
        403
    );
    assert!(!outside.join("new.md").exists());
    assert_eq!(std::fs::read(outside.join("kept.md")).unwrap(), b"kept");
}

#[test]
fn a_write_without_the_bearer_or_the_pages_origin_is_refused() {
    let dir = tempfile::tempdir().unwrap();
    let server = Server::syncing(Default::default(), Vault::new(dir.path()));
    let path = "/vault/plan".to_string();
    let response = server.post(
        &path,
        &[("origin", "https://evil.example")],
        "{\"files\":{}}",
    );
    assert_eq!(response.status().as_u16(), 403);
    let response = server.post(&path, &[], "{\"files\":{}}");
    assert_eq!(response.status().as_u16(), 403);
    // The bearer opens the sync's routes only.
    let (status, _) = server.plugin("POST", "/settings/serve", b"");
    assert_eq!(status, 403);
}

#[test]
fn a_phone_of_another_vault_merges_instead_of_deleting() {
    let dir = tempfile::tempdir().unwrap();
    let vault = Vault::new(dir.path().join("Uraeda"));
    std::fs::create_dir_all(vault.root().join("inbox")).unwrap();
    std::fs::write(vault.root().join("inbox/a.md"), "a").unwrap();
    let server = Server::syncing(Default::default(), vault.clone());
    let base = json!({ "inbox/a.md": hash_bytes(b"a") });
    let body =
        |id: &str| json!({ "files": {}, "base": base, "stamp": "s", "vault": id }).to_string();
    let path = "/vault/plan".to_string();
    let (_, bytes) = server.plugin("POST", &path, body("another").as_bytes());
    let answer: Value = serde_json::from_slice(&bytes).unwrap();
    let id = answer["vault"].as_str().unwrap().to_string();
    let actions = answer["actions"].as_array().unwrap();
    assert!(
        actions
            .iter()
            .any(|a| a["do"] == "pull" && a["path"] == "inbox/a.md")
    );
    // The same vault: the base holds, and the phone deleted the note.
    let (_, bytes) = server.plugin("POST", &path, body(&id).as_bytes());
    let answer: Value = serde_json::from_slice(&bytes).unwrap();
    assert!(
        answer["actions"]
            .as_array()
            .unwrap()
            .iter()
            .any(|a| a["do"] == "trash-remote")
    );
    assert!(
        answer["folders"]
            .as_array()
            .unwrap()
            .iter()
            .any(|f| f == "inbox")
    );
}
