//! Theme files resolved into themes: `extends` followed, loops found, and each role resolved
//! against the palette merged over the extended themes' (ruling R2 of the color themes plan).

use std::collections::HashMap;

use super::parse::{Expr, at_line};
use super::{DEFAULT_DARK, DEFAULT_LIGHT, Source, Theme, ThemeFile, contrast};

/// A theme resolved: its mode, its merged palette, and each role's value, inherited ones included.
struct Resolved {
    mode: &'static str,
    palette: HashMap<String, String>,
    exprs: HashMap<String, Expr>,
}

/// Where a file is in the walk.
enum State {
    New,
    Visiting,
    /// Resolved, or `None` when it leaves the lists.
    Done(Option<Resolved>),
}

struct Walk {
    sources: Vec<Source>,
    states: Vec<State>,
    /// The files being resolved, each extending the next.
    stack: Vec<usize>,
    /// The loop each file in one is part of, as its row says it.
    loops: HashMap<usize, String>,
}

/// The listed themes of `sources`, and every file's row, with whether it is a shipped one.
pub fn resolve(sources: Vec<Source>) -> (Vec<Theme>, Vec<(bool, ThemeFile)>) {
    let states = sources.iter().map(|_| State::New).collect();
    let mut walk = Walk {
        sources,
        states,
        stack: Vec::new(),
        loops: HashMap::new(),
    };
    walk.refuse_shipped_names();
    for index in 0..walk.sources.len() {
        walk.visit(index);
    }
    walk.finish()
}

impl Walk {
    /// Leaves out of the lists a user's file named as a shipped theme, in any case.
    fn refuse_shipped_names(&mut self) {
        let shipped: Vec<String> = self
            .sources
            .iter()
            .filter(|source| source.is_shipped)
            .map(|source| source.id.clone())
            .collect();
        for source in self.sources.iter_mut().filter(|source| !source.is_shipped) {
            if let Some(id) = shipped
                .iter()
                .find(|id| id.eq_ignore_ascii_case(&source.id))
            {
                let message = format!("A shipped theme is called {id}: rename the file.");
                source.parsed.error(None, message, true);
            }
        }
    }

    /// The file a theme's id names, in any case, an exact match first: a shipped one first, then
    /// the user's.
    fn lookup(&self, id: &str) -> Option<usize> {
        let found = |shipped: bool, exact: bool| {
            self.sources.iter().position(|source| {
                let same = if exact {
                    source.id == id
                } else {
                    source.id.eq_ignore_ascii_case(id)
                };
                source.is_shipped == shipped && same
            })
        };
        found(true, true)
            .or_else(|| found(false, true))
            .or_else(|| found(true, false))
            .or_else(|| found(false, false))
    }

    /// Resolves the file at `index`, after the file it extends.
    fn visit(&mut self, index: usize) {
        if !matches!(self.states[index], State::New) {
            return;
        }
        if self.sources[index].parsed.unlisted {
            self.states[index] = State::Done(None);
            return;
        }
        self.states[index] = State::Visiting;
        self.stack.push(index);
        let parent = self.parent(index);
        self.stack.pop();
        let resolved = if let Some(cycle) = self.loops.get(&index) {
            let parsed = &mut self.sources[index].parsed;
            let line = parsed.extends_line;
            parsed.error(line, format!("extends forms a loop: {cycle}."), true);
            None
        } else {
            self.inherit(index, parent)
        };
        self.states[index] = State::Done(resolved);
    }

    /// The listed file the file at `index` extends, resolved: the one it names, else its mode's
    /// default; `None` for a mode's default itself, shipped, or a file that cannot extend any.
    fn parent(&mut self, index: usize) -> Option<usize> {
        let source = &self.sources[index];
        let Some(extends) = source.parsed.extends.clone() else {
            let mode = source.parsed.mode?;
            let root = source.is_shipped && source.id == default_of(mode);
            return if root { None } else { self.default(mode) };
        };
        let Some(named) = self.lookup(&extends) else {
            let parsed = &mut self.sources[index].parsed;
            let message = format!("extends \"{extends}\", which no theme is called.");
            parsed.error(parsed.extends_line, message, false);
            let mode = parsed.mode;
            return mode.and_then(|mode| self.default(mode));
        };
        if matches!(self.states[named], State::Visiting) {
            self.found_loop(named);
            return None;
        }
        self.visit(named);
        if matches!(self.states[named], State::Done(Some(_))) {
            return Some(named);
        }
        if self.loops.contains_key(&index) {
            return None;
        }
        let mode = self.sources[index].parsed.mode;
        let mode = mode.or(self.sources[named].parsed.mode);
        let parsed = &mut self.sources[index].parsed;
        let message = format!("extends \"{extends}\", which has problems of its own: see its row.");
        parsed.error(parsed.extends_line, message, false);
        self.default(mode?)
    }

    /// The default theme of `mode`, resolved, when listed.
    fn default(&mut self, mode: &str) -> Option<usize> {
        let index = self.lookup(default_of(mode))?;
        self.visit(index);
        matches!(self.states[index], State::Done(Some(_))).then_some(index)
    }

    /// Records the loop closed by extending `start`, being resolved: each file from it to the top
    /// of the stack extends the next, and the last extends `start`.
    fn found_loop(&mut self, start: usize) {
        let Some(from) = self.stack.iter().position(|&index| index == start) else {
            return;
        };
        let members = self.stack[from..].to_vec();
        for at in 0..members.len() {
            let ids: Vec<&str> = (0..=members.len())
                .map(|step| {
                    self.sources[members[(at + step) % members.len()]]
                        .id
                        .as_str()
                })
                .collect();
            self.loops.insert(members[at], ids.join(" \u{2192} "));
        }
    }

    /// The file at `index` resolved over `parent`, or `None` when its mode is missing or differs.
    fn inherit(&mut self, index: usize, parent: Option<usize>) -> Option<Resolved> {
        let base = parent.and_then(|parent| match &self.states[parent] {
            State::Done(Some(resolved)) => Some(resolved),
            _ => None,
        });
        let parsed = &mut self.sources[index].parsed;
        let Some(mode) = parsed.mode.or(base.map(|base| base.mode)) else {
            parsed.error(
                None,
                "Give it mode = \"dark\" or \"light\".".to_owned(),
                true,
            );
            return None;
        };
        if let Some(base) = base.filter(|base| base.mode != mode) {
            let extends = parsed.extends.clone().unwrap_or_default();
            let message = format!(
                "extends \"{extends}\", a {} theme, while this one is {mode}.",
                base.mode
            );
            parsed.error(parsed.extends_line, message, true);
            return None;
        }
        let mut palette = base.map(|base| base.palette.clone()).unwrap_or_default();
        palette.extend(parsed.palette.iter().cloned());
        let mut exprs = base.map(|base| base.exprs.clone()).unwrap_or_default();
        for (role, expr, at) in parsed.roles.clone() {
            match &expr {
                Expr::Name(name) if !palette.contains_key(name) => {
                    let message = format!(
                        "{}{role} names \"{name}\", which is not in the palette.",
                        at_line(at)
                    );
                    parsed.role_error(at, message, &role);
                }
                _ => {
                    exprs.insert(role, expr);
                }
            }
        }
        Some(Resolved {
            mode,
            palette,
            exprs,
        })
    }

    /// The listed themes, and every file's row, contrast warnings added to the user's.
    fn finish(self) -> (Vec<Theme>, Vec<(bool, ThemeFile)>) {
        let mut themes = Vec::new();
        let mut rows = Vec::new();
        for (source, state) in self.sources.into_iter().zip(self.states) {
            let resolved = match state {
                State::Done(resolved) => resolved,
                State::New | State::Visiting => None,
            };
            let Source {
                is_shipped,
                file,
                id,
                mut parsed,
            } = source;
            let name = parsed.name.clone().unwrap_or_else(|| id.clone());
            let theme =
                resolved.map(|resolved| theme(id.clone(), name.clone(), is_shipped, resolved));
            if let Some(theme) = theme.as_ref().filter(|_| !is_shipped) {
                for (role, warning) in contrast::warnings(&theme.roles) {
                    let at = parsed
                        .roles
                        .iter()
                        .find(|set| set.0 == role)
                        .and_then(|set| set.2);
                    parsed.under_floor(at, warning, &role);
                }
            }
            // Whole-file problems first, then by line.
            parsed.problems.sort_by_key(|problem| problem.line);
            let row = ThemeFile {
                file,
                id,
                name,
                mode: theme
                    .as_ref()
                    .map(|theme| theme.mode.clone())
                    .or_else(|| parsed.mode.map(str::to_owned)),
                extends: parsed.extends,
                is_listed: theme.is_some(),
                problems: parsed.problems,
            };
            themes.extend(theme);
            rows.push((is_shipped, row));
        }
        (themes, rows)
    }
}

/// A resolved file as a theme: each role's colour, and the palette name it took.
fn theme(id: String, name: String, is_shipped: bool, resolved: Resolved) -> Theme {
    let mut roles = HashMap::new();
    let mut sources = HashMap::new();
    for (role, expr) in resolved.exprs {
        match expr {
            Expr::Colour(colour) => {
                roles.insert(role, colour);
            }
            Expr::Name(name) => {
                if let Some(colour) = resolved.palette.get(&name) {
                    roles.insert(role.clone(), colour.clone());
                    sources.insert(role, name);
                }
            }
        }
    }
    Theme {
        id,
        name,
        mode: resolved.mode.to_owned(),
        is_shipped,
        roles,
        palette: resolved.palette,
        sources,
    }
}

/// The default theme of `mode`.
fn default_of(mode: &str) -> &'static str {
    if mode == "light" {
        DEFAULT_LIGHT
    } else {
        DEFAULT_DARK
    }
}
