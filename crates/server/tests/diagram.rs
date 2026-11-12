//! `POST /diagram`: the picture of a diagram for the app in a browser, which draws none itself.

use crate::support;

use serde_json::json;

#[tokio::test]
async fn a_diagram_is_drawn_for_a_signed_in_browser_and_a_broken_one_says_why() {
    let server = support::server().await;
    let asked = json!({
        "source": "flowchart LR\n  A[Proposal] --> B[Spec]",
        "colours": [{ "name": "primaryColor", "value": "#ffdca0" }],
    });

    // Closed, as every route.
    let refused = server.post("/diagram").json(&asked).send().await;
    assert_eq!(refused.status, 401, "{}", refused.text());

    let cookie = server.sign_in().await;
    let drawn = server
        .post("/diagram")
        .cookie(&cookie)
        .json(&asked)
        .send()
        .await;
    assert_eq!(drawn.status, 200, "{}", drawn.text());
    let picture = drawn.json();
    let src = picture["src"].as_str().expect("an address");
    assert!(src.starts_with("data:image/svg+xml"), "{src:.40}");
    assert!(picture["width"].as_f64().unwrap() > 0.0, "{picture}");

    // What Merman cannot read comes back in its words, for the app to show the source.
    let broken = json!({ "source": "flowchart LR\n  A -->", "colours": [] });
    let failed = server
        .post("/diagram")
        .cookie(&cookie)
        .json(&broken)
        .send()
        .await;
    assert_eq!(failed.status, 422, "{}", failed.text());
    assert!(
        failed.json()["error"]
            .as_str()
            .is_some_and(|words| !words.is_empty())
    );

    server.stop().await;
}
