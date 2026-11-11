//! The fonts the app bundles, in `assets/fonts/`, each family in a folder with its licence, the
//! SIL Open Font License 1.1. Native Shell ships the crate's `assets/` with the app and registers
//! its fonts before the first frame, whatever the page: no font comes from another host.
//!
//! Monaspace Neon, the interface's default, is whole: it holds the box-drawing characters, the
//! arrows, and the marks the design language writes. The other families hold Latin text only, as
//! the React UI shipped them, so each is named with Neon after it, for what it lacks.

use nsh_core::element::FontAsset;
use nsh_core::prelude::*;

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
