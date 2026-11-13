//! The fonts the app bundles, in `assets/fonts/`, each family in a folder with its licence, the
//! SIL Open Font License 1.1. Native Shell ships the crate's `assets/` with the app and registers
//! its fonts before the first frame, whatever the page: no font comes from another host.
//!
//! Monaspace Neon, the interface's default, is whole: it holds the box-drawing characters, the
//! arrows, and the marks the design language writes. The other families hold Latin text only, as
//! the React UI shipped them, so each is named with Neon after it, for what it lacks.
//!
//! In a browser the engine registers only Neon's regular face as the app starts: Native Shell's
//! page fetches every font the engine registers before the first frame, 2.4 MB of them. The
//! others come in the chunks of `app/ui/tokens/faces/`, once a device shows their family (ruling
//! R471).

use nsh_core::element::{AssetFile, AssetKind, FontAsset};
use nsh_core::prelude::*;

/// The one face a browser registers before the first frame: the interface's default.
pub(crate) const FIRST_FACE: &str = "fonts/monaspace-neon/MonaspaceNeon-Regular.otf";

/// The files of `assets/` the engine registers as the app starts: on a machine all of them, and in
/// a browser all but the faces the chunks of `app/ui/tokens/faces/` register as they come.
pub(crate) fn registered() -> &'static [AssetFile] {
    let all = assets!();
    if !cfg!(target_arch = "wasm32") {
        return all;
    }
    let first = |file: &&AssetFile| file.kind != AssetKind::Font || file.uri.ends_with(FIRST_FACE);
    Vec::leak(all.iter().filter(first).copied().collect())
}

/// One file of each family: its name is read from the file when the crate compiles.
const FAMILIES: &[(&str, FontAsset)] = &[
    (
        "atkinson",
        asset!(
            "fonts/atkinson-hyperlegible-next/atkinson-hyperlegible-next-latin-wght-normal.woff2"
        ),
    ),
    ("inter", asset!("fonts/inter/inter-latin-wght-normal.woff2")),
    (
        "jetbrains",
        asset!("fonts/jetbrains-mono/jetbrains-mono-latin-wght-normal.woff2"),
    ),
    (
        "literata",
        asset!("fonts/literata/literata-latin-wght-normal.woff2"),
    ),
    (
        "argon",
        asset!("fonts/monaspace-argon/monaspace-argon-latin-400-normal.woff2"),
    ),
    (
        "krypton",
        asset!("fonts/monaspace-krypton/monaspace-krypton-latin-400-normal.woff2"),
    ),
    (
        "neon",
        asset!("fonts/monaspace-neon/MonaspaceNeon-Regular.otf"),
    ),
    (
        "radon",
        asset!("fonts/monaspace-radon/monaspace-radon-latin-400-normal.woff2"),
    ),
    (
        "xenon",
        asset!("fonts/monaspace-xenon/monaspace-xenon-latin-400-normal.woff2"),
    ),
];

/// A font the app bundles.
#[derive(Clone, Debug, PartialEq, Eq, JsObject)]
pub struct BundledFont {
    /// The name the app keeps a choice under: `neon`.
    pub id: String,
    /// The family's name, as its files hold it and a style's `fontFamily` takes it.
    pub family: String,
}

/// The fonts the app bundles.
#[module]
pub(crate) struct Fonts;

#[module(flat)]
impl Fonts {
    /// The fonts the app bundles, each with the family name a style's `fontFamily` takes.
    pub(crate) fn bundled_fonts() -> Vec<BundledFont> {
        FAMILIES
            .iter()
            .map(|(id, font)| BundledFont {
                id: (*id).to_owned(),
                family: font.family.to_owned(),
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::FIRST_FACE;

    /// Every face of `assets/fonts/` reaches a browser: the engine registers the first, and a chunk
    /// of `app/ui/tokens/faces/` each other, once. A face added and named in no chunk would never
    /// be drawn there, and nothing else would say so.
    #[test]
    fn every_face_is_registered_in_a_browser() {
        let crate_folder = Path::new(env!("CARGO_MANIFEST_DIR"));
        let chunks = crate_folder.join("../../app/ui/tokens/faces");
        let mut named = String::new();
        for chunk in std::fs::read_dir(&chunks).unwrap().flatten() {
            named.push_str(&std::fs::read_to_string(chunk.path()).unwrap());
        }
        let fonts = crate_folder.join("assets");
        for family in std::fs::read_dir(fonts.join("fonts")).unwrap().flatten() {
            for face in std::fs::read_dir(family.path()).unwrap().flatten() {
                let path = face.path();
                let name = path
                    .strip_prefix(&fonts)
                    .unwrap()
                    .to_string_lossy()
                    .into_owned();
                if !(name.ends_with(".otf") || name.ends_with(".woff2")) {
                    continue;
                }
                let uri = format!("\"asset:/@uraeda-app/{name}\"");
                let times = named.matches(&uri).count();
                let expected = usize::from(name != FIRST_FACE);
                assert_eq!(
                    times, expected,
                    "{name} is registered {times} times by the chunks"
                );
            }
        }
    }
}
