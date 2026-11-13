//! A diagram's picture. Merman draws a Mermaid diagram as SVG, in Rust: no browser, and no
//! JavaScript, so a diagram never runs a script. NSH's images draw no text, so `usvg` then turns
//! the text into shapes, in the app's own font. `Diagram.tsx` shows the picture, or the source
//! when it fails or takes longer than its 2 seconds.

#[cfg(not(target_arch = "wasm32"))]
mod draw;

use nsh_core::prelude::*;

#[cfg(not(target_arch = "wasm32"))]
pub use draw::{Fonts, Picture, Theme, fonts, fonts_of, picture};

/// A Mermaid theme variable and its colour, as `primaryColor` and `#ffdca0`.
#[derive(Clone, Debug, PartialEq, Eq, JsObject)]
pub struct DiagramColour {
    pub name: String,
    pub value: String,
}

/// A diagram's picture, as `<Image>` takes it.
#[derive(Clone, Debug, PartialEq, JsObject)]
pub struct DiagramPicture {
    /// A `data:` address of an SVG made of shapes only.
    pub src: String,
    pub width: f64,
    pub height: f64,
}

/// Diagrams, drawn in Rust.
#[module]
pub(crate) struct Diagrams;

#[module(flat)]
impl Diagrams {
    /// The picture of the Mermaid diagram `source`, in `colours`, Mermaid's theme variables from
    /// the theme's roles, drawn on a thread of its own. It fails with Merman's words for a source
    /// it cannot draw, or past its 2 seconds: the source shows then.
    pub(crate) async fn diagram_picture(
        source: String,
        colours: Vec<DiagramColour>,
    ) -> Result<DiagramPicture, String> {
        draw(source, colours).await
    }
}

/// The picture, drawn on a thread of its own.
#[cfg(not(target_arch = "wasm32"))]
async fn draw(source: String, colours: Vec<DiagramColour>) -> Result<DiagramPicture, String> {
    let drawn = crate::apart::apart(move || {
        let theme: Vec<(&str, &str)> = colours
            .iter()
            .map(|colour| (colour.name.as_str(), colour.value.as_str()))
            .collect();
        picture(&source, &theme, fonts())
    });
    let picture = drawn.await??;
    Ok(DiagramPicture {
        src: picture.src,
        width: f64::from(picture.width),
        height: f64::from(picture.height),
    })
}

/// In a browser no diagram is drawn yet, and its source shows: Merman and `usvg` are 7 MB of
/// WebAssembly every first load would carry. Its web form asks the server, which holds the same
/// drawing (the plan's task 57).
#[cfg(target_arch = "wasm32")]
#[expect(
    clippy::unused_async,
    reason = "the same signature as where it waits for a thread"
)]
async fn draw(_source: String, _colours: Vec<DiagramColour>) -> Result<DiagramPicture, String> {
    Err("Diagrams are not drawn in a browser yet.".to_owned())
}
