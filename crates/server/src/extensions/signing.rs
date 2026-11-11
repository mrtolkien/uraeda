//! The keys that sign extension pages: a client runs a page only when it is signed under the
//! key this server gave it over its signed-in connection.
//!
//! NSH's keys have two levels. The **root** key is made at the first start, and kept in the data
//! folder, readable by its owner only: its public half is what `GET /extensions/key` answers,
//! and what a client trusts. The **release** key signs the packages: a new one each start,
//! kept in memory, with the root's certificate for it.
//!
//! No key leaves this file: [`Signer`] gives the root's public half and signed packages, and
//! nothing says a key in a message. Only [`Signer::open`] reads the file.

use std::fs::{self, DirBuilder, OpenOptions};
use std::io::{self, Write as _};
use std::os::unix::fs::{DirBuilderExt as _, OpenOptionsExt as _, PermissionsExt as _};
use std::path::{Path, PathBuf};

use nsh_package::{App, Certificate, Contents, SecretKey, certify};
use serde_json::json;
use uraeda_protocol::PAGE_HOST;

use crate::Failure;

/// The root key's file, in the data folder's `extensions/`.
const KEY: &str = "signing.key";

/// The ids a release key may sign for: an extension's page is `dev.uraeda.extension.<name>`.
const APPS: &str = "dev.uraeda.extension.*";

/// The data folder's `extensions/`, readable by its owner only, where the root key and the
/// pages' build counter are kept.
pub(super) fn folder(data_dir: &Path) -> io::Result<PathBuf> {
    let folder = data_dir.join("extensions");
    DirBuilder::new()
        .recursive(true)
        .mode(0o700)
        .create(&folder)?;
    Ok(folder)
}

/// The app id of an extension's page, which a client's trust keeps the builds of.
pub(super) fn app_id(name: &str) -> String {
    format!("dev.uraeda.extension.{name}")
}

/// A page to sign.
pub(super) struct Unsigned<'a> {
    /// The extension's name.
    pub name: &'a str,
    pub title: &'a str,
    /// The extension's own version, as its manifest says.
    pub version: &'a str,
    /// The page's build, which only grows.
    pub build: u64,
    /// The page's compiled code, one module.
    pub source: String,
    pub source_map: Option<String>,
}

/// What signs the pages of this server.
pub(super) struct Signer {
    /// The root's public half, in base64.
    public: String,
    release: SecretKey,
    certificate: Certificate,
}

impl Signer {
    /// Reads the root key of the data folder, or makes it at the first start, and certifies a
    /// new release key with it.
    ///
    /// # Errors
    ///
    /// When the key's file cannot be read, written, or is no key. The message names the file,
    /// never what it holds.
    pub(super) fn open(data_dir: &Path) -> Result<Signer, Failure> {
        let path = folder(data_dir)?.join(KEY);
        let failed =
            |what: &str| format!("the extensions' signing key, {}: {what}", path.display());
        let root = match fs::read_to_string(&path) {
            Ok(text) => SecretKey::from_base64(&text).map_err(|_| failed("it is no key"))?,
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                let root = SecretKey::generate().map_err(|_| failed("no random bytes"))?;
                write(&path, &root).map_err(|error| failed(&error.kind().to_string()))?;
                root
            }
            Err(error) => return Err(failed(&error.kind().to_string()).into()),
        };
        // A file another start left, or a copy, is closed again.
        fs::set_permissions(&path, fs::Permissions::from_mode(0o600))
            .map_err(|error| failed(&error.kind().to_string()))?;
        let release = SecretKey::generate().map_err(|_| failed("no random bytes"))?;
        // The window is all of time: NSH compares it with the time a package says it was signed
        // at, which this server writes. No clock, a client's or the server's, decides trust.
        let apps = [APPS.to_owned()];
        let certificate = certify(&root, &release.public(), &apps, 0, u64::MAX);
        Ok(Signer {
            public: root.public().to_base64(),
            release,
            certificate,
        })
    }

    /// The root's public key, in base64: what a client trusts.
    pub(super) fn public_key(&self) -> &str {
        &self.public
    }

    /// The page as a signed NSH package, with the rights of every page.
    ///
    /// # Errors
    ///
    /// What NSH refused, in its words: none of them says a key.
    pub(super) fn sign(&self, page: Unsigned<'_>) -> Result<Vec<u8>, String> {
        let contents = Contents {
            app: App {
                id: app_id(page.name),
                name: page.title.to_owned(),
                version: page.version.to_owned(),
                build: page.build,
            },
            capabilities: Some(json!({ "host": PAGE_HOST })),
            source: page.source,
            // A package always carries its source, which loads on every runtime version.
            bytecode: None,
            source_map: page.source_map,
            assets: Vec::new(),
            min_runtime: None,
        };
        let built = nsh_package::build(&contents, &self.release, &self.certificate);
        built.map_err(|error| error.to_string())
    }
}

/// Writes a new root key, readable by its owner only.
fn write(path: &Path, root: &SecretKey) -> io::Result<()> {
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(path)?;
    file.write_all(root.to_base64().as_bytes())?;
    file.sync_all()
}
