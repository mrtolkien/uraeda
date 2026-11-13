//! The keyboard decision's structural rule: a shortcut is declared in the key registry, and
//! listened for nowhere else. The registry's own behaviour is tested where it runs, by
//! `app/ui/keys/keys.test.ts`.

use std::fs;
use std::path::{Path, PathBuf};

/// What hears a key on Native Shell: its keymap, from TSX and from Rust, and an input's report of
/// each key typed.
const HEARS: &[&str] = &[
    "keymap.bind",
    "onKeyPress",
    "onKeyCommand",
    "on_key(",
    "on_key_with(",
    "on_key_press(",
];

/// The files that may hear keys. A file whose keys are no shortcut, as a text field's own, adds
/// its line here, with what they are.
const ALLOWED: &[&str] = &[
    // The registry itself: every shortcut's one listener.
    "app/ui/keys/registry.tsx",
    // The text field's own keys, Vim's, and its owner's `inField` keys handed back to the
    // registry: no shortcut, only what a field with the focus takes from the editor.
    "crates/app/src/vim_bridge.rs",
];

/// The source files under `dir`, at any depth, less what Native Shell generates.
fn sources(dir: &Path, files: &mut Vec<PathBuf>) {
    for entry in fs::read_dir(dir).unwrap() {
        let path = entry.unwrap().path();
        let name = path.file_name().unwrap().to_string_lossy().into_owned();
        if path.is_dir() {
            if !name.starts_with('.') && name != "node_modules" {
                sources(&path, files);
            }
        } else if [".ts", ".tsx", ".rs"].iter().any(|end| name.ends_with(end)) {
            files.push(path);
        }
    }
}

#[test]
fn no_file_but_the_registry_listens_for_a_key() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
    let mut files = Vec::new();
    sources(&root.join("app"), &mut files);
    sources(&root.join("crates/app/src"), &mut files);
    assert!(
        files
            .iter()
            .any(|path| path.ends_with("ui/keys/registry.tsx")),
        "the key registry was not found under app/"
    );

    let mut listening: Vec<String> = files
        .iter()
        .filter(|path| {
            let text = fs::read_to_string(path).unwrap();
            HEARS.iter().any(|call| text.contains(call))
        })
        .map(|path| {
            path.strip_prefix(&root)
                .unwrap()
                .to_string_lossy()
                .replace('\\', "/")
        })
        .collect();
    listening.sort();

    assert_eq!(
        listening, ALLOWED,
        "a shortcut is declared with `registerKey` (app/ui/keys/registry.tsx), and heard nowhere \
         else: these files hear keys themselves"
    );
}
