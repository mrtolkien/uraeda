//! `ura extension list`: every extension, built-in ones first, with where it is on and where it
//! came from, and its problems.

use std::process::ExitCode;

use serde::Serialize;
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
    if json {
        output::print_json(&Listing {
            extensions: listed.extensions.iter().map(row).collect(),
        });
    } else {
        print!("{}", render(&listed.extensions));
    }
    Ok(ExitCode::SUCCESS)
}

fn row(extension: &Extension) -> Row<'_> {
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
    }
}

/// One line per extension, its columns aligned: name, title, version, where it is on, and where
/// it came from; then each of its problems, indented.
fn render(extensions: &[Extension]) -> String {
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
