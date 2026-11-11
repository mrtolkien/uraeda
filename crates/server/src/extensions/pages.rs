//! Extension pages: an extension's page entry, built into one module with NSH's bundler,
//! signed as an NSH package, and served to the signed-in clients, which run it in a view of
//! its own.
//!
//! - **What a page is built from**: its entry and the files it imports, all inside the
//!   extension's folder, and four modules by name: `nsh` and `nsh/base`, which the client's
//!   engine serves, and `uraeda/ui` and `uraeda/page`, which are built into the page from the
//!   [modules' folder](modules). A file anywhere else fails the build: an extension loads only
//!   from the config folder.
//! - **Its first statement posts `start` to its host**, then it runs the page's code and says
//!   how that ended, `loaded` or `problem`: the entry is the protocol's [`page_entry`].
//! - **A build that fails keeps the last package**, and says why in the extension's problems.
//! - **A build is numbered**, by [`builds`](super::builds): the page's version, which the
//!   record `Extensions` shows as `pageVersion`. A page built again from the same code keeps
//!   its package and its version, so a client loads it again only when it changed.
//!
//! The routes are `GET /extensions/key` and `GET /extensions/{name}/page`, closed like every
//! route of the server.

use std::fs;
use std::path::{Path, PathBuf};

use axum::body::Bytes;
use axum::extract::{Path as Named, State};
use axum::http::header::{CACHE_CONTROL, CONTENT_TYPE, ETAG, IF_NONE_MATCH};
use axum::http::{HeaderMap, HeaderName, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use nsh_bundler::{Bundle, BundleOptions, bundle};
use nsh_core::element::description::SetDescription;
use serde_json::json;
use sha2::{Digest as _, Sha256};
use uraeda_core::extensions::Extension;
use uraeda_protocol::page_entry;

use super::graph::{Problem, inside};
use super::loader::Page;
use super::signing::{self, Unsigned};
use super::{Extensions, builds};
use crate::http::Routes;
use crate::shared::Shared;

/// The answer's header that says which version of the page its body is.
const VERSION: HeaderName = HeaderName::from_static("x-uraeda-page-version");

/// The variable of the server's environment that names another modules' folder: `app/` of a
/// checkout, or a test's stand-ins.
const MODULES_FOLDER: &str = "URAEDA_PAGE_MODULES";

/// The modules a page imports by name and gets built in, each a file of the
/// [modules' folder](modules), laid out as `app/` is.
const MODULES: [(&str, &str); 2] = [
    ("uraeda/ui", "ui/index.ts"),
    ("uraeda/page", "extensions/page.tsx"),
];

/// The files a page is built from end in one of these: an image or a font would be an asset
/// of the package, which a page's package does not carry.
const CODE: [&str; 5] = ["ts", "tsx", "js", "jsx", "json"];

/// The most folders of an extension watched after a build that failed.
const MOST_FOLDERS: usize = 64;

/// What a build made of an extension's page.
pub(super) enum Outcome {
    /// A new version, signed.
    Built(Page),
    /// The same code as the running version's: it stays.
    Same,
    /// Why it did not build: the running version stays.
    Failed(Vec<Problem>),
}

/// A build's outcome, and the folders of the extension, from its folder, whose changes build
/// it again.
pub(super) struct Paged {
    pub outcome: Outcome,
    pub folders: Vec<PathBuf>,
}

/// Mounts the pages' two routes.
pub(super) fn mount(routes: &mut Routes) {
    routes.route("/extensions/key", get(key));
    routes.route("/extensions/{name}/page", get(page));
}

/// Where `uraeda/ui` and `uraeda/page` are built from: `ui/index.ts` and `extensions/page.tsx`
/// of the folder the server's environment names, else of `extensions/modules/` in the data
/// folder.
fn modules(shared: &Shared) -> PathBuf {
    let folder = match shared.environment().var(MODULES_FOLDER) {
        Some(folder) => PathBuf::from(folder),
        None => shared.data_dir().join("extensions").join("modules"),
    };
    fs::canonicalize(&folder).unwrap_or(folder)
}

/// Builds and signs an extension's page, from its entry `page`, absolute. `running` is what
/// the running version was built from, [`Page::print`].
pub(super) fn build(
    shared: &Shared,
    extension: &Extension,
    page: &Path,
    running: Option<&str>,
) -> Paged {
    let folder = PathBuf::from(&extension.folder);
    let entered = fs::canonicalize(page).unwrap_or_else(|_| page.to_owned());
    let failed = |problems: Vec<Problem>| Paged {
        outcome: Outcome::Failed(problems),
        folders: every_folder(&folder),
    };
    let Some(entry) = inside(&folder, &entered) else {
        let message = format!("{} leaves the extension's folder", page.display());
        return failed(vec![Problem::of("", message)]);
    };
    let built = bundled(shared, &extension.name, &folder, &entered).and_then(|bundle| {
        let folders = sources(shared, &folder, &bundle)?;
        Ok((bundle, folders))
    });
    let (bundle, folders) = match built {
        Ok(built) => built,
        Err(message) => return failed(vec![Problem::of(&entry, message)]),
    };
    let print = print_of(extension, &bundle.code);
    if running == Some(print.as_str()) {
        let outcome = Outcome::Same;
        return Paged { outcome, folders };
    }
    match signed(shared, extension, bundle) {
        Ok((version, package)) => {
            let page = Page {
                version,
                entry,
                package: Bytes::from(package),
                print,
            };
            let outcome = Outcome::Built(page);
            Paged { outcome, folders }
        }
        Err(message) => failed(vec![Problem::of(&entry, message)]),
    }
}

/// The folder a page is built in, in the data folder: the build's entry and its `nsh.json`.
fn build_folder(shared: &Shared, name: &str) -> std::io::Result<PathBuf> {
    Ok(signing::folder(shared.data_dir())?.join("pages").join(name))
}

/// Removes what the builds of an extension gone from the folder left in the data folder.
pub(super) fn forget(shared: &Shared, name: &str) {
    if let Ok(build) = build_folder(shared, name) {
        // A folder that is not there is removed already.
        let _ = fs::remove_dir_all(build);
    }
}

/// The page as one module: the build's own entry, in a folder of the data folder, posts
/// `start`, then imports the page. The `nsh.json` beside it is the build's, never the
/// extension's: it names where `uraeda/ui` and `uraeda/page` are. `uraeda/native`, which
/// `uraeda/ui` calls, stays an import, which the app serves every page's engine.
fn bundled(shared: &Shared, name: &str, folder: &Path, page: &Path) -> Result<Bundle, String> {
    let unwritten = |error: std::io::Error| format!("the page's build folder: {}", error.kind());
    let build = build_folder(shared, name).map_err(unwritten)?;
    fs::create_dir_all(&build).map_err(unwritten)?;
    let modules = modules(shared);
    let alias = MODULES.map(|(module, file)| (module.to_owned(), json!(modules.join(file))));
    let alias: serde_json::Map<String, serde_json::Value> = alias.into_iter().collect();
    let setup = json!({ "resolve": { "alias": alias } });
    let files = [
        ("entry.ts", page_entry(&page.to_string_lossy())),
        ("nsh.json", setup.to_string()),
    ];
    for (file, text) in files {
        fs::write(build.join(file), text).map_err(unwritten)?;
    }
    let options = BundleOptions {
        entry: build.join("entry.ts"),
        // Readable in a client's log, which names a page's errors.
        minify: false,
        split: false,
        ui_sets: vec![
            SetDescription::from(nsh_base::registry()),
            SetDescription::from(uraeda_app::registry()),
        ],
    };
    bundle(&options).map_err(|error| {
        let message = error.plain.trim();
        // One of the app's modules this server does not hold: the bundler says only that it is
        // not found.
        let unheld = |(module, file): &(&str, &str)| {
            message.contains(&format!("'{module}'")) && !modules.join(file).is_file()
        };
        match MODULES.iter().find(|module| unheld(module)) {
            Some((module, _)) => {
                format!("{module} cannot be imported: this server holds no such module yet")
            }
            None => plain(&plain(message, folder), &build),
        }
    })
}

/// A bundler's message with the paths under `folder` written from it: the bundler writes them
/// from the build's folder, as `../../home/me/.config/uraeda/extensions/wiki/page.tsx`.
fn plain(message: &str, folder: &Path) -> String {
    let absolute = format!("{}/", folder.display());
    let mut pieces = message.split(absolute.trim_start_matches('/'));
    let mut plain = pieces.next().unwrap_or_default().to_owned();
    for piece in pieces {
        // `../../` before a path written from the build's folder, `/` before an absolute one.
        let climbed = plain.trim_end_matches("../").len();
        let rooted = plain.strip_suffix('/').map_or(plain.len(), str::len);
        plain.truncate(climbed.min(rooted));
        plain.push_str(piece);
    }
    plain
}

/// Checks where the build read its files, and gives the folders of the extension's own, from
/// its folder: one outside the extension's folder, the modules' folder, and the build's own
/// folder is refused, and so is one that is no code.
fn sources(shared: &Shared, folder: &Path, bundle: &Bundle) -> Result<Vec<PathBuf>, String> {
    let ours = [
        modules(shared),
        signing::folder(shared.data_dir()).map_err(|error| error.kind().to_string())?,
    ];
    let mut folders = vec![PathBuf::new()];
    for file in &bundle.watch_files {
        let real = fs::canonicalize(file).unwrap_or_else(|_| file.clone());
        if ours.iter().any(|folder| real.starts_with(folder)) {
            continue;
        }
        let Some(own) = inside(folder, &real) else {
            return Err(format!(
                "{} is outside the extension's folder: a page imports only its own files, nsh, \
                 nsh/base, uraeda/ui, and uraeda/page",
                file.display()
            ));
        };
        let ending = real.extension().and_then(|ending| ending.to_str());
        if !ending.is_some_and(|ending| CODE.contains(&ending)) {
            return Err(format!(
                "{own} cannot be imported: a page is built from .ts, .tsx, .js, .jsx, and .json \
                 files"
            ));
        }
        let parent = Path::new(&own).parent().unwrap_or(Path::new(""));
        if !folders.iter().any(|known| known == parent) {
            folders.push(parent.to_owned());
        }
    }
    Ok(folders)
}

/// Numbers the build, and signs it.
fn signed(
    shared: &Shared,
    extension: &Extension,
    bundle: Bundle,
) -> Result<(u64, Vec<u8>), String> {
    let uncounted = |error: std::io::Error| {
        let kind = error.kind();
        format!("the pages' build counter in the data folder cannot be kept: {kind}")
    };
    let version = builds::next(shared.data_dir()).map_err(uncounted)?;
    let title = match extension.title.as_str() {
        "" => extension.name.as_str(),
        title => title,
    };
    let page = Unsigned {
        name: &extension.name,
        title,
        version: &extension.version,
        build: version,
        source: bundle.code,
        source_map: bundle.source_map,
    };
    let package = shared.get::<Extensions>().signer().sign(page)?;
    Ok((version, package))
}

/// What a package is built from, as one short text: what the manifest says of it, and its
/// code.
fn print_of(extension: &Extension, code: &str) -> String {
    let mut hash = Sha256::new();
    for part in [&extension.title, &extension.version, code] {
        hash.update(part.len().to_le_bytes());
        hash.update(part.as_bytes());
    }
    hash.finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

/// Every folder of an extension, from its folder, the folder itself first: what is watched
/// after a build that failed, since the bundler does not say where it looked. Hidden folders
/// and `node_modules` are left out, and no more than [`MOST_FOLDERS`] are given.
fn every_folder(root: &Path) -> Vec<PathBuf> {
    let mut folders = vec![PathBuf::new()];
    let mut next = 0;
    while next < folders.len() && folders.len() < MOST_FOLDERS {
        let Ok(entries) = fs::read_dir(root.join(&folders[next])) else {
            next += 1;
            continue;
        };
        let mut inner: Vec<PathBuf> = entries
            .filter_map(Result::ok)
            .filter(|entry| entry.file_type().is_ok_and(|kind| kind.is_dir()))
            .map(|entry| entry.file_name())
            .filter(|name| {
                let name = name.to_string_lossy();
                !name.starts_with('.') && name != "node_modules"
            })
            .map(|name| folders[next].join(name))
            .collect();
        inner.sort();
        folders.extend(inner);
        next += 1;
    }
    folders.truncate(MOST_FOLDERS);
    folders
}

/// `GET /extensions/key`: the public key the pages are signed under, in base64, which a
/// client trusts for this server's pages.
async fn key(State(shared): State<Shared>) -> Response {
    let key = shared.get::<Extensions>().signer().public_key().to_owned();
    let headers = [
        (CONTENT_TYPE, "text/plain; charset=utf-8"),
        (CACHE_CONTROL, "no-store"),
    ];
    (headers, key).into_response()
}

/// `GET /extensions/{name}/page`: the running page of an extension, as a signed NSH package,
/// with its version. A client that names the version it holds, in `If-None-Match`, is told
/// when it has not changed.
async fn page(
    State(shared): State<Shared>,
    Named(name): Named<String>,
    asked: HeaderMap,
) -> Response {
    let Some((version, package)) = shared.get::<Extensions>().page(&name) else {
        let message = format!("{name} has no page");
        return (StatusCode::NOT_FOUND, message).into_response();
    };
    let tag = format!("\"{version}\"");
    let headers = [
        (ETAG, tag.clone()),
        (VERSION, version.to_string()),
        // A client asks again each time, and is answered from what it holds when it is the same.
        (CACHE_CONTROL, "private, no-cache".to_owned()),
        (CONTENT_TYPE, "application/octet-stream".to_owned()),
    ];
    let held = asked.get(IF_NONE_MATCH).and_then(|held| held.to_str().ok());
    if held == Some(tag.as_str()) {
        return (StatusCode::NOT_MODIFIED, headers).into_response();
    }
    (headers, package).into_response()
}
