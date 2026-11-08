//! `ura extension list`: every extension, built-in ones first, with where it is on and where it
//! came from, and its problems: its manifest's, and, when the server wrote what it saw, its state
//! and the problems of loading and compiling its code, as the running server last saw them.

use std::process::ExitCode;

use serde::Serialize;
use uraeda_core::extensions::status::{self, ServerExtension, ServerStatus};
use uraeda_core::extensions::{self, Extension, install};

use super::{Folders, short};
use crate::output;

/// The JSON of `ura extension list`.
#[derive(Serialize)]
struct Listing<'a> {
    extensions: Vec<Row<'a>>,
}

/// An extension of `ura extension list --json`: `None` prints as `null`.
#[derive(Serialize)]
struct Row<'a> {
    name: &'a str,
    title: &'a str,
    description: &'a str,
    version: &'a str,
    api: u32,
    scope: &'a str,
    folder: &'a str,
    is_built_in: bool,
    is_linked: bool,
    on_all: bool,
    on: &'a [String],
    source: Option<Source<'a>>,
    problems: Vec<Problem<'a>>,
    /// As the running server last saw it: `None` when it never wrote what it saw, or left it out.
    server: Option<Seen<'a>>,
}

/// An extension as the running server last saw it, at `seen_at`.
#[derive(Serialize)]
struct Seen<'a> {
    seen_at: &'a str,
    state: &'a str,
    waiting_for: Option<&'a str>,
    problems: Vec<SeenProblem<'a>>,
}

#[derive(Serialize)]
struct SeenProblem<'a> {
    file: &'a str,
    line: Option<u32>,
    message: &'a str,
}

#[derive(Serialize)]
struct Source<'a> {
    url: &'a str,
    commit: &'a str,
    #[serde(rename = "ref")]
    git_ref: &'a str,
}

#[derive(Serialize)]
struct Problem<'a> {
    file: &'a str,
    line: Option<u32>,
    message: &'a str,
    is_fatal: bool,
}

pub fn run(folders: &Folders, json: bool) -> Result<ExitCode, String> {
    let mut listed = extensions::read(&folders.config);
    // A symbolic link is linked whatever it holds: `ura` never updates it.
    for extension in &mut listed.extensions {
        if !extension.is_built_in && install::is_link(&folders.config, &extension.name) {
            extension.is_linked = true;
            extension.source = None;
        }
    }
    let seen = status::read_status(&folders.data);
    if json {
        output::print_json(&Listing {
            extensions: listed
                .extensions
                .iter()
                .map(|extension| row(extension, seen.as_ref()))
                .collect(),
        });
    } else {
        print!("{}", render(&listed.extensions, seen.as_ref()));
    }
    Ok(ExitCode::SUCCESS)
}

/// The server's view of `extension`, in `seen`, when it has one.
fn seen_of<'a>(
    extension: &Extension,
    seen: Option<&'a ServerStatus>,
) -> Option<&'a ServerExtension> {
    seen?
        .extensions
        .iter()
        .find(|one| one.name == extension.name)
}

fn row<'a>(extension: &'a Extension, seen: Option<&'a ServerStatus>) -> Row<'a> {
    Row {
        name: &extension.name,
        title: &extension.title,
        description: &extension.description,
        version: &extension.version,
        api: extension.api,
        scope: &extension.scope,
        folder: &extension.folder,
        is_built_in: extension.is_built_in,
        is_linked: extension.is_linked,
        on_all: extension.on_all,
        on: &extension.on,
        source: extension.source.as_ref().map(|source| Source {
            url: &source.url,
            commit: &source.commit,
            git_ref: &source.git_ref,
        }),
        problems: extension
            .problems
            .iter()
            .map(|problem| Problem {
                file: &problem.file,
                line: problem.line,
                message: &problem.message,
                is_fatal: problem.is_fatal,
            })
            .collect(),
        server: seen.zip(seen_of(extension, seen)).map(|(at, one)| Seen {
            seen_at: &at.at,
            state: &one.state,
            waiting_for: one.waiting_for.as_deref(),
            problems: one
                .problems
                .iter()
                .map(|problem| SeenProblem {
                    file: &problem.file,
                    line: problem.line,
                    message: &problem.message,
                })
                .collect(),
        }),
    }
}

/// One line per extension, its columns aligned: name, title, version, where it is on, and where
/// it came from; then each of its problems, indented, and what the running server last saw of it.
fn render(extensions: &[Extension], seen: Option<&ServerStatus>) -> String {
    let cells: Vec<[String; 5]> = extensions
        .iter()
        .map(|extension| {
            [
                extension.name.clone(),
                extension.title.clone(),
                extension.version.clone(),
                on(extension),
                source(extension),
            ]
        })
        .collect();
    let widths: Vec<usize> = (0..5)
        .map(|column| {
            cells
                .iter()
                .map(|row| row[column].chars().count())
                .max()
                .unwrap_or(0)
        })
        .collect();
    let mut text = String::new();
    for (extension, row) in extensions.iter().zip(&cells) {
        let padded: Vec<String> = row
            .iter()
            .zip(&widths)
            .map(|(cell, width)| format!("{cell:width$}"))
            .collect();
        text.push_str(padded.join("  ").trim_end());
        text.push('\n');
        for problem in &extension.problems {
            text.push_str(&format!("  {}\n", problem.text()));
        }
        if let Some((at, one)) = seen.zip(seen_of(extension, seen)) {
            text.push_str(&server_lines(extension, one, &at.at));
        }
    }
    text
}

/// What the running server last saw of `extension`, at `at`: its state, and its problems but the
/// manifest's, already shown.
fn server_lines(extension: &Extension, one: &ServerExtension, at: &str) -> String {
    let state = match &one.waiting_for {
        Some(session) => format!("{}, for {session}", one.state),
        None => one.state.clone(),
    };
    let mut text = format!("  {state}, as the running server last saw it at {at}\n");
    let shown: Vec<String> = extension.problems.iter().map(|each| each.text()).collect();
    for problem in &one.problems {
        let line = problem.text();
        if !shown.contains(&line) {
            text.push_str(&format!("  {line}\n"));
        }
    }
    text
}

/// Where it is on, in words.
fn on(extension: &Extension) -> String {
    if extension.on_all {
        "every repository".to_owned()
    } else if extension.on.is_empty() {
        "off".to_owned()
    } else {
        extension.on.join(", ")
    }
}

/// Where it came from, in words.
fn source(extension: &Extension) -> String {
    match &extension.source {
        _ if extension.is_built_in => "built in".to_owned(),
        Some(source) => format!("{} at {}", source.url, short(&source.commit)),
        None => format!("linked {}", extension.folder),
    }
}
