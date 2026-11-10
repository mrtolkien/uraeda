//! The pages of the checks, in `app/__checks__/`, compiled as the server will compile an
//! extension's page: with NSH's bundler, in this process.

use std::path::PathBuf;

use nsh_bundler::{BundleOptions, bundle};
use nsh_core::element::description::SetDescription;

/// The folder of the checks' pages.
pub fn folder() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../app/__checks__")
}

/// The compiled source of the page `name`, one module holding the page's own code: `nsh` and
/// `nsh/base` stay imports, which the view's engine serves.
pub fn compiled(name: &str) -> String {
    let options = BundleOptions {
        entry: folder().join(name),
        minify: false,
        split: false,
        ui_sets: vec![SetDescription::from(nsh_base::registry())],
    };
    match bundle(&options) {
        Ok(built) => built.code,
        Err(error) => panic!("{name} does not compile: {}", error.plain),
    }
}
