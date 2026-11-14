//! The guard, over a real socket: who is signed in, the origin of a write, and the headers every
//! answer carries.

mod support;

use support::Server;

#[test]
fn a_stranger_is_led_to_sign_in_or_refused() {
    let server = Server::start();
    let browser = [("accept", "text/html,application/xhtml+xml")];
    let page = server.stranger("/settings?x=1", &browser);
    assert_eq!(page.status(), 303);
    assert_eq!(header(&page, "location"), "/login?next=/settings%3Fx%3D1");
    // A request that is no page's, as the plugin's with a wrong token, is told so.
    assert_eq!(server.stranger("/vault/plan", &[]).status(), 401);
    let wrong = [("authorization", "Bearer nope")];
    assert_eq!(server.stranger("/", &wrong).status(), 401);
    let other = [("cookie", "ura_session=nope")];
    assert_eq!(server.stranger("/", &other).status(), 401);
    // The token as a bearer reads any page.
    let bearer = format!("Bearer {}", server.token);
    assert_eq!(
        server.stranger("/", &[("authorization", &bearer)]).status(),
        200
    );
}

#[test]
fn signing_in_with_the_token_gives_a_session() {
    let server = Server::start();
    let mut page = server.stranger("/login?next=/settings", &[]);
    assert_eq!(page.status(), 200);
    let body = page.body_mut().read_to_string().unwrap();
    assert!(body.contains("name=\"token\""), "{body}");
    assert!(body.contains("name=\"next\" value=\"/settings\""), "{body}");
    assert!(!body.contains(&server.token));

    let own = format!("http://{}", server.host());
    let form = |token: &str, next: &str| {
        ureq::Agent::config_builder()
            .http_status_as_error(false)
            .max_redirects(0)
            .build()
            .new_agent()
            .post(server.url("/login"))
            .header("origin", &own)
            .header("content-type", "application/x-www-form-urlencoded")
            .send(format!("token={token}&next={next}"))
            .unwrap()
    };
    let wrong = form("nope", "%2Fsettings");
    assert_eq!(wrong.status(), 401);
    assert_eq!(header(&wrong, "set-cookie"), "");

    let right = form(&server.token, "%2Fsettings");
    assert_eq!(right.status(), 303);
    assert_eq!(header(&right, "location"), "/settings");
    let cookie = header(&right, "set-cookie");
    assert!(cookie.starts_with(&server.cookie()), "{cookie}");
    assert!(
        cookie.contains("HttpOnly") && cookie.contains("SameSite=Lax"),
        "{cookie}"
    );
    assert!(
        !cookie.contains(&server.token),
        "the cookie never holds the token"
    );
    let session = cookie.split(';').next().unwrap();
    assert_eq!(server.stranger("/", &[("cookie", session)]).status(), 200);

    // A sign-in leads to a page of this server only.
    for next in ["https%3A%2F%2Fevil.example", "%2F%2Fevil.example"] {
        assert_eq!(
            header(&form(&server.token, next), "location"),
            "/",
            "{next}"
        );
    }
}

#[test]
fn the_home_page_answers_a_signed_in_browser() {
    let server = Server::start();
    let mut answer = server.get("/");
    assert_eq!(answer.status(), 200);
    assert_eq!(header(&answer, "referrer-policy"), "same-origin");
    assert_eq!(header(&answer, "x-content-type-options"), "nosniff");
    assert_eq!(header(&answer, "x-frame-options"), "SAMEORIGIN");
    let body = answer.body_mut().read_to_string().unwrap();
    assert!(body.contains("<html"), "{body}");
    assert!(!body.contains(&server.token));
}

#[test]
fn the_embedded_files_are_kept_for_good_at_their_version() {
    let server = Server::start();
    let version = uraeda_serve::assets::version();
    // The sign-in page is drawn with them: they answer a stranger.
    let answer = server.stranger(&format!("/a/{version}/ura.css"), &[]);
    assert_eq!(answer.status(), 200);
    assert!(header(&answer, "cache-control").contains("immutable"));
    let old = server.get("/a/old/ura.js");
    assert_eq!(header(&old, "cache-control"), "no-cache");
}

#[test]
fn a_write_from_another_origin_is_refused() {
    let server = Server::start();
    let path = "/anything";
    let own = format!("http://{}", server.host());
    let cases: [(&[(&str, &str)], u16); 7] = [
        // A form a page sends may carry no origin a server can read: the browser's word stands.
        (
            &[("origin", "null"), ("sec-fetch-site", "same-origin")],
            404,
        ),
        (&[("sec-fetch-site", "same-origin")], 404),
        // A sandboxed mockup's form.
        (&[("origin", "null"), ("sec-fetch-site", "cross-site")], 403),
        (&[], 403),
        (&[("origin", "https://evil.example")], 403),
        (&[("origin", &own), ("sec-fetch-site", "cross-site")], 403),
        (&[("origin", &own), ("sec-fetch-site", "same-origin")], 404),
    ];
    for (headers, status) in cases {
        assert_eq!(
            server.post(path, headers, "").status(),
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

#[test]
fn a_host_that_is_not_this_machine_is_refused() {
    let server = Server::start();
    let path = "/".to_string();
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .http_status_as_error(false)
        .build()
        .into();
    let answer = agent
        .get(server.url(&path))
        .header("host", "evil.example")
        .call()
        .unwrap();
    assert_eq!(answer.status(), 403);
}
