//! A diagram's picture. Pele draws a Mermaid diagram as an SVG that takes its colours from CSS
//! variables and holds text. NSH's images draw neither: its SVG reader knows no `var()`, and
//! leaves text out. So Rust gives each variable its value, and turns the text into shapes.

use std::collections::HashMap;
use std::process::Command;
use std::sync::Arc;

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use usvg::fontdb::Database;

/// The colours of a diagram: Pele's variables, as `("--pele-fg", "#0000ff")`.
pub type Theme<'a> = &'a [(&'a str, &'a str)];

/// Pele's `svg` as an image NSH draws, in `theme`'s colours and the fonts of `fonts`: a `data:`
/// address of an SVG made of shapes only.
pub fn picture(svg: &str, theme: Theme<'_>, fonts: &Arc<Database>) -> Result<String, String> {
    let options = usvg::Options {
        fontdb: Arc::clone(fonts),
        ..usvg::Options::default()
    };
    let tree = usvg::Tree::from_str(&without_variables(svg, theme), &options)
        .map_err(|error| error.to_string())?;
    let shapes = tree.to_string(&usvg::WriteOptions::default());
    Ok(format!(
        "data:image/svg+xml;base64,{}",
        STANDARD.encode(shapes)
    ))
}

/// The fonts a diagram's text is drawn in: here the display's sans-serif font, which fontconfig
/// names. The app gives its own.
pub fn fonts() -> Arc<Database> {
    let found = Command::new("fc-match")
        .args(["--format=%{file}", "sans-serif"])
        .output()
        .expect("fc-match, from the dev shell");
    let file = String::from_utf8(found.stdout).expect("a font file's path");
    let mut fonts = Database::new();
    fonts.load_font_data(std::fs::read(&file).expect("the font file"));
    let family = fonts
        .faces()
        .next()
        .and_then(|face| face.families.first())
        .map(|(name, _)| name.clone())
        .expect("a font family");
    fonts.set_sans_serif_family(family);
    Arc::new(fonts)
}

/// `svg` in plain SVG, which `usvg` reads. Each `var()` gets its value: `theme`'s, or the fallback
/// the SVG names. The root element declares variables of its own from the theme's,
/// `--_fg:var(--pele-fg,#1f1f1f)`, which the rest of the SVG uses: they leave its style, where
/// they stopped `usvg` from reading the font after them. A corner's radius, which Pele writes as
/// a style, becomes the attribute.
fn without_variables(svg: &str, theme: Theme<'_>) -> String {
    let mut known: HashMap<String, String> = theme
        .iter()
        .map(|(name, value)| ((*name).to_owned(), (*value).to_owned()))
        .collect();
    let Some((before, rest)) = svg.split_once("style=\"") else {
        return resolved(svg, &known);
    };
    let (root_style, after) = rest.split_once('"').unwrap_or((rest, ""));
    let mut kept = Vec::new();
    for declaration in root_style.split(';') {
        match declaration.split_once(':') {
            Some((name, value)) if name.starts_with("--") => {
                let value = resolved(value, &known);
                known.insert(name.to_owned(), value);
            }
            _ => kept.push(resolved(declaration, &known)),
        }
    }
    let rest = resolved(after, &known).replace(" style=\"rx:", " rx=\"");
    format!("{before}style=\"{}\"{rest}", kept.join(";"))
}

/// `text` with each `var(--name)` and `var(--name,fallback)` replaced by the value of `--name` in
/// `known`, or by its fallback.
fn resolved(text: &str, known: &HashMap<String, String>) -> String {
    let mut out = String::new();
    let mut rest = text;
    while let Some(start) = rest.find("var(") {
        out.push_str(&rest[..start]);
        let inside = &rest[start + 4..];
        let end = closing(inside);
        let (name, fallback) = inside[..end]
            .split_once(',')
            .unwrap_or((&inside[..end], ""));
        match known.get(name.trim()) {
            Some(value) => out.push_str(value),
            None => out.push_str(&resolved(fallback.trim(), known)),
        }
        rest = inside.get(end + 1..).unwrap_or("");
    }
    out.push_str(rest);
    out
}

/// Where the parenthesis open before `text` closes, or `text`'s end.
fn closing(text: &str) -> usize {
    let mut depth = 0;
    for (index, character) in text.char_indices() {
        match character {
            '(' => depth += 1,
            ')' if depth == 0 => return index,
            ')' => depth -= 1,
            _ => {}
        }
    }
    text.len()
}
