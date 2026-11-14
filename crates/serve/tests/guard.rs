//! The guard, over a real socket: the token, the origin of a write, and the headers every answer
//! carries.

mod support;

use support::Server;

#[test]
fn an_address_without_the_token_does_not_exist() {
    let server = Server::start();
    for path in ["/", "/nope/", &format!("/{}x/", server.token)] {
        let answer = server.get(path);
        assert_eq!(answer.status(), 404, "{path}");
    }
}

#[test]
fn the_home_page_answers_with_the_token() {
    let server = Server::start();
    let mut answer = server.get(&format!("/{}/", server.token));
    assert_eq!(answer.status(), 200);
    assert_eq!(header(&answer, "referrer-policy"), "no-referrer");
    assert_eq!(header(&answer, "x-content-type-options"), "nosniff");
    let body = answer.body_mut().read_to_string().unwrap();
    assert!(body.contains("<html"), "{body}");
}

#[test]
fn the_embedded_files_are_kept_for_good_at_their_version() {
    let server = Server::start();
    let version = uraeda_serve::assets::version();
    let answer = server.get(&format!("/{}/a/{version}/ura.css", server.token));
    assert_eq!(answer.status(), 200);
    assert!(header(&answer, "cache-control").contains("immutable"));
    let old = server.get(&format!("/{}/a/old/ura.js", server.token));
    assert_eq!(header(&old, "cache-control"), "no-cache");
}

#[test]
fn a_write_from_another_origin_is_refused() {
    let server = Server::start();
    let path = format!("/{}/anything", server.token);
    let own = format!("http://{}", server.host());
    let cases: [(&[(&str, &str)], u16); 4] = [
        (&[], 403),
        (&[("origin", "https://evil.example")], 403),
        (&[("origin", &own), ("sec-fetch-site", "cross-site")], 403),
        (&[("origin", &own), ("sec-fetch-site", "same-origin")], 404),
    ];
    for (headers, status) in cases {
        assert_eq!(
            server.post(&path, headers, "").status(),
            status,
            "{headers:?}"
        );
    }
}

fn header(answer: &ureq::http::Response<ureq::Body>, name: &str) -> String {
    answer
        .headers()
        .get(name)
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default()
        .to_string()
}
