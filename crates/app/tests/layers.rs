//! What an extension's page is built with holds none of the app's store or screens. The server
//! builds every page with `uraeda/ui` (`app/ui/index.ts`) and `uraeda/page`
//! (`app/extensions/page.tsx`), and writes only `app/ui/` and `app/extensions/` beside it: a file
//! those reach, at any depth, that imports `app/store/` fails every page's build (ruling R355,
//! where `FieldRow` reached the store through `usePane`). The direct rules of each folder are
//! `.oxlintrc.json`'s `no-restricted-imports`; this test follows the imports through.

use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Component, Path, PathBuf};

/// The modules a page imports, from `app/`.
const ENTRIES: &[&str] = &["ui/index.ts", "extensions/page.tsx"];

/// The folders of `app/` the server writes for a page to be built with.
const WRITTEN: &[&str] = &["ui/", "extensions/"];

/// The relative imports of a source that stay in its build: not `import type`, `export type`, nor
/// an import whose every name is a type.
fn imports(text: &str) -> Vec<String> {
    let mut found = Vec::new();
    for statement in statements(text) {
        let Some(spec) = specifier(statement) else {
            continue;
        };
        if spec.starts_with('.') && !types_only(statement) {
            found.push(spec.to_owned());
        }
    }
    found
}

/// Each `import` or `export ... from` statement, from its first word to its `;`.
fn statements(text: &str) -> Vec<&str> {
    let mut found = Vec::new();
    let mut rest = text;
    let mut line_start = true;
    let mut at = 0;
    while at < rest.len() {
        let tail = &rest[at..];
        if line_start && (tail.starts_with("import") || tail.starts_with("export")) {
            let end = tail.find(';').map_or(tail.len(), |end| end + 1);
            found.push(&tail[..end]);
            rest = &tail[end..];
            at = 0;
            line_start = false;
            continue;
        }
        let ch = tail.chars().next().unwrap();
        line_start = ch == '\n';
        at += ch.len_utf8();
    }
    found
}

/// The module a statement names, the quoted text after `from`, or after a bare `import`.
fn specifier(statement: &str) -> Option<&str> {
    let quoted = statement
        .rsplit_once(" from ")
        .map(|(_, after)| after)
        .or_else(|| statement.strip_prefix("import "))?
        .trim();
    let quote = quoted
        .chars()
        .next()
        .filter(|ch| *ch == '"' || *ch == '\'')?;
    quoted[1..].split(quote).next()
}

/// Whether a statement brings types alone, which the build erases.
fn types_only(statement: &str) -> bool {
    let head = statement
        .trim_start_matches("import")
        .trim_start_matches("export")
        .trim_start();
    if head.starts_with("type ") || head.starts_with("type{") {
        return true;
    }
    match (head.find('{'), head.find('}')) {
        (Some(open), Some(close)) if head[..open].trim().is_empty() => head[open + 1..close]
            .split(',')
            .map(str::trim)
            .filter(|name| !name.is_empty())
            .all(|name| name.starts_with("type ")),
        _ => false,
    }
}

/// The file an import names, as the bundler finds it: the path, or with `.ts`, `.tsx`, or an
/// `index` of its folder.
fn resolve(from: &Path, spec: &str) -> Option<PathBuf> {
    let mut path = from.parent()?.to_path_buf();
    for part in Path::new(spec).components() {
        match part {
            Component::ParentDir => {
                path.pop();
            }
            Component::Normal(name) => path.push(name),
            _ => {}
        }
    }
    let name = path.file_name()?.to_string_lossy().into_owned();
    [
        path.clone(),
        path.with_file_name(format!("{name}.ts")),
        path.with_file_name(format!("{name}.tsx")),
        path.join("index.ts"),
        path.join("index.tsx"),
    ]
    .into_iter()
    .find(|candidate| candidate.is_file())
}

#[test]
fn what_a_page_is_built_with_reads_no_store_and_no_screen() {
    let app = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../app");
    // Each file reached, with the file that imported it, to name the chain.
    let mut reached: BTreeMap<PathBuf, Option<PathBuf>> = BTreeMap::new();
    let mut waiting: Vec<(PathBuf, Option<PathBuf>)> = ENTRIES
        .iter()
        .map(|entry| (app.join(entry), None))
        .collect();
    while let Some((file, by)) = waiting.pop() {
        if reached.contains_key(&file) {
            continue;
        }
        let text =
            fs::read_to_string(&file).unwrap_or_else(|_| panic!("{} is read", file.display()));
        reached.insert(file.clone(), by);
        for spec in imports(&text) {
            let target = resolve(&file, &spec)
                .unwrap_or_else(|| panic!("{} imports {spec}, which is no file", file.display()));
            waiting.push((target, Some(file.clone())));
        }
    }
    assert!(
        reached.len() > 50,
        "the page's modules reach {} files",
        reached.len()
    );

    let relative = |path: &Path| {
        path.strip_prefix(&app)
            .unwrap()
            .to_string_lossy()
            .into_owned()
    };
    let outside: BTreeSet<String> = reached
        .keys()
        .map(|path| relative(path))
        .filter(|path| !WRITTEN.iter().any(|folder| path.starts_with(folder)))
        .collect();
    let chains: Vec<String> = outside
        .iter()
        .map(|path| {
            let mut chain = vec![path.clone()];
            let mut at = reached[&app.join(path)].clone();
            while let Some(by) = at {
                chain.push(relative(&by));
                at = reached[&by].clone();
            }
            chain.reverse();
            chain.join(" -> ")
        })
        .collect();
    assert!(
        chains.is_empty(),
        "what an extension's page is built with reaches files the server does not write beside it, \
         and every page's build fails. Keep the component that needs the store or a screen out of \
         `app/ui/index.ts`'s exports (import it from its file, as `FieldRow`), or pass the value in \
         as a prop:\n{}",
        chains.join("\n")
    );
}

#[test]
fn the_imports_read_are_those_the_build_keeps() {
    let text = "import { a } from \"./a\";\nimport type { B } from \"./b\";\n\
                import { type C, type D } from \"./c\";\nimport { type E, f } from \"./e\";\n\
                export * from \"./g\";\nexport type { H } from \"./h\";\nimport \"./side\";\n\
                import {\n  i,\n  j,\n} from \"../i\";\nimport { n } from \"nsh\";\n";
    assert_eq!(imports(text), ["./a", "./e", "./g", "./side", "../i"]);
}
