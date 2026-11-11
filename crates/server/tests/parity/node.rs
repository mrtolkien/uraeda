//! The names the Node server serves, read from its code as it is on this branch: its records and
//! its mutations from `packages/server/src/fate/`, and its routes from `app.ts` and the routers it
//! mounts.
//!
//! TASK 61: the Node server goes. The keys of `parity.toml` are then the frozen list of its names:
//! drop this module and the test's comparison with it, and keep the rest of the test.

use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};

use regex::Regex;

/// What the Node server serves, by name.
pub struct Old {
    /// Its record types, fate's views: `Workspace`.
    pub records: BTreeSet<String>,
    /// Its mutations: `inbox.add`.
    pub actions: BTreeSet<String>,
    /// Its routes, `<METHOD> <path>` in Hono's syntax: `GET /r/:name/raw/*`.
    pub routes: BTreeSet<String>,
}

/// The Node server's source folder.
fn source() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../packages/server/src")
}

/// Reads the Node server's names.
pub fn read() -> Old {
    let fate = sources(&source().join("fate"));
    Old {
        records: matches(&fate, r#"dataView<\w+>\("(\w+)"\)"#),
        actions: matches(&fate, r#"(?m)^\s+"([a-zA-Z]+\.[a-zA-Z]+)":"#),
        routes: routes(),
    }
}

/// The text of each TypeScript file of a folder, its tests left out.
fn sources(folder: &Path) -> Vec<String> {
    let entries = fs::read_dir(folder).expect("the Node server's fate folder");
    let mut texts: Vec<String> = entries
        .map(|entry| entry.expect("a file of the folder").path())
        .filter(|path| path.extension().is_some_and(|extension| extension == "ts"))
        .map(|path| fs::read_to_string(path).expect("a source file"))
        .collect();
    assert!(!texts.is_empty(), "no source in {}", folder.display());
    texts.sort();
    texts
}

/// The first group of each match of a pattern in the texts.
fn matches(texts: &[String], pattern: &str) -> BTreeSet<String> {
    let pattern = Regex::new(pattern).expect("a pattern");
    texts
        .iter()
        .flat_map(|text| pattern.captures_iter(text))
        .map(|found| found[1].to_owned())
        .collect()
}

/// The routes of `app.ts`: its own, and those of each router it mounts, as
/// `app.route("<prefix>", router(..))` or `router(app, ..)`, read in the module its import names.
/// A route's path written `${base}/..` is the path of each `endpoint("<base>", ..)` of the file.
fn routes() -> BTreeSet<String> {
    let app = fs::read_to_string(source().join("app.ts")).expect("app.ts");
    let mut found = declared(&app, "");
    let mounted = Regex::new(r#"app\.route\("([^"]*)", (\w+)\("#).expect("a pattern");
    let given = Regex::new(r"\n\s+(\w+)\(app, ").expect("a pattern");
    let mounts = mounted
        .captures_iter(&app)
        .map(|mount| (mount[1].to_owned(), mount[2].to_owned()));
    let mounts = mounts.chain(
        given
            .captures_iter(&app)
            .map(|mount| (String::new(), mount[1].to_owned())),
    );
    for (prefix, router) in mounts {
        let Some(module) = imported(&app, &router) else {
            // A function of `app.ts` itself, whose routes are read with the file's.
            continue;
        };
        let text = fs::read_to_string(source().join(&module)).expect("a router's module");
        found.extend(declared(&text, &prefix));
    }
    found
}

/// The module an import of `app.ts` brings a name from: `./files.ts` for `files`.
fn imported(app: &str, name: &str) -> Option<String> {
    let pattern = format!(r#"import \{{[^}}]*\b{name}\b[^}}]*\}} from "\./([^"]+)";"#);
    let pattern = Regex::new(&pattern).expect("a pattern");
    pattern.captures(app).map(|found| found[1].to_owned())
}

/// The routes a file declares on a router, `app.get("/raw/*", ..)`, under a prefix.
fn declared(text: &str, prefix: &str) -> BTreeSet<String> {
    let route =
        Regex::new(r#"\b(?:app|route|routes)\.(get|post|put|delete|all)\(\s*[`"]([^`"]*)[`"]"#)
            .expect("a pattern");
    let bases = Regex::new(r#"\bendpoint\("([^"]*)","#).expect("a pattern");
    let bases: Vec<String> = bases
        .captures_iter(text)
        .map(|base| base[1].to_owned())
        .collect();
    let mut found = BTreeSet::new();
    for each in route.captures_iter(text) {
        let method = each[1].to_uppercase();
        let path = &each[2];
        let paths = if path.contains("${base}") {
            bases
                .iter()
                .map(|base| path.replace("${base}", base))
                .collect()
        } else {
            vec![path.to_owned()]
        };
        for path in paths {
            found.insert(format!("{method} {}", joined(prefix, &path)));
        }
    }
    found
}

/// A router's path under its prefix, without a trailing slash but for the root.
fn joined(prefix: &str, path: &str) -> String {
    let whole = format!("{}{path}", prefix.trim_end_matches('/'));
    match whole.trim_end_matches('/') {
        "" => "/".to_owned(),
        trimmed => trimmed.to_owned(),
    }
}
