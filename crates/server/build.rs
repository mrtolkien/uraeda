use std::env;
use std::fmt::Write as _;
use std::fs;
use std::path::{Path, PathBuf};

#[path = "../core/build/track.rs"]
mod track;

fn main() {
    // The app's modules a page is built with, embedded with include_dir, which does not track the
    // files it reads: without this, an incremental build kept an old copy (`src/extensions/modules.rs`).
    track::track("../../app/ui");
    track::track("../../app/extensions");
    embed_web_build();
}

/// Writes `web_build.rs`, the files of the app's web build as `src/http/web.rs` holds them:
/// those of the folder `URAEDA_WEB_BUILD` names as `ura` is compiled, which `just web-build`
/// makes, or none. A build of the server never needs the web build: `just package` and the
/// release name it. A file that has a gzip form is held compressed alone, and inflated for the
/// rare client that takes no encoding.
fn embed_web_build() {
    println!("cargo:rerun-if-env-changed=URAEDA_WEB_BUILD");
    let mut files = Vec::new();
    if let Some(folder) = env::var_os("URAEDA_WEB_BUILD").filter(|folder| !folder.is_empty()) {
        let folder = fs::canonicalize(&folder)
            .unwrap_or_else(|error| panic!("URAEDA_WEB_BUILD, {}: {error}", folder.display()));
        assert!(
            folder.join("index.html").exists(),
            "URAEDA_WEB_BUILD, {}, holds no index.html: run `just web-build`",
            folder.display()
        );
        track::track(&folder.to_string_lossy());
        walk(&folder, "", &mut files);
    }
    files.sort();
    let held = |path: &String| files.iter().any(|(other, _)| other == path);
    let mut code = String::from("static FILES: &[(&str, &[u8])] = &[\n");
    for (path, file) in &files {
        if held(&format!("{path}.gz")) {
            continue;
        }
        let _ = writeln!(code, "    ({path:?}, include_bytes!({file:?})),");
    }
    code.push_str("];\n");
    let out = PathBuf::from(env::var_os("OUT_DIR").expect("Cargo sets OUT_DIR"));
    fs::write(out.join("web_build.rs"), code).expect("the build's folder is written");
}

/// Every file under `folder`, by its path from the build's folder.
fn walk(folder: &Path, under: &str, files: &mut Vec<(String, PathBuf)>) {
    for entry in fs::read_dir(folder)
        .expect("a folder of the web build")
        .flatten()
    {
        let name = entry
            .file_name()
            .into_string()
            .expect("a name that is text");
        if entry.path().is_dir() {
            walk(&entry.path(), &format!("{under}{name}/"), files);
        } else {
            files.push((format!("{under}{name}"), entry.path()));
        }
    }
}
