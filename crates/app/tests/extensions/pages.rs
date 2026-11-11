//! The fixture extensions' pages, built and signed as the server builds and signs them
//! (`crates/server/src/extensions/{pages,signing}.rs`): from the protocol's entry, with the
//! app's own `uraeda/ui` and `uraeda/page` built in, and the rights of every page.

use std::fs;
use std::path::{Path, PathBuf};

use nsh_bundler::{BundleOptions, bundle};
use nsh_core::element::description::SetDescription;
use nsh_package::{App, Certificate, Contents, SecretKey, certify};
use serde_json::json;
use uraeda_protocol::{PAGE_HOST, page_entry};

/// The repository's folder.
fn repository() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

/// The fixture extension `name`'s folder.
pub fn fixture(name: &str) -> PathBuf {
    repository().join("fixtures/extensions").join(name)
}

/// Signs pages as one server does: under a root key, certified for every extension's page.
pub struct Signer {
    root: SecretKey,
    release: SecretKey,
    certificate: Certificate,
}

impl Signer {
    pub fn made() -> Signer {
        let root = SecretKey::generate().expect("a root key");
        let release = SecretKey::generate().expect("a release key");
        let apps = ["dev.uraeda.extension.*".to_owned()];
        let certificate = certify(&root, &release.public(), &apps, 0, u64::MAX);
        Signer {
            root,
            release,
            certificate,
        }
    }

    /// The public key the server gives its clients, in base64.
    pub fn key(&self) -> String {
        self.root.public().to_base64()
    }

    /// The page of the extension in `folder`, named `name`, as the package of its build `build`.
    pub fn page(&self, folder: &Path, name: &str, build: u64) -> Vec<u8> {
        let contents = Contents {
            app: App {
                id: format!("dev.uraeda.extension.{name}"),
                name: name.to_owned(),
                version: "0.1.0".to_owned(),
                build,
            },
            capabilities: Some(json!({ "host": PAGE_HOST })),
            source: built(&folder.join("page.tsx")),
            bytecode: None,
            source_map: None,
            assets: Vec::new(),
            min_runtime: None,
        };
        nsh_package::build(&contents, &self.release, &self.certificate).expect("a signed page")
    }
}

/// The page whose entry is `page` as one module, built as the server builds it.
fn built(page: &Path) -> String {
    let build = tempfile::tempdir().expect("a build folder");
    let app = repository().join("app");
    let alias = json!({
        "uraeda/ui": app.join("ui/index.ts"),
        "uraeda/page": app.join("extensions/page.tsx"),
    });
    let setup = json!({ "resolve": { "alias": alias } });
    let entry = build.path().join("entry.ts");
    fs::write(&entry, page_entry(&page.to_string_lossy())).expect("the entry");
    fs::write(build.path().join("nsh.json"), setup.to_string()).expect("the build's nsh.json");
    let options = BundleOptions {
        entry,
        minify: false,
        split: false,
        ui_sets: vec![
            SetDescription::from(nsh_base::registry()),
            SetDescription::from(uraeda_app::registry()),
        ],
    };
    match bundle(&options) {
        Ok(built) => built.code,
        Err(error) => panic!("{} does not build: {}", page.display(), error.plain),
    }
}
