//! The story warmer: fetches a story's page and its modules from its preview, as a browser would,
//! so that the preview compiles them before the story's frame shows. Each story is compiled
//! once per run of its preview, shared by every ask, and counts as ended once it passes its
//! time.

// TASK 51: the previews of the folders that wait for the human start as the server starts, and
// a feature's as its turn ends done (`preview::warm_waiting`), but their linked stories still
// compile at their first read (ruling R83): `Runner::compiled` is what compiles one ahead.

use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, LazyLock, Mutex, PoisonError};
use std::time::Duration;

use axum::http::StatusCode;
use regex::Regex;
use tokio::task::{AbortHandle, JoinSet};

use super::index::Entry;
use super::upstream;
use crate::http::segment;

/// How long a story's compile may take before its frame shows anyway.
const LIMIT: Duration = Duration::from_secs(60);

/// How many requests the warmer sends at once.
const AT_ONCE: usize = 6;

/// The scripts of a page: their attributes, and the inline ones' text.
static SCRIPT: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?is)<script\b([^>]*)>(.*?)</script>").expect("a pattern"));

/// A script's `type`, when it is a module's.
static MODULE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r#"(?i)\btype\s*=\s*["']?module\b"#).expect("a pattern"));

/// A script's `src`.
static SOURCE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r#"(?i)\bsrc\s*=\s*["']([^"']+)["']"#).expect("a pattern"));

/// A static import's specifier: `import .. from "x"`, `import "x"`, or `export .. from "x"`, at
/// a statement's start, or after a comment. Never a dynamic import.
static IMPORT: LazyLock<Regex> = LazyLock::new(|| {
    let pattern = r#"(?:^|[;\n}/])\s*(?:import\s*(?:[\w*$\s{},]+?\s*from\s*)?|export\s*[\w*$\s{},]*?\s*from\s*)["']([^"'\n]+)["']"#;
    Regex::new(pattern).expect("a pattern")
});

/// One story's compile: whether it ended, and its task.
struct Compile {
    ended: Arc<AtomicBool>,
    task: AbortHandle,
}

/// The compiles of one ready preview, on its port, served under its base.
pub(super) struct Compiles {
    port: u16,
    base: String,
    stories: Mutex<HashMap<String, Compile>>,
    /// Called as each compile ends, unless its preview stopped first.
    on_end: Box<dyn Fn() + Send + Sync>,
}

impl Compiles {
    pub(super) fn new(
        port: u16,
        base: &str,
        on_end: impl Fn() + Send + Sync + 'static,
    ) -> Arc<Compiles> {
        Arc::new(Compiles {
            port,
            base: base.to_owned(),
            stories: Mutex::default(),
            on_end: Box::new(on_end),
        })
    }

    /// Whether the story's compile ended or passed its time: the first ask starts it, and the
    /// later ones share it.
    pub(super) fn ended(self: &Arc<Self>, story: &Entry) -> bool {
        let mut stories = self.stories.lock().unwrap_or_else(PoisonError::into_inner);
        let compile = stories.entry(story.id.clone()).or_insert_with(|| {
            let ended = Arc::new(AtomicBool::new(false));
            let (compiles, story, done) = (self.clone(), story.clone(), ended.clone());
            let task = tokio::spawn(async move {
                let warming = warm_story(compiles.port, &compiles.base, &story);
                let _ = tokio::time::timeout(LIMIT, warming).await;
                done.store(true, Ordering::Release);
                (compiles.on_end)();
            });
            Compile {
                ended,
                task: task.abort_handle(),
            }
        });
        compile.ended.load(Ordering::Acquire)
    }

    /// Aborts every compile, as their preview stops: their ends call nothing.
    pub(super) fn abort(&self) {
        let stories = self.stories.lock().unwrap_or_else(PoisonError::into_inner);
        stories.values().for_each(|compile| compile.task.abort());
    }
}

/// Fetches the story's page from the preview on `port`, the module scripts it holds, and the
/// story's file, then follows each JavaScript answer's static imports on the same server, each
/// address once, at most `AT_ONCE` at a time. A path under `base` is fetched with `base` cut to
/// `/`, as the proxy forwards it. It ends once every fetch answered or failed.
async fn warm_story(port: u16, base: &str, story: &Entry) {
    let id = segment(&story.id);
    let file = story.import_path.trim_start_matches("./");
    let first = [
        format!("/iframe.html?id={id}&viewMode=story"),
        format!("/{file}"),
    ];
    let mut seen: HashSet<String> = first.iter().cloned().collect();
    let mut waiting: VecDeque<String> = first.into();
    let mut fetching = JoinSet::new();
    loop {
        while fetching.len() < AT_ONCE
            && let Some(address) = waiting.pop_front()
        {
            fetching.spawn(async move {
                let loaded = loads(port, &address).await;
                (address, loaded)
            });
        }
        let Some(fetched) = fetching.join_next().await else {
            return;
        };
        let (from, specifiers) = fetched.unwrap_or_default();
        for specifier in specifiers {
            let next = resolved(&specifier, &from, port).map(|address| cut(&address, base));
            if let Some(address) = next.filter(|address| seen.insert(address.clone())) {
                waiting.push_back(address);
            }
        }
    }
}

/// The specifiers an address's answer loads, when it is a 200 of JavaScript or HTML: a page's
/// module scripts, or a module's static imports.
async fn loads(port: u16, address: &str) -> Vec<String> {
    let got = upstream::get(port, address).await;
    let Some(got) = got.filter(|got| got.status == StatusCode::OK) else {
        return Vec::new();
    };
    let text = String::from_utf8_lossy(&got.body);
    if got.kind.contains("html") {
        page_modules(&text)
    } else if got.kind.contains("javascript") {
        static_imports(&text)
    } else {
        Vec::new()
    }
}

/// The specifiers a page loads: its module scripts' `src`, an address even without `./`, and
/// its inline modules' imports.
fn page_modules(html: &str) -> Vec<String> {
    let mut specifiers = Vec::new();
    for script in SCRIPT.captures_iter(html) {
        let (attributes, text) = (&script[1], &script[2]);
        if !MODULE.is_match(attributes) {
            continue;
        }
        match SOURCE.captures(attributes) {
            Some(source) if addressed(&source[1]) => specifiers.push(source[1].to_owned()),
            Some(source) => specifiers.push(format!("./{}", &source[1])),
            None => specifiers.extend(static_imports(text)),
        }
    }
    specifiers
}

/// The specifiers of a module's static imports and re-exports.
fn static_imports(code: &str) -> Vec<String> {
    let imports = IMPORT.captures_iter(code);
    imports.map(|import| import[1].to_owned()).collect()
}

/// Whether a specifier is an address: relative, absolute, or a whole URL. Any other is a bare
/// package name, which only a bundler resolves.
fn addressed(specifier: &str) -> bool {
    specifier.starts_with(['.', '/'])
        || specifier.starts_with("http:")
        || specifier.starts_with("https:")
}

/// The address `specifier` names from the address `from`, as a path and its query on the
/// preview's own server: none for a bare package name, and for another server's address.
fn resolved(specifier: &str, from: &str, port: u16) -> Option<String> {
    let specifier = specifier.split('#').next().unwrap_or_default();
    if !addressed(specifier) {
        return None;
    }
    if specifier.starts_with("http") {
        let own = format!("http://{}", upstream::host(port));
        let path = specifier.strip_prefix(&own)?;
        return path.starts_with('/').then(|| path.to_owned());
    }
    if specifier.starts_with("//") {
        return None;
    }
    let (path, query) = specifier
        .split_once('?')
        .map_or((specifier, None), |(path, query)| (path, Some(query)));
    let folder = from.split('?').next().unwrap_or_default();
    let folder = folder.rsplit_once('/').map_or("", |(folder, _)| folder);
    let joined = if path.starts_with('/') {
        path.to_owned()
    } else {
        format!("{folder}/{path}")
    };
    let mut parts: Vec<&str> = Vec::new();
    for part in joined.split('/') {
        match part {
            "" | "." => {}
            ".." => drop(parts.pop()),
            part => parts.push(part),
        }
    }
    let path = format!("/{}", parts.join("/"));
    Some(query.map_or(path.clone(), |query| format!("{path}?{query}")))
}

/// An address with the preview's base cut to `/`.
fn cut(address: &str, base: &str) -> String {
    match address.strip_prefix(base) {
        Some(rest) if base != "/" => format!("/{rest}"),
        _ => address.to_owned(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_page_loads_its_module_scripts_and_a_module_its_static_imports() {
        let page = r#"<script src="classic.js"></script>
            <script type="module" src="story.js"></script>
            <script type="module">import "./inline.js"; import("./dynamic.js");</script>"#;
        let module = "import a from './a.js';\nimport { b } from \"/src/b.ts\";\n\
            export * from '../c.js';\nimport react from 'react';\nconst d = import('./d.js');\n";

        assert_eq!(page_modules(page), ["./story.js", "./inline.js"]);
        assert_eq!(
            static_imports(module),
            ["./a.js", "/src/b.ts", "../c.js", "react"]
        );

        let from = "/src/views/Story.tsx?v=1";
        let at = |specifier| resolved(specifier, from, 6006);
        assert_eq!(at("./a.js").as_deref(), Some("/src/views/a.js"));
        assert_eq!(at("../c.js?import#x").as_deref(), Some("/src/c.js?import"));
        assert_eq!(
            at("/r/repo/preview/s/main/b.ts").as_deref(),
            Some("/r/repo/preview/s/main/b.ts")
        );
        assert_eq!(at("http://127.0.0.1:6006/e.js").as_deref(), Some("/e.js"));
        assert_eq!(at("https://example.com/e.js"), None);
        assert_eq!(at("react"), None);
        assert_eq!(
            cut("/r/repo/preview/s/main/b.ts", "/r/repo/preview/s/main/"),
            "/b.ts"
        );
    }
}
