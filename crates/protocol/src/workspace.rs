//! The workspace: the repositories the server serves, each one's features in flight, what needs
//! the human across them, and the settings and the themes of the config folder.
//!
//! A record of one repository takes the repository's name in the list, as `repo`. A type named
//! `…View` is the core's view of that name, as the core writes it in JSON.

mod features;
mod needs_you;
mod repositories;
mod settings;
mod themes;

pub use features::{SetupItem, SlugProposal, SlugProposalArgs, Workspace, WorkspaceFeature};
pub use needs_you::{NeedsYouList, NeedsYouReason, NeedsYouRow};
pub use repositories::{
    FolderSuggestion, FolderSuggestions, FolderSuggestionsArgs, Repositories, RepositoriesAdd,
    RepositoriesAdded, RepositoriesOpen, RepositoriesRemove, RepositoryRow,
};
pub use settings::{
    ContinueKind, KeyboardSettings, RunSettings, ServerSettings, Setting, Settings,
    SettingsAddHost, SettingsEditHost, SettingsRemoveHost, SettingsSetAutomaticContinues,
    SettingsSetContinue, SettingsSetDefaultAgent, SettingsSetOpenBrowser, SettingsSetPort,
    SettingsSetRunOptions, SettingsSetSingleKeyShortcuts, SettingsSetVimCommands,
    SettingsSetVimMode, Source,
};
pub use themes::{Theme, ThemeFile, ThemeProblem, Themes};
