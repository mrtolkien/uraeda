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

pub use features::{
    CatchUpView, FeatureStatus, FeatureView, FileSummary, ProblemView, ProposalView,
    PullRequestState, PullRequestView, SessionStatus, SetupItem, SlugProposal, SlugProposalArgs,
    StatusReason, StepView, TaskProgress, Wait, Workspace, WorkspaceArgs, WorkspaceFeature,
};
pub use needs_you::{NeedsYouList, NeedsYouReason, NeedsYouRow};
pub use repositories::{
    FolderSuggestion, FolderSuggestions, FolderSuggestionsArgs, Repositories, RepositoriesAdd,
    RepositoriesAdded, RepositoriesOpen, RepositoriesRemove, RepositoryRow,
};
pub use settings::{
    ContinueKind, KeyboardSettings, ReviewerOptions, RunOptions, RunPick, RunSettings,
    ServerSettings, Setting, Settings, SettingsAddHost, SettingsEditHost, SettingsRemoveHost,
    SettingsSetAutomaticContinues, SettingsSetContinue, SettingsSetOpenBrowser, SettingsSetPort,
    SettingsSetRunOptions, SettingsSetSingleKeyShortcuts, SettingsSetVimCommands,
    SettingsSetVimMode, Source, StepOptions,
};
pub use themes::{Theme, ThemeFile, ThemeProblem, Themes};
