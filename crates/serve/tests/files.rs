//! A feature's files: a markdown file drawn, a mockup served in a sandbox with the picker, and a
//! path that leaves the checkout refused.

mod support;

use support::Server;
use support::repo::{FOLDER, fixture, settings};

fn round() -> String {
    "---\nstatus: awaiting-human\n---\n\n# Clarifications, round 01: Recurring tasks\n".into()
}

#[test]
fn a_mockup_is_served_in_a_sandbox_with_the_picker() {
    let f = fixture(&[
        ("clarifications-01.md", round()),
        (
            "mockups-menu.html",
            "<html><body><button>Weekly</button></body></html>".into(),
        ),
    ]);
    let server = Server::with(settings(&f));
    let answer = server.get(&format!(
        "/{}/todo/{FOLDER}/raw/specs/{FOLDER}/mockups-menu.html",
        server.token
    ));
    assert_eq!(answer.status(), 200);
    let policy = answer
        .headers()
        .get("content-security-policy")
        .unwrap()
        .to_str()
        .unwrap()
        .to_string();
    assert!(policy.starts_with("sandbox allow-scripts"), "{policy}");
    assert!(!policy.contains("allow-same-origin"));
    let page = answer.into_body().read_to_string().unwrap();
    assert!(page.contains("<button>Weekly</button>"));
    assert!(page.contains("uraeda: \"picked\""), "the picker is added");
    assert!(page.find("<script>").unwrap() < page.find("</body>").unwrap());
}

#[test]
fn a_markdown_file_is_drawn_and_a_path_out_of_the_checkout_is_refused() {
    let f = fixture(&[("clarifications-01.md", round())]);
    let server = Server::with(settings(&f));
    let page = server.get(&format!(
        "/{}/todo/{FOLDER}/file/specs/{FOLDER}/proposal.md",
        server.token
    ));
    assert_eq!(page.status(), 200);
    let body = page.into_body().read_to_string().unwrap();
    assert!(body.contains("Recurring tasks"), "{body}");
    for path in [
        "../todo/specs/PRIORITIES.md",
        "specs/../../todo/specs/PRIORITIES.md",
        "nope.md",
    ] {
        let answer = server.get(&format!("/{}/todo/{FOLDER}/raw/{path}", server.token));
        assert_eq!(answer.status(), 404, "{path}");
    }
}
