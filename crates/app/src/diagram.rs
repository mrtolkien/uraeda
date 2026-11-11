//! A diagram's picture. Merman draws a Mermaid diagram as SVG, in Rust: no browser, and no
//! JavaScript, so a diagram never runs a script. NSH's images draw no text, so `usvg` then turns
//! the text into shapes, in the app's own font. `Diagram.tsx` shows the picture, or the source
//! when it fails or takes longer than its 2 seconds.

use std::sync::{Arc, OnceLock};
use std::time::Duration;

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD;
use merman::svg::SvgPipeline;
use merman::{
    Engine, MermaidConfig, OperationControl, RenderOutput, RenderRequest, Renderer, SvgEnvironment,
    SvgRequest,
};
use merman_export::{NativeFontContext, NativeFontLimits};
use nsh_core::prelude::*;
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
    let tree = usvg::Tree::from_str(&without_none(svg.svg()), &options)
        .map_err(|error| error.to_string())?;
    let shapes = tree.to_string(&usvg::WriteOptions::default());
    Ok(Picture {
        src: format!("data:image/svg+xml;base64,{}", STANDARD.encode(shapes)),
        width: tree.size().width(),
        height: tree.size().height(),
    })
}

/// `svg` without the `filter: none` and `transform: none` Merman writes in its styles, which mean
/// nothing, and its drop shadows, at 6 % of black: `usvg` warns of each, in the process's log.
fn without_none(svg: &str) -> String {
    svg.replace("filter:url(#merman-drop-shadow);", "")
        .replace("filter:url(#merman-drop-shadow-small);", "")
        .replace("filter:none;", "")
        .replace("filter:none}", "}")
        .replace(";transform:none", "")
        .replace("transform:none;", "")
        .replace("style=\"transform:none\"", "")
}

/// `source` with the angle brackets of its quoted labels as entities, but for a line break's.
/// Merman reads a label as HTML: one that names `<name>` lost every label of its diagram.
pub(crate) fn without_markup(source: &str) -> String {
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

/// The font a diagram is measured and drawn in: Monaspace Neon, the interface's, which the app
/// bundles whole. The other bundled families are WOFF2 files, which neither Merman nor `usvg`
/// reads.
const FONT: &[u8] = include_bytes!("../assets/fonts/monaspace-neon/MonaspaceNeon-Regular.otf");

/// The app's fonts, read once.
pub fn fonts() -> &'static Fonts {
    static FONTS: OnceLock<Fonts> = OnceLock::new();
    FONTS.get_or_init(|| fonts_of(FONT))
}

/// The fonts of the font file `bytes`.
pub fn fonts_of(bytes: &[u8]) -> Fonts {
    let mut drawn = Database::new();
    drawn.load_font_data(bytes.to_vec());
    let family = drawn
        .faces()
        .next()
        .and_then(|face| face.families.first())
        .map(|(name, _)| name.clone())
        .expect("a font family");
    drawn.set_sans_serif_family(family.clone());
    drawn.set_monospace_family(family.clone());
    let measured = NativeFontContext::from_font_bytes(
        [bytes.to_vec()],
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
        let drawn = blocking(move || {
            let theme: Vec<(&str, &str)> = colours
                .iter()
                .map(|colour| (colour.name.as_str(), colour.value.as_str()))
                .collect();
            picture(&source, &theme, fonts())
        });
        let picture = drawn.await.map_err(|error| error.to_string())??;
        Ok(DiagramPicture {
            src: picture.src,
            width: f64::from(picture.width),
            height: f64::from(picture.height),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::{fonts, picture, without_markup};

    #[test]
    fn a_quoted_label_keeps_its_angle_brackets_as_text() {
        assert_eq!(
            without_markup("A ||--o{ B : \"[extensions.<name>]\"\nA --> B"),
            "A ||--o{ B : \"[extensions.&lt;name&gt;]\"\nA --> B"
        );
        assert_eq!(without_markup("A[\"one<br/>two\"]"), "A[\"one<br/>two\"]");
    }

    /// The SVG a picture holds, read back from its `data:` address.
    fn svg(source: &str, theme: super::Theme<'_>) -> Result<String, String> {
        use base64::Engine as _;
        let picture = picture(source, theme, fonts())?;
        let data = picture
            .src
            .strip_prefix("data:image/svg+xml;base64,")
            .expect("a data address");
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(data)
            .expect("base64");
        Ok(String::from_utf8(bytes).expect("an SVG"))
    }

    #[test]
    fn a_diagram_is_drawn_in_the_themes_colours_with_its_text_as_shapes() {
        let drawn = svg(
            "flowchart LR\n  A[Proposal] --> B[Round]",
            &[("primaryColor", "#ffdca0"), ("lineColor", "#00a000")],
        )
        .expect("a flowchart draws");
        assert!(drawn.to_lowercase().contains("#ffdca0"), "{drawn}");
        assert!(!drawn.contains("<text"), "its text is shapes");
    }

    #[test]
    fn a_source_it_cannot_draw_fails_with_words() {
        let failed = svg("flowchart LR\n  A[Proposal --> ((", &[]).expect_err("no picture");
        assert!(!failed.is_empty());
        assert!(svg("not a diagram at all", &[]).is_err());
    }

    #[test]
    fn a_diagram_never_carries_a_script() {
        let drawn = svg(
            "flowchart LR\n  A[\"<script>alert(1)</script>\"] --> B\n  click A call alert(1)\n  click B href \"javascript:alert(1)\"",
            &[],
        )
        .expect("the flowchart draws");
        let drawn = drawn.to_lowercase();
        assert!(!drawn.contains("<script"), "{drawn}");
        assert!(!drawn.contains("javascript:"), "{drawn}");
        assert!(!drawn.contains("onclick"), "{drawn}");
    }
}
