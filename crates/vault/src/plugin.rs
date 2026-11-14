//! The phone's plugin, embedded in `ura`, written into the vault's `.obsidian/plugins/uraeda/`
//! whenever it differs: the sync carries it to the phone, which loads the new version at once.
//!
//! Its `data.json`, each device's own settings, never syncs: the desktop's says `sync: false`,
//! and the starter vault's carries the address of `ura serve` with its token.

use std::io;

use serde_json::{Map, Value, json};

use crate::{Vault, notes, paths};

/// The plugin's code: see its own header.
pub const MAIN: &str = include_str!("../plugin/main.js");

/// The plugin's identity, as Obsidian reads it.
pub fn manifest() -> String {
    let manifest = json!({
        "id": "uraeda",
        "name": "Uraeda",
        "version": env!("CARGO_PKG_VERSION"),
        "minAppVersion": "1.5.0",
        "description": "Syncs this vault with ura serve, and links to its pages.",
        "author": "Uraeda",
        "isDesktopOnly": false,
    });
    format!(
        "{}\n",
        serde_json::to_string_pretty(&manifest).unwrap_or_default()
    )
}

/// The plugin's files, by name in its folder.
pub fn files() -> [(&'static str, String); 2] {
    [("main.js", MAIN.to_string()), ("manifest.json", manifest())]
}

/// Writes the plugin's files that differ, and turns it on in a vault that has no list of plugins.
pub fn install(vault: &Vault) -> io::Result<()> {
    let dir = vault.root().join(paths::PLUGIN_DIR);
    for (name, text) in files() {
        let file = dir.join(name);
        if std::fs::read(&file).ok().as_deref() != Some(text.as_bytes()) {
            notes::write_atomic(&file, text.as_bytes())?;
        }
    }
    let list = vault.root().join(".obsidian/community-plugins.json");
    if !list.exists() {
        notes::write_atomic(&list, b"[\"uraeda\"]\n")?;
    }
    Ok(())
}

/// The plugin's settings for one device: `url`, the address of `ura serve` with its token, and
/// whether it syncs. The rest of an existing `data.json` is kept.
pub fn settings(existing: Option<&str>, url: &str, sync: bool) -> String {
    let mut data = existing
        .and_then(|text| serde_json::from_str::<Map<String, Value>>(text).ok())
        .unwrap_or_default();
    data.insert("url".into(), Value::from(url));
    data.insert("sync".into(), Value::from(sync));
    format!("{}\n", Value::Object(data))
}

/// Sets the desktop's plugin settings: the pages' address, and no sync.
pub fn configure_desktop(vault: &Vault, url: &str) -> io::Result<()> {
    let file = vault.root().join(paths::PLUGIN_DIR).join("data.json");
    let existing = std::fs::read_to_string(&file).ok();
    let text = settings(existing.as_deref(), url, false);
    if existing.as_deref() != Some(text.as_str()) {
        notes::write_atomic(&file, text.as_bytes())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn installs_once_and_keeps_the_list_of_plugins() {
        let dir = tempfile::tempdir().unwrap();
        let vault = Vault::new(dir.path());
        install(&vault).unwrap();
        let main = dir.path().join(".obsidian/plugins/uraeda/main.js");
        assert_eq!(std::fs::read_to_string(&main).unwrap(), MAIN);
        let list = dir.path().join(".obsidian/community-plugins.json");
        std::fs::write(&list, "[\"other\"]").unwrap();
        std::fs::write(&main, "old").unwrap();
        install(&vault).unwrap();
        assert_eq!(std::fs::read_to_string(&main).unwrap(), MAIN);
        assert_eq!(std::fs::read_to_string(&list).unwrap(), "[\"other\"]");
        assert!(manifest().contains("\"id\": \"uraeda\""));
    }

    #[test]
    fn settings_keep_the_rest() {
        let text = settings(
            Some("{\"base\":{\"a\":\"1\"},\"sync\":true}"),
            "http://x/t/",
            false,
        );
        let value: Value = serde_json::from_str(&text).unwrap();
        assert_eq!(value["base"]["a"], "1");
        assert_eq!(value["sync"], false);
        assert_eq!(value["url"], "http://x/t/");
    }
}
