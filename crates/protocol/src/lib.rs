//! The protocol between Uraeda's server and its clients: the messages of the one WebSocket at
//! `/live`, the names of the records and actions, and the TypeScript types made from them.
//!
//! Its contract is `specs/2026-11-10-nsh-migration/contracts/protocol.md`.

mod accounts;
mod change;
mod devices;
mod diff;
mod extensions;
mod features;
mod git;
mod jobs;
mod message;
mod page;
mod previews;
mod registry;
mod sessions;
mod shared;
mod typescript;
mod workspace;
mod writing;

pub use accounts::{AccountRecord, AccountState, AccountWindow};
pub use change::{ApplyError, Op, Path, apply, get};
pub use devices::{Device, Devices, DevicesRename, DevicesRevoke};
pub use diff::diff;
pub use extensions::*;
pub use features::*;
pub use git::{
    ConflictFile, ConflictFileArgs, GitAbort, GitClean, GitCommit, GitCommitArgs, GitCommitFile,
    GitCommitRow, GitCommitStaged, GitConflict, GitContinue, GitDiff, GitDiffArgs, GitDiscard,
    GitFetch, GitFile, GitGroup, GitHistoryArgs, GitHistoryPage, GitMerge, GitPage, GitPull,
    GitPush, GitRemoveWorktree, GitResolve, GitSaveConflict, GitStage, GitStopped, GitSummary,
    GitUnstage, GitWorktree,
};
pub use jobs::*;
pub use message::{ClientMessage, ErrorCode, PROTOCOL, Refusal, ServerMessage, SignIn, handshake};
pub use page::{PAGE_HOST, page_entry};
pub use previews::{
    Mockup, MockupArgs, Preview, PreviewArgs, PreviewRestart, PreviewState, Story, StoryArgs,
    StoryHref, StoryHrefArgs, StoryState,
};
pub use registry::{Action, Catalog, Record, Wire, catalog};
pub use sessions::*;
pub use shared::*;
pub use typescript::typescript;
pub use workspace::*;
pub use writing::{
    AnswerSave, AnswerSaved, AnswersSubmit, Buffer, BufferArgs, BufferSave, CommitRetry,
    DefaultRoundAnswer, DefaultRoundDismiss, DefaultRoundNotes, DefaultRoundRetry,
    DefaultRoundSubmit, NotesSave, QueuedWrite, Recorded, ReviewApprove, ReviewComment,
    ReviewDecision, ReviewEdit, ReviewRemove, ReviewRequestChanges, ReviewStartOver, Saved,
    SettledAddComment, SettledEdit, SettledRemove, StartStep, StepState, TextCommit, TextDiscovery,
    TextSave, UndoApplied, UndoApply, UndoCommitted, UndoDirection, WriteFailure, WriteQueue,
    WriteState, WritesDismiss,
};
