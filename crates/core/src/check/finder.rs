//! Where a broken link's file went, for the check's message and its fix: git's history, read once
//! per check, at the first broken link only.

use std::cell::{OnceCell, RefCell};
use std::fs;
use std::path::Path;
use std::sync::Arc;

use serde::Serialize;

use super::{CheckError, check_in, relative};
use crate::actions::relink::relink;
use crate::git::{Git, ObjectId};
use crate::moves::{History, Move, Went};

/// A file `fix` rewrote, from the top level, and the number of links it changed in it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Fixed {
    pub file: String,
    pub links: usize,
}

/// Checks `target`, a folder or a file under `root`, then rewrites the links of the markdown files
/// under it to the files git's history says went somewhere: each file changed, in path order.
/// Writes without committing; a file with uncommitted edits is rewritten in place.
pub fn fix(root: &Path, target: &Path) -> Result<Vec<Fixed>, CheckError> {
    let root = fs::canonicalize(root).unwrap_or_else(|_| root.to_path_buf());
    let finder = Finder::new(&root, None);
    check_in(&root, target, false, &finder)?;
    let moves = finder.moves();
    if moves.is_empty() {
        return Ok(Vec::new());
    }
    let target = fs::canonicalize(target).map_err(|_| CheckError::Missing(target.into()))?;
    let relinked = relink(&root, &relative(&root, &target), &moves, &[])?;
    Ok(relinked
        .into_iter()
        .map(|file| Fixed {
            file: file.path,
            links: file.links,
        })
        .collect())
}

/// The history a check reads where missing files went from, with the moves it answered.
pub(crate) struct Finder<'a> {
    /// The top level of the repository, when the check has no tip.
    root: &'a Path,
    /// The commit links resolve against: its history is read in place of `HEAD`'s.
    pub tip: Option<(&'a Git, ObjectId)>,
    /// The history, read at the first question; `None` outside a repository or on a failed read.
    history: OnceCell<Option<Arc<History>>>,
    /// Each move answered, once by path, in the order asked.
    answered: RefCell<Vec<Move>>,
}

impl<'a> Finder<'a> {
    /// A finder for the repository at `root`, reading the history of `tip`, else of `HEAD`.
    pub fn new(root: &'a Path, tip: Option<(&'a Git, ObjectId)>) -> Finder<'a> {
        Finder {
            root,
            tip,
            history: OnceCell::new(),
            answered: RefCell::new(Vec::new()),
        }
    }

    /// Where the file or folder `path`, from the top level and missing, went, kept for `moves`.
    pub fn went(&self, path: &str) -> Option<Went> {
        let path = path.trim_end_matches('/');
        let went = self.history().as_ref()?.went(path)?;
        let mut answered = self.answered.borrow_mut();
        if !answered.iter().any(|each| each.from == path) {
            answered.push(Move {
                from: path.to_string(),
                went: went.clone(),
            });
        }
        Some(went)
    }

    /// The moves answered so far, sorted by path.
    pub fn moves(self) -> Vec<Move> {
        let mut moves = self.answered.into_inner();
        moves.sort_by(|a, b| a.from.cmp(&b.from));
        moves
    }

    fn history(&self) -> &Option<Arc<History>> {
        self.history.get_or_init(|| match self.tip {
            Some((git, tip)) => History::read(git, tip).ok(),
            None => {
                let git = Git::open(self.root).ok()?;
                let head = git.head()?;
                History::read(&git, head).ok()
            }
        })
    }
}
