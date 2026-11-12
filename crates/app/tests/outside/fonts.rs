//! Which font GTK draws a text in. Native Shell lays a text out on its engine's thread, and keeps
//! for each run of glyphs the font the layout chose, a fallback included; GTK's thread then draws
//! the run as a text node in that font. So a text node's font is the face on screen.

use std::collections::{BTreeMap, BTreeSet};

use gtk::prelude::*;
use nsh_platform_linux::gtk4::{self as gtk, pango};

use super::stage::Stage;

/// A folder laid out as `nsh package` lays out the files an app ships: the crate's `assets/`,
/// under the crate's name. Native Shell reads the app's fonts there.
pub fn shipped() -> tempfile::TempDir {
    let folder = tempfile::tempdir().expect("a temporary folder");
    let assets = concat!(env!("CARGO_MANIFEST_DIR"), "/assets");
    std::os::unix::fs::symlink(assets, folder.path().join("@uraeda-app"))
        .expect("a link to the crate's assets");
    folder
}

/// The family a font description names: `JetBrains Mono` for `JetBrains Mono Bold 15px`.
fn family(description: &str) -> String {
    pango::FontDescription::from_string(description)
        .family()
        .map(|family| family.to_string())
        .unwrap_or_default()
}

/// The family of the font GTK's font map gives for `named`, before Native Shell has drawn any
/// text: what the display's own fonts hold, with none of the app's.
pub fn on_display(stage: &Stage, named: &str) -> String {
    let mut wanted = pango::FontDescription::new();
    wanted.set_family(named);
    stage
        .window
        .pango_context()
        .load_font(&wanted)
        .map(|font| family(&font.describe().to_str()))
        .unwrap_or_default()
}

/// The families of the fonts GTK draws the window's texts in, by the red of each text's colour,
/// from 0 to 255. GTK writes what it draws as text, a property a line: a text node is
/// `text { color: rgb(1,0,0); font: "JetBrains Mono 15px"; glyphs: …; }`, alone or as the
/// `child:` of another node.
pub fn drawn(stage: &Stage) -> BTreeMap<u8, BTreeSet<String>> {
    let mut families: BTreeMap<u8, BTreeSet<String>> = BTreeMap::new();
    let Some(nodes) = stage.nodes() else {
        return families;
    };
    let written = nodes.serialize();
    let written = String::from_utf8_lossy(&written);
    // The red and the family of the text node being read, or none outside one.
    let mut text: Option<(u8, Option<String>)> = None;
    for line in written.lines().map(str::trim) {
        if line.ends_with("text {") {
            text = Some((0, None));
        } else if let Some((red, font)) = &mut text {
            if let Some(colour) = line.strip_prefix("color: rgb(") {
                let first = colour.split(',').next();
                *red = first.and_then(|red| red.parse().ok()).unwrap_or(0);
            } else if let Some(description) = line.strip_prefix("font: \"") {
                *font = description.split('"').next().map(family);
            } else if line == "}" {
                if let Some(font) = font.take() {
                    families.entry(*red).or_default().insert(font);
                }
                text = None;
            }
        }
    }
    families
}
