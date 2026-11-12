//! The package's desktop entry names the app as its window does: a desktop groups the app's windows
//! under its entry, and shows its icon, only when the entry's file name, its `StartupWMClass`, and
//! its `Icon` are the window's application id. `just package` ships these files.

use std::fs;
use std::path::PathBuf;

use uraeda_app::APP_ID;

fn repository() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn entry_value<'a>(entry: &'a str, key: &str) -> Option<&'a str> {
    entry
        .lines()
        .find_map(|line| line.strip_prefix(key)?.strip_prefix('='))
}

#[test]
fn the_desktop_entry_and_the_icon_carry_the_windows_app_id() {
    let package = repository().join("app/package");
    let entry = fs::read_to_string(package.join(format!("{APP_ID}.desktop")))
        .expect("the desktop entry is named after the app id");
    assert_eq!(entry_value(&entry, "StartupWMClass"), Some(APP_ID));
    assert_eq!(entry_value(&entry, "Icon"), Some(APP_ID));
    assert!(
        package.join(format!("{APP_ID}.svg")).is_file(),
        "the icon is named after the app id"
    );

    let manifest = fs::read_to_string(repository().join("app/nsh.json")).expect("app/nsh.json");
    let manifest: serde_json::Value = serde_json::from_str(&manifest).expect("JSON");
    assert_eq!(manifest["id"].as_str(), Some(APP_ID), "app/nsh.json's id");
}
