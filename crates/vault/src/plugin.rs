//! The phone's plugin, embedded in `ura`, written into the vault's `.obsidian/plugins/uraeda/`
//! whenever it differs: the sync carries it to the phone, which loads the new version at once.
//!
//! Its `data.json`, each device's own settings, never syncs: the desktop's says `sync: false`,
//! and the starter vault's carries the address of `ura serve` with its token.

use std::io::{self, Write};

use serde_json::{Map, Value, json};
use zip::write::SimpleFileOptions;

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

/// The vault's identity, made once and kept in its `.obsidian/`, never synced: a phone that last
/// synced with another vault, or with this folder before it was emptied, merges both sides
/// instead of reading every missing file as deleted.
pub fn vault_id(vault: &Vault) -> io::Result<String> {
    let file = vault.root().join(".obsidian/uraeda-vault-id");
    if let Ok(text) = std::fs::read_to_string(&file) {
        let id = text.trim();
        if !id.is_empty() {
            return Ok(id.to_string());
        }
    }
    let seed = format!(
        "{:?} {}",
        std::time::SystemTime::now(),
        vault.root().display()
    );
    let id = crate::manifest::hash_bytes(seed.as_bytes())[..16].to_string();
    notes::write_atomic(&file, format!("{id}\n").as_bytes())?;
    Ok(id)
}

/// The phone's starter vault, a zip of one folder `name`: the plugin, on, with the address of
/// `ura serve` and its token, and a note that says what it is. The first sync brings the rest.
pub fn starter(name: &str, url: &str) -> io::Result<Vec<u8>> {
    let mut zip = zip::ZipWriter::new(io::Cursor::new(Vec::new()));
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);
    let mut add = |path: &str, text: &str| -> io::Result<()> {
        zip.start_file(format!("{name}/{path}"), options)
            .map_err(io::Error::other)?;
        zip.write_all(text.as_bytes())
    };
    for (file, text) in files() {
        add(&format!("{}/{file}", paths::PLUGIN_DIR), &text)?;
    }
    add(
        &format!("{}/data.json", paths::PLUGIN_DIR),
        &settings(None, url, true),
    )?;
    add(".obsidian/community-plugins.json", "[\"uraeda\"]\n")?;
    add(STARTER_NOTE_NAME, STARTER_NOTE)?;
    let cursor = zip.finish().map_err(io::Error::other)?;
    Ok(cursor.into_inner())
}

/// The starter vault's note.
pub const STARTER_NOTE_NAME: &str = "Uraeda on this phone.md";

const STARTER_NOTE: &str = "# Uraeda on this phone\n\nThis vault syncs with `ura serve` on your \
computer, through the Uraeda plugin you trusted when Obsidian opened it. It syncs as Obsidian opens \
or comes back, a few seconds after you edit, and every minute while it is open. The ⟳ button syncs \
at once, and the plugin's settings say how the last sync went.\n\nWhen both sides changed a note, \
both versions are kept: yours is the copy named `(conflict phone …)`. A deleted note goes to the \
vault's `.trash/` on the other side.\n";

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
    fn the_starter_holds_the_plugin_and_its_address() {
        let bytes = starter("Uraeda", "https://laptop.ts.net/t/").unwrap();
        let mut zip = zip::ZipArchive::new(io::Cursor::new(bytes)).unwrap();
        let mut data = String::new();
        io::Read::read_to_string(
            &mut zip
                .by_name("Uraeda/.obsidian/plugins/uraeda/data.json")
                .unwrap(),
            &mut data,
        )
        .unwrap();
        assert!(
            data.contains("\"url\":\"https://laptop.ts.net/t/\""),
            "{data}"
        );
        assert!(data.contains("\"sync\":true"), "{data}");
        assert!(
            zip.by_name("Uraeda/.obsidian/plugins/uraeda/main.js")
                .is_ok()
        );
        assert!(
            zip.by_name("Uraeda/.obsidian/community-plugins.json")
                .is_ok()
        );
    }

    #[test]
    fn the_vault_keeps_its_identity() {
        let dir = tempfile::tempdir().unwrap();
        let vault = Vault::new(dir.path());
        let id = vault_id(&vault).unwrap();
        assert_eq!(vault_id(&vault).unwrap(), id);
        assert_eq!(id.len(), 16);
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
