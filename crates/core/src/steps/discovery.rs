//! What a feature's discovery files say: the latest one's two optional fields, and whether a round
//! was asked and lost.

use crate::workspace::{Feature, FileKind};

/// What the latest discovery file's frontmatter says.
pub(super) struct Discovery {
    pub round: u32,
    /// `ui: true`: the feature has UI work, settled in a UI iteration before its spec.
    pub ui: bool,
    /// `round: none`: the feature is only a look, and asks no round.
    pub no_round: bool,
}

/// The discovery file of the latest round, with its two optional fields.
pub(super) fn latest_discovery(feature: &Feature) -> Option<Discovery> {
    let file = feature
        .files
        .iter()
        .filter(|file| file.kind == FileKind::Discovery)
        .max_by_key(|file| file.round)?;
    let front = feature
        .text(&file.name)
        .and_then(|text| crate::files::frontmatter::parse(text).ok());
    Some(Discovery {
        round: file.round.unwrap_or(0),
        ui: front.as_ref().is_some_and(|front| {
            matches!(
                front.get("ui"),
                Some(crate::files::frontmatter::Value::Bool(true))
            )
        }),
        no_round: front
            .as_ref()
            .is_some_and(|front| front.text("round") == Some("none")),
    })
}

/// Whether the latest discovery round has neither its questions' file nor a spec written from it:
/// a round asked in a session, and lost with it. A discovery that says `round: none` asks none.
pub(super) fn lost_round(feature: &Feature) -> bool {
    let latest = |kind| {
        feature
            .files
            .iter()
            .filter(|file| file.kind == kind)
            .filter_map(|file| file.round)
            .max()
            .unwrap_or(0)
    };
    let discovery = latest(FileKind::Discovery);
    if discovery == 0
        || latest(FileKind::Clarifications) >= discovery
        || latest_discovery(feature).is_some_and(|found| found.no_round)
    {
        return false;
    }
    let spec_round = feature
        .text("spec.md")
        .and_then(|text| {
            crate::files::frontmatter::parse(text)
                .ok()?
                .integer("clarifications")
        })
        .unwrap_or(0);
    spec_round < i64::from(discovery)
}
