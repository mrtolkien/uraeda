//! The files of an extension's server entry, compiled: the entry and every file it imports, by
//! a relative path that stays inside the extension's folder. A path out of it, by `..` or by a
//! link in the folder, is a problem: the loader reads only the folder the config folder names,
//! never a path an extension's own files name.
//!
//! Each file is compiled by `uraeda-compile` into the body of a function of
//! `(__import, __exports)`, which the VM's prelude runs once.

use std::collections::{BTreeSet, VecDeque};
use std::fs;
use std::path::{Component, Path, PathBuf};

use serde_json::{Map, Value, json};

/// The modules an extension's server code imports by name, each from the VM's prelude.
pub(crate) const MODULES: [&str; 3] = ["uraeda/server", "uraeda:fs", "uraeda:process"];

/// The endings a relative import without one is tried with, in order.
const ENDINGS: [&str; 4] = [".ts", ".tsx", "/index.ts", "/index.tsx"];

/// The largest file the loader reads: a bigger one is refused before it is read.
const MOST_BYTES: u64 = 2 * 1024 * 1024;

/// A problem of an extension: the file it is in, from its folder, and its line when known.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Problem {
    pub file: String,
    pub line: Option<u32>,
    pub message: String,
}

impl Problem {
    pub(crate) fn of(file: &str, message: impl Into<String>) -> Problem {
        Problem {
            file: file.to_owned(),
            line: None,
            message: message.into(),
        }
    }
}

/// Where an import leads: a file of the graph, from the folder, or a module by its name.
enum Target {
    File(String),
    Module(String),
}

/// One compiled file, and where each of its imports leads.
struct File {
    code: String,
    resolved: Vec<(String, Target)>,
}

/// An entry's compiled files, the entry first, then each in the order first imported.
pub(crate) struct Graph {
    entry: String,
    files: Vec<(String, File)>,
}

impl Graph {
    /// The entry, from the folder.
    pub(crate) fn entry(&self) -> &str {
        &self.entry
    }

    /// The files, each from the folder.
    pub(crate) fn files(&self) -> impl Iterator<Item = &str> {
        self.files.iter().map(|(file, _)| file.as_str())
    }

    /// The graph as the VM's prelude loads it: `{ entry, files: { <file>: { code, resolved } } }`.
    pub(crate) fn to_json(&self) -> Value {
        let files = self.files.iter().map(|(name, file)| {
            let resolved = file.resolved.iter().map(|(specifier, target)| {
                let target = match target {
                    Target::File(file) => json!({ "file": file }),
                    Target::Module(module) => json!({ "module": module }),
                };
                (specifier.clone(), target)
            });
            let resolved: Map<String, Value> = resolved.collect();
            (
                name.clone(),
                json!({ "code": file.code, "resolved": resolved }),
            )
        });
        let files: Map<String, Value> = files.collect();
        json!({ "entry": self.entry, "files": files })
    }
}

/// Why files do not compile: their problems, and the paths, from the folder, a relative import
/// was looked for at and not found, whose making may fix them.
#[derive(Debug, Default)]
pub(crate) struct Failure {
    pub problems: Vec<Problem>,
    pub missing: Vec<String>,
}

/// Compiles the entry and every file it imports, each once. `folder` is the extension's folder,
/// absolute, its links resolved, and `entry` a file inside it.
///
/// # Errors
///
/// Every problem found in any of the files, and the paths their imports were looked for at.
pub(crate) fn compile(folder: &Path, entry: &Path) -> Result<Graph, Failure> {
    let entered = fs::canonicalize(entry).unwrap_or_else(|_| entry.to_owned());
    let Some(entry) = inside(folder, &entered) else {
        let message = format!("{} leaves the extension's folder", entry.display());
        let problems = vec![Problem::of("", message)];
        return Err(Failure {
            problems,
            ..Failure::default()
        });
    };
    let mut failure = Failure::default();
    let mut files = Vec::new();
    let mut seen = BTreeSet::from([entry.clone()]);
    let mut queue = VecDeque::from([entry.clone()]);
    while let Some(next) = queue.pop_front() {
        let Some(file) = compile_file(folder, &next, &mut failure) else {
            continue;
        };
        for (_, target) in &file.resolved {
            if let Target::File(found) = target
                && seen.insert(found.clone())
            {
                queue.push_back(found.clone());
            }
        }
        files.push((next, file));
    }
    if failure.problems.is_empty() {
        Ok(Graph { entry, files })
    } else {
        Err(failure)
    }
}

/// Reads and compiles one file of the folder, its imports resolved: none when it has a
/// problem, which joins the failure's.
fn compile_file(folder: &Path, file: &str, failure: &mut Failure) -> Option<File> {
    let path = folder.join(file);
    let read = || {
        let unreadable = |error: std::io::Error| format!("cannot be read: {}", error.kind());
        let size = fs::metadata(&path).map_err(unreadable)?.len();
        if size > MOST_BYTES {
            return Err(format!("{file} is over 2 MB"));
        }
        fs::read_to_string(&path).map_err(unreadable)
    };
    let source = match read() {
        Ok(source) => source,
        Err(message) => {
            failure.problems.push(Problem::of(file, message));
            return None;
        }
    };
    let compiled = match uraeda_compile::compile(&source, &path.to_string_lossy()) {
        Ok(compiled) => compiled,
        Err(error) => {
            failure.problems.push(Problem {
                file: file.to_owned(),
                line: Some(error.line),
                message: error.message,
            });
            return None;
        }
    };
    let mut resolved = Vec::new();
    let mut whole = true;
    for specifier in compiled.imports {
        match target(folder, &path, &specifier, &mut failure.missing) {
            Ok(target) => resolved.push((specifier, target)),
            Err(message) => {
                failure.problems.push(Problem::of(file, message));
                whole = false;
            }
        }
    }
    let code = compiled.code;
    whole.then_some(File { code, resolved })
}

/// Where the import `specifier` of the file `from` leads, or why it cannot be imported.
fn target(
    folder: &Path,
    from: &Path,
    specifier: &str,
    missing: &mut Vec<String>,
) -> Result<Target, String> {
    if specifier.starts_with("./") || specifier.starts_with("../") {
        return resolve_file(folder, from, specifier, missing);
    }
    if specifier.starts_with('/') || specifier == "." || specifier == ".." {
        return Err(format!(
            "\"{specifier}\" is not a relative path, like \"./lib/view\""
        ));
    }
    if MODULES.contains(&specifier) {
        return Ok(Target::Module(specifier.to_owned()));
    }
    if specifier.starts_with("node:") {
        return Err(format!(
            "\"{specifier}\" cannot be imported: an extension's server code has no Node. Use \
             uraeda:fs, uraeda:process, and fetch"
        ));
    }
    Err(format!(
        "\"{specifier}\" cannot be imported: only uraeda/server, uraeda:fs, uraeda:process, and \
         the extension's own files"
    ))
}

/// The file of the folder a relative import names: tried as written when it ends in `.ts` or
/// `.tsx`, else with each of [`ENDINGS`]. A file out of the folder, once its links are
/// resolved, is refused.
fn resolve_file(
    folder: &Path,
    from: &Path,
    specifier: &str,
    missing: &mut Vec<String>,
) -> Result<Target, String> {
    let leaves = || format!("\"{specifier}\" leaves the extension's folder");
    let base = normal(&from.parent().unwrap_or(folder).join(specifier));
    if inside(folder, &base).is_none() && base != folder {
        return Err(leaves());
    }
    let written = specifier.ends_with(".ts") || specifier.ends_with(".tsx");
    let candidates: Vec<PathBuf> = if written {
        vec![base]
    } else {
        let with = |ending: &&str| PathBuf::from(format!("{}{ending}", base.display()));
        ENDINGS.iter().map(with).collect()
    };
    if let Some(found) = candidates.iter().find(|candidate| candidate.is_file()) {
        let real = fs::canonicalize(found).map_err(|_| leaves())?;
        return inside(folder, &real).map(Target::File).ok_or_else(leaves);
    }
    missing.extend(candidates.iter().filter_map(|path| inside(folder, path)));
    let tried = if written {
        ""
    } else {
        ", with .ts, .tsx, /index.ts, or /index.tsx"
    };
    Err(format!(
        "\"{specifier}\" is not a file of the extension{tried}"
    ))
}

/// The path of `path` inside `folder`, with `/` between its parts: none for the folder itself,
/// and for a path outside it.
fn inside(folder: &Path, path: &Path) -> Option<String> {
    let rest = path.strip_prefix(folder).ok()?;
    let mut parts = Vec::new();
    for part in rest.components() {
        match part {
            Component::Normal(name) => parts.push(name.to_string_lossy().into_owned()),
            _ => return None,
        }
    }
    (!parts.is_empty()).then(|| parts.join("/"))
}

/// A path without its `.` and `..` parts, as written: no link is followed.
pub(crate) fn normal(path: &Path) -> PathBuf {
    let mut normal = PathBuf::new();
    for part in path.components() {
        match part {
            Component::CurDir => {}
            Component::ParentDir => {
                // Above the root there is nothing, and a relative path keeps its leading `..`.
                let last = normal.components().next_back();
                match last {
                    Some(Component::Normal(_)) => drop(normal.pop()),
                    Some(Component::RootDir) => {}
                    _ => normal.push(".."),
                }
            }
            other => normal.push(other),
        }
    }
    normal
}
