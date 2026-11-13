//! `POST /diagram`: a Mermaid diagram's picture, for the app in a browser. The Linux app draws its
//! diagrams itself; its web build leaves Merman and `usvg` out, 3 MB a first load would carry for
//! a picture few pages show, and asks here, where the same drawing is linked
//! (`uraeda_app::diagram::picture`). Closed as every route: a request carries a session.
//!
//! The body is `{ source, colours: [{ name, value }] }`, Mermaid's theme variables from the
//! theme's roles. The answer is `{ src, width, height }`, or 422 with `{ error }`, Merman's words
//! or the 2 seconds a drawing may take, for the app to show the source instead.

use std::time::Duration;

use axum::Json;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::post;
use serde::Deserialize;
use serde_json::json;

use crate::Failure;
use crate::http::Routes;
use crate::shared::Shared;

/// How long a drawing may take, as on the desktop: Merman stops there, and this answers then.
const PATIENCE: Duration = Duration::from_secs(2);

/// What the app asks to draw.
#[derive(Deserialize)]
struct Asked {
    source: String,
    #[serde(default)]
    colours: Vec<Colour>,
}

/// A Mermaid theme variable and its colour, as `primaryColor` and `#ffdca0`.
#[derive(Deserialize)]
struct Colour {
    name: String,
    value: String,
}

/// Mounts `POST /diagram`.
pub(crate) fn mount(_: &Shared, routes: &mut Routes) -> Result<(), Failure> {
    routes.route("/diagram", post(diagram));
    Ok(())
}

/// Draws the diagram on a thread of its own, within its 2 seconds.
async fn diagram(Json(asked): Json<Asked>) -> Response {
    let drawing = tokio::task::spawn_blocking(move || {
        let theme: Vec<(&str, &str)> = asked
            .colours
            .iter()
            .map(|colour| (colour.name.as_str(), colour.value.as_str()))
            .collect();
        uraeda_app::diagram::picture(&asked.source, &theme, uraeda_app::diagram::fonts())
    });
    let drawn = match tokio::time::timeout(PATIENCE, drawing).await {
        Ok(Ok(drawn)) => drawn,
        Ok(Err(_)) => Err("the drawing stopped".to_owned()),
        Err(_) => Err("it took more than 2 seconds".to_owned()),
    };
    match drawn {
        Ok(picture) => Json(json!({
            "src": picture.src,
            "width": picture.width,
            "height": picture.height,
        }))
        .into_response(),
        Err(error) => (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(json!({ "error": error })),
        )
            .into_response(),
    }
}
