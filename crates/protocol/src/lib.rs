//! The protocol between Uraeda's server and its clients: the messages of the one WebSocket at
//! `/live`, the names of the records and actions, and the TypeScript types made from them.
//!
//! Its contract is `specs/2026-11-10-nsh-migration/contracts/protocol.md`.

mod change;
mod devices;
mod diff;
mod features;
mod git;
mod message;
mod registry;
mod typescript;
mod workspace;
mod writing;

pub use change::{ApplyError, Op, Path, apply, get};
pub use devices::{Device, Devices, DevicesRename, DevicesRevoke};
pub use diff::diff;
pub use features::*;
pub use git::{
    ConflictFile, ConflictFileArgs, GitAbort, GitArgs, GitClean, GitCommit, GitCommitArgs,
    GitCommitFile, GitCommitRow, GitCommitStaged, GitConflict, GitContinue, GitDiff, GitDiffArgs,
    GitDiscard, GitFetch, GitFile, GitGroup, GitHistoryArgs, GitHistoryPage, GitMerge, GitPage,
    GitPull, GitPush, GitRemoveWorktree, GitResolve, GitSaveConflict, GitStage, GitStopped,
    GitSummary, GitUnstage, GitWorktree,
};
pub use message::{ClientMessage, ErrorCode, PROTOCOL, Refusal, ServerMessage, SignIn, handshake};
pub use registry::{Action, Catalog, Record, Wire, catalog};
pub use typescript::typescript;
pub use workspace::*;
pub use writing::{
    AnswerSave, AnswersSubmit, Buffer, BufferArgs, BufferSave, CommitRetry, DefaultRoundAnswer,
    DefaultRoundDismiss, DefaultRoundNotes, DefaultRoundRetry, DefaultRoundSubmit, NotesSave,
    QueuedWrite, Recorded, ReviewApprove, ReviewComment, ReviewDecision, ReviewEdit, ReviewRemove,
    ReviewRequestChanges, ReviewStartOver, Saved, SettledComment, SettledEdit, SettledRemove,
    TextCommit, TextDiscovery, TextSave, UndoApplied, UndoApply, UndoChange, UndoCommitted,
    UndoDirection, UndoFile, WriteFailure, WriteName, WriteQueue, WriteQueueArgs, WriteState,
    WritesDismiss,
};
