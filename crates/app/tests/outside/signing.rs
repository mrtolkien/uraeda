//! Keys made for a test, and a page packaged and signed with them, as the server will sign an
//! extension's page with the key of its data folder.

use std::time::{SystemTime, UNIX_EPOCH};

use nsh_package::{App, Certificate, Contents, SecretKey, TrustStore, certify};
use serde_json::json;

/// The ids the test's release key may sign for.
const APPS: &str = "dev.uraeda.extension.*";

/// A root key, which a client trusts, and the release key it certifies, which signs packages.
pub struct Keys {
    pub root: SecretKey,
    release: SecretKey,
    certificate: Certificate,
}

impl Keys {
    /// New keys: the release key may sign extension pages for the next hour.
    pub fn made() -> Keys {
        let root = SecretKey::generate().expect("a root key");
        let release = SecretKey::generate().expect("a release key");
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("a clock after 1970")
            .as_secs();
        let certificate = certify(
            &root,
            &release.public(),
            &[APPS.to_owned()],
            now - 60,
            now + 3600,
        );
        Keys {
            root,
            release,
            certificate,
        }
    }

    /// The page `source` as a signed package, its build numbered `build`, which may post `ready`
    /// to its host and nothing else.
    pub fn package(&self, source: String, build: u64) -> Vec<u8> {
        let contents = Contents {
            app: App {
                id: "dev.uraeda.extension.check".to_owned(),
                name: "Check".to_owned(),
                version: "1".to_owned(),
                build,
            },
            capabilities: Some(json!({ "host": ["ready"] })),
            source,
            bytecode: None,
            source_map: None,
            assets: Vec::new(),
            min_runtime: None,
        };
        nsh_package::build(&contents, &self.release, &self.certificate).expect("a signed package")
    }

    /// `package` signed again with these keys, as someone who is not the server would.
    pub fn sign_again(&self, package: &[u8]) -> Vec<u8> {
        nsh_package::resign(package, &self.release, &self.certificate).expect("a package re-signed")
    }

    /// A client's trust: packages signed under this root, and no other.
    pub fn trust(&self) -> TrustStore {
        let mut trust = TrustStore::new();
        trust.add_root(self.root.public());
        trust
    }
}

/// `package` with its signature, its last 64 bytes, blanked: the same files, signed by no one.
pub fn unsigned(package: &[u8]) -> Vec<u8> {
    let mut bytes = package.to_vec();
    let signature = bytes.len() - 64;
    bytes[signature..].fill(0);
    bytes
}
