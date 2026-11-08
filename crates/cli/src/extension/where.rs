//! Where a new extension is on: from `--all`, `--here`, and `--repo`, or asked in a picker, every
//! repository or this one, the one the manifest's `scope` suggests first.

use std::path::Path;

use uraeda_core::extensions::On;
use uraeda_core::git::Git;
use uraeda_core::repositories;

use crate::install::Choice;
use crate::picker::{self, Answer, Item, Picker};

/// The flags that say where it is on.
pub struct Flags<'a> {
    pub all: bool,
    pub here: bool,
    pub repo: &'a [String],
}

/// Where it is on from the flags, `here` the current repository's name in Uraeda's list, `listed`
/// every name in it: a `--repo` not in it is refused before anything is cloned. Asked in a
/// terminal without a flag, an error without one.
pub fn resolve(
    flags: &Flags,
    interactive: bool,
    here: Option<&str>,
    listed: &[String],
) -> Result<Choice<On>, String> {
    if flags.all {
        return Ok(Choice::Given(On::All));
    }
    if flags.here || !flags.repo.is_empty() {
        let mut names = Vec::new();
        if flags.here {
            let here = here.ok_or(
                "this folder is in no repository of Uraeda's list: run ura add, or pass --all or \
                 --repo <name>",
            )?;
            names.push(here.to_owned());
        }
        for name in flags.repo {
            if !listed.contains(name) {
                return Err(format!("no repository named {name} in Uraeda's list"));
            }
            if !names.contains(name) {
                names.push(name.clone());
            }
        }
        return Ok(Choice::Given(On::Some(names)));
    }
    if interactive {
        Ok(Choice::Ask)
    } else {
        Err("no terminal to ask: pass --all or --here".to_owned())
    }
}

/// The names of the repositories of Uraeda's list in `data_dir`: none when it cannot be read.
pub fn listed(data_dir: &Path) -> Vec<String> {
    repositories::read(data_dir)
        .map(|repositories| {
            repositories
                .into_iter()
                .map(|repository| repository.name)
                .collect()
        })
        .unwrap_or_default()
}

/// The name, in Uraeda's list in `data_dir`, of the repository holding `cwd`.
pub fn here(data_dir: &Path, cwd: &Path) -> Option<String> {
    let root = Git::discover(cwd).ok()?.main_root();
    let root = root.canonicalize().unwrap_or(root);
    repositories::read(data_dir)
        .ok()?
        .into_iter()
        .find(|repository| repository.path.canonicalize().ok().as_ref() == Some(&root))
        .map(|repository| repository.name)
}

/// The picker's rows, each with where it turns the extension on: every repository, and this one
/// when there is one, first when the manifest's `scope` is `repository`.
pub fn rows(scope: &str, here: Option<&str>) -> Vec<(String, On)> {
    let all = ("Every repository".to_owned(), On::All);
    let Some(here) = here else {
        return vec![all];
    };
    let this = (
        format!("This repository ({here})"),
        On::Some(vec![here.to_owned()]),
    );
    if scope == "repository" {
        vec![this, all]
    } else {
        vec![all, this]
    }
}

/// Asks where the extension titled `title` is on; `None` on a cancel.
pub fn ask(title: &str, scope: &str, here: Option<&str>) -> Result<Option<On>, String> {
    let mut rows = rows(scope, here);
    let items = rows
        .iter()
        .map(|(label, _)| Item {
            label: label.clone(),
            detail: String::new(),
        })
        .collect();
    let picker = Picker::select(&format!("Turn {title} on for:"), items, 0);
    match picker::run(picker).map_err(|error| error.to_string())? {
        Some(Answer::One(index)) if index < rows.len() => Ok(Some(rows.swap_remove(index).1)),
        _ => Ok(None),
    }
}

/// Where it is on, in words: `every repository`, or the repositories' names.
pub fn words(on: &On) -> String {
    match on {
        On::All => "every repository".to_owned(),
        On::Some(names) if names.is_empty() => "no repository".to_owned(),
        On::Some(names) => names.join(", "),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_picker_suggests_what_the_scope_says_first() {
        let labels = |scope: &str, here: Option<&str>| -> Vec<String> {
            rows(scope, here)
                .into_iter()
                .map(|(label, _)| label)
                .collect()
        };
        assert_eq!(
            labels("global", Some("uraeda")),
            ["Every repository", "This repository (uraeda)"]
        );
        assert_eq!(
            labels("repository", Some("uraeda")),
            ["This repository (uraeda)", "Every repository"]
        );
        // Outside a listed repository, every repository alone, whatever the scope.
        assert_eq!(labels("repository", None), ["Every repository"]);
        assert_eq!(labels("global", None), ["Every repository"]);
        assert_eq!(
            rows("repository", Some("uraeda"))[0].1,
            On::Some(vec!["uraeda".to_owned()])
        );
    }

    /// A row of `flags_say_where_or_name_what_is_missing`: the flags, whether in a terminal, the
    /// current repository, and the answer.
    type Row<'a> = (Flags<'a>, bool, Option<&'a str>, Result<Choice<On>, String>);

    #[test]
    fn a_repository_not_in_the_list_is_refused() {
        let repo = ["docs".to_owned(), "nowhere".to_owned()];
        let flags = Flags {
            all: false,
            here: false,
            repo: &repo,
        };
        let listed = ["docs".to_owned(), "uraeda".to_owned()];

        assert_eq!(
            resolve(&flags, false, None, &listed),
            Err("no repository named nowhere in Uraeda's list".to_owned())
        );
    }

    #[test]
    fn flags_say_where_or_name_what_is_missing() {
        let repo = ["docs".to_owned(), "uraeda".to_owned()];
        let listed = repo.clone();
        let none: &[String] = &[];
        let flags = |all, here, repo| Flags { all, here, repo };
        let given = |on| Ok(Choice::Given(on));
        let names =
            |names: &[&str]| On::Some(names.iter().map(|name| (*name).to_owned()).collect());
        let no_terminal = Err("no terminal to ask: pass --all or --here".to_owned());
        // (flags, interactive, here) → the answer.
        let rows: Vec<Row> = vec![
            (flags(true, false, none), false, None, given(On::All)),
            (
                flags(false, true, none),
                false,
                Some("uraeda"),
                given(names(&["uraeda"])),
            ),
            (
                flags(false, true, &repo),
                false,
                Some("uraeda"),
                given(names(&["uraeda", "docs"])),
            ),
            (
                flags(false, false, &repo),
                false,
                None,
                given(names(&["docs", "uraeda"])),
            ),
            (
                flags(false, false, none),
                true,
                Some("uraeda"),
                Ok(Choice::Ask),
            ),
            (
                flags(false, false, none),
                false,
                Some("uraeda"),
                no_terminal,
            ),
        ];
        for (flags, interactive, here, expected) in rows {
            assert_eq!(
                resolve(&flags, interactive, here, &listed),
                expected,
                "{here:?}"
            );
        }
        assert!(resolve(&flags(false, true, none), true, None, &listed).is_err());
    }
}
