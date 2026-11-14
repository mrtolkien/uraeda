//! The vault's files that travel to the phone, each with its SHA-256: what the sync compares. A
//! file's hash is kept while its size and time of change stay the same, so a listing reads only
//! the files changed since the last one.

use std::collections::{BTreeMap, HashMap};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::SystemTime;

use sha2::{Digest, Sha256};

use crate::{Vault, paths, walk};

/// Path, from the vault's folder, to its hash in lower-case hex.
pub type Manifest = BTreeMap<String, String>;

/// The hashes of the files read before, by path, size, and time of change.
#[derive(Default)]
pub struct Hashes {
    known: Mutex<HashMap<PathBuf, (u64, SystemTime, String)>>,
}

impl Hashes {
    /// The vault's files that sync, with their hashes. Blocks on disk.
    pub fn manifest(&self, vault: &Vault) -> Manifest {
        let files = walk::files(vault.root(), keep);
        let mut known = self
            .known
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        let mut out = Manifest::new();
        let mut seen = HashMap::with_capacity(files.len());
        for path in files {
            let full = vault.root().join(&path);
            let Ok(meta) = std::fs::metadata(&full) else {
                continue;
            };
            let stamp = (
                meta.len(),
                meta.modified().unwrap_or(SystemTime::UNIX_EPOCH),
            );
            let hash = match known.get(&full) {
                Some((len, time, hash)) if (*len, *time) == stamp => hash.clone(),
                _ => match hash_file(&full) {
                    Ok(hash) => hash,
                    Err(_) => continue,
                },
            };
            seen.insert(full, (stamp.0, stamp.1, hash.clone()));
            out.insert(path, hash);
        }
        *known = seen;
        out
    }
}

/// A folder walked, `a/`, or a file listed.
fn keep(path: &str) -> bool {
    match path.strip_suffix('/') {
        Some(_) => format!("{}/", paths::PLUGIN_DIR).starts_with(path) || paths::is_synced(path),
        None => paths::is_synced(path),
    }
}

/// A file's SHA-256, in lower-case hex.
pub fn hash_file(path: &Path) -> std::io::Result<String> {
    let mut file = std::fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0; 64 * 1024];
    loop {
        let n = file.read(&mut buffer)?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }
    Ok(hex(&hasher.finalize()))
}

/// Bytes' SHA-256, in lower-case hex.
pub fn hash_bytes(bytes: &[u8]) -> String {
    hex(&Sha256::digest(bytes))
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lists_what_syncs_and_sees_changes() {
        let dir = tempfile::tempdir().unwrap();
        let vault = Vault::new(dir.path());
        for (path, text) in [
            ("inbox/a.md", "a"),
            (".obsidian/app.json", "{}"),
            (".obsidian/plugins/uraeda/main.js", "js"),
            (".obsidian/plugins/uraeda/data.json", "{}"),
            (".obsidian/plugins/other/main.js", "x"),
            (".trash/b.md", "b"),
        ] {
            let full = dir.path().join(path);
            std::fs::create_dir_all(full.parent().unwrap()).unwrap();
            std::fs::write(full, text).unwrap();
        }
        let hashes = Hashes::default();
        let first = hashes.manifest(&vault);
        assert_eq!(
            first.keys().collect::<Vec<_>>(),
            [".obsidian/plugins/uraeda/main.js", "inbox/a.md"]
        );
        assert_eq!(first["inbox/a.md"], hash_bytes(b"a"));
        std::fs::write(dir.path().join("inbox/a.md"), "changed").unwrap();
        assert_eq!(
            hashes.manifest(&vault)["inbox/a.md"],
            hash_bytes(b"changed")
        );
    }
}
