//! The module `uraeda/native` as TypeScript sees it. A call from TSX is tested where it runs, by
//! `app/native.test.ts`.

/// An export's doc comment is its documentation in TypeScript, where the app's TSX reads it.
/// Native Shell only warns about a missing one.
#[test]
fn every_export_is_documented_for_typescript() {
    let undocumented = uraeda_app::registry().undocumented();

    assert!(
        undocumented.is_empty(),
        "give each of these exports of `uraeda/native` a doc comment, on the Rust item that names \
         it: {undocumented:?}"
    );
}
