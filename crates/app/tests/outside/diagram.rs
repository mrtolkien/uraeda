//! A diagram's picture. Merman draws a Mermaid diagram as SVG, in Rust: no browser, and no
//! JavaScript. NSH's images draw no text, so `usvg` then turns the text into shapes.

use std::process::Command;
use std::sync::Arc;
use std::time::Duration;

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD;
use merman::svg::SvgPipeline;
use merman::{
    Engine, MermaidConfig, OperationControl, RenderOutput, RenderRequest, Renderer, SvgEnvironment,
    SvgRequest,
};
use merman_export::{NativeFontContext, NativeFontLimits};
use usvg::fontdb::Database;

/// The colours of a diagram: Mermaid's theme variables, as `("primaryColor", "#ffdca0")`.
pub type Theme<'a> = &'a [(&'a str, &'a str)];

/// How long a diagram may take: a hostile source stops there, and shows as its source.
const PATIENCE: Duration = Duration::from_secs(2);

/// The fonts of a diagram: the layout measures its labels with the fonts the picture draws them
/// in, so no label overflows its box.
pub struct Fonts {
    family: String,
    measured: NativeFontContext,
    drawn: Arc<Database>,
}

/// A diagram as an image NSH draws, at its size.
pub struct Picture {
    /// A `data:` address of an SVG made of shapes only.
    pub src: String,
    pub width: f32,
    pub height: f32,
}

/// The Mermaid `source` as a picture, in `theme`'s colours and the fonts of `fonts`.
pub fn picture(source: &str, theme: Theme<'_>, fonts: &Fonts) -> Result<Picture, String> {
    let variables: serde_json::Map<String, serde_json::Value> = theme
        .iter()
        .map(|(name, value)| ((*name).to_owned(), (*value).into()))
        .collect();
    // The app's settings stay outside the source: a diagram cannot name another font or theme.
    let config = MermaidConfig::from_value(serde_json::json!({
        "theme": "base",
        "fontFamily": fonts.family,
        "themeVariables": variables,
    }));
    let environment = SvgEnvironment::deterministic()
        .with_native_font_context(fonts.measured.clone())
        .map_err(|error| error.to_string())?;
    let request = SvgRequest {
        environment,
        // Labels as SVG text, not HTML, which `usvg` would leave out.
        pipeline: Some(SvgPipeline::resvg_safe()),
        ..SvgRequest::default()
    };
    let control = OperationControl::new().with_deadline(PATIENCE);
    let source = without_markup(source);
    let output = Renderer::new()
        .with_engine(Engine::new().with_site_config(config))
        .render(RenderRequest::svg(&source, control, request))
        .map_err(|error| error.to_string())?;
    let RenderOutput::Svg(Some(svg)) = output else {
        return Err("not a Mermaid diagram".to_owned());
    };
    let options = usvg::Options {
        fontdb: Arc::clone(&fonts.drawn),
        ..usvg::Options::default()
    };
    let tree = usvg::Tree::from_str(svg.svg(), &options).map_err(|error| error.to_string())?;
    let shapes = tree.to_string(&usvg::WriteOptions::default());
    Ok(Picture {
        src: format!("data:image/svg+xml;base64,{}", STANDARD.encode(shapes)),
        width: tree.size().width(),
        height: tree.size().height(),
    })
}

/// `source` with the angle brackets of its quoted labels as entities, but for a line break's.
/// Merman reads a label as HTML: one that names `<name>` lost every label of its diagram.
fn without_markup(source: &str) -> String {
    let mut out = String::with_capacity(source.len());
    let mut quoted = false;
    let mut rest = source;
    while let Some(character) = rest.chars().next() {
        let after = &rest[character.len_utf8()..];
        match character {
            '"' => quoted = !quoted,
            '\n' => quoted = false,
            '<' if quoted && !after.starts_with("br") => {
                out.push_str("&lt;");
                rest = after;
                continue;
            }
            '>' if quoted && !out.ends_with("<br") && !out.ends_with("<br/") => {
                out.push_str("&gt;");
                rest = after;
                continue;
            }
            _ => {}
        }
        out.push(character);
        rest = after;
    }
    out
}

/// The fonts a diagram is measured and drawn in: here the display's sans-serif font, which
/// fontconfig names. The app gives its own.
pub fn fonts() -> Fonts {
    let found = Command::new("fc-match")
        .args(["--format=%{file}", "sans-serif"])
        .output()
        .expect("fc-match, from the dev shell");
    let file = String::from_utf8(found.stdout).expect("a font file's path");
    let bytes = std::fs::read(&file).expect("the font file");
    let mut drawn = Database::new();
    drawn.load_font_data(bytes.clone());
    let family = drawn
        .faces()
        .next()
        .and_then(|face| face.families.first())
        .map(|(name, _)| name.clone())
        .expect("a font family");
    drawn.set_sans_serif_family(family.clone());
    let measured = NativeFontContext::from_font_bytes(
        [bytes],
        NativeFontLimits::default(),
        &OperationControl::new(),
    )
    .expect("a font Merman reads");
    Fonts {
        family,
        measured,
        drawn: Arc::new(drawn),
    }
}

#[cfg(test)]
mod tests {
    use super::without_markup;

    #[test]
    fn a_quoted_label_keeps_its_angle_brackets_as_text() {
        assert_eq!(
            without_markup("A ||--o{ B : \"[extensions.<name>]\"\nA --> B"),
            "A ||--o{ B : \"[extensions.&lt;name&gt;]\"\nA --> B"
        );
        assert_eq!(without_markup("A[\"one<br/>two\"]"), "A[\"one<br/>two\"]");
    }
}
