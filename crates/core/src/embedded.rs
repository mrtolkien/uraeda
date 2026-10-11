//! The Uraeda skill, embedded in the binary at build time: its templates, for `check` and `init`,
//! and the whole skill, for `init` (see `specs/decisions/cli.md`).

use include_dir::{Dir, include_dir};

/// `skills/uraeda/`, as it was when the binary was built.
pub static SKILL: Dir<'static> = include_dir!("$CARGO_MANIFEST_DIR/../../skills/uraeda");

/// A template's text, by its path under `assets/templates/specs/`.
pub fn template(path: &str) -> Option<&'static str> {
    SKILL
        .get_file(format!("assets/templates/specs/{path}"))?
        .contents_utf8()
}
