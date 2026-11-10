//! The colour themes: the shipped ones and the user's, read through the core from the themes
//! folder beside the settings file, on each read of the record `Themes`.

use uraeda_core::themes as core;
use uraeda_protocol::{Theme, ThemeFile, ThemeProblem, Themes};

use crate::live::Registry;

/// Registers the record: the core's read never fails, and reports a broken file in `files`.
pub(super) fn register(registry: &Registry) {
    registry.record::<Themes>(|shared, ()| Ok(sent(core::read(shared.config_dir()))));
}

/// The core's themes, as the protocol sends them: the core's types have no JSON form.
fn sent(themes: core::Themes) -> Themes {
    Themes {
        folder: themes.folder,
        themes: themes.themes.into_iter().map(theme).collect(),
        files: themes.files.into_iter().map(file).collect(),
    }
}

fn theme(theme: core::Theme) -> Theme {
    Theme {
        id: theme.id,
        name: theme.name,
        mode: theme.mode,
        is_shipped: theme.is_shipped,
        roles: theme.roles,
        palette: theme.palette,
        sources: theme.sources,
    }
}

fn file(file: core::ThemeFile) -> ThemeFile {
    ThemeFile {
        file: file.file,
        id: file.id,
        name: file.name,
        mode: file.mode,
        extends: file.extends,
        is_listed: file.is_listed,
        problems: file.problems.into_iter().map(problem).collect(),
    }
}

fn problem(problem: core::ThemeProblem) -> ThemeProblem {
    ThemeProblem {
        line: problem.line,
        message: problem.message,
        is_warning: problem.is_warning,
        is_under_floor: problem.is_under_floor,
        role: problem.role,
    }
}
