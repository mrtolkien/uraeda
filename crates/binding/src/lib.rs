//! The core's Node binding. Every type it returns is declared in the core, and napi-rs generates
//! its TypeScript declarations in `packages/binding/index.d.ts`.
//!
//! Each function but `version` and `storyLink` runs on libuv's thread pool and returns a promise. A
//! refusal rejects with a message prefixed by its code, `refused: `, `conflict: `, or `hook: `, the
//! last followed by the hook's output after a blank line.

use std::path::Path;

use napi::bindgen_prelude::{AsyncTask, Buffer, ToNapiValue, TypeName};
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi::{Env, Status, Task};
use napi_derive::napi;
use uraeda_core::actions::commit::PrioritiesAdded;
use uraeda_core::api::{self, ApiError, BranchDecision, Ledger};
use uraeda_core::changes::{self, BranchChanges};
use uraeda_core::files::preview::Preview;
use uraeda_core::files::priorities::Priorities;
use uraeda_core::files::stories::{self, StoryTarget};
use uraeda_core::view::{
    AddedView, AttachedView, CommitView, DraftView, FeatureView, FileView, NextView, ProposalHint,
    RepositoryView, StartedView, WorkspaceView,
};
use uraeda_core::watch::{self, Changes};

pub mod file_writes;
pub mod history;
pub mod inbox_writes;
pub mod settings;

/// A core operation, run off the main thread.
pub struct Job<T: Send + 'static> {
    work: Option<Box<dyn FnOnce() -> Result<T, ApiError> + Send>>,
}

impl<T: ToNapiValue + TypeName + Send + 'static> Task for Job<T> {
    type Output = T;
    type JsValue = T;

    fn compute(&mut self) -> napi::Result<T> {
        let work = self
            .work
            .take()
            .ok_or_else(|| napi::Error::from_reason("the task ran twice"))?;
        work().map_err(|error| {
            let mut reason = format!("{}: {}", error.code, error.message);
            if let Some(output) = error.output {
                reason.push_str("\n\n");
                reason.push_str(&output);
            }
            napi::Error::from_reason(reason)
        })
    }

    fn resolve(&mut self, _env: Env, output: T) -> napi::Result<T> {
        Ok(output)
    }
}

fn job<T: ToNapiValue + TypeName + Send + 'static>(
    work: impl FnOnce() -> Result<T, ApiError> + Send + 'static,
) -> AsyncTask<Job<T>> {
    AsyncTask::new(Job {
        work: Some(Box::new(work)),
    })
}

/// The binding's version, the Cargo workspace's. It reads nothing, so it returns at once.
#[napi]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_owned()
}

/// The story an agent's link names, read from the repository's top level: `null` for any other
/// link. It reads nothing, so it returns at once.
#[napi]
pub fn story_link(href: String) -> Option<StoryTarget> {
    stories::story_link(&href)
}

/// The preview of the checkout at `checkout`, from its own active preview decision: `null`
/// without one, or when its fields are wrong.
#[napi(ts_return_type = "Promise<Preview | null>")]
pub fn preview(checkout: String) -> AsyncTask<Job<Option<Preview>>> {
    job(move || api::preview(Path::new(&checkout)))
}

/// The commit the checkout at `checkout` has checked out, as a full hash: `null` before its first
/// commit. Its preview starts again once it moves.
#[napi(ts_return_type = "Promise<string | null>")]
pub fn checkout_commit(checkout: String) -> AsyncTask<Job<Option<String>>> {
    job(move || api::checkout_commit(Path::new(&checkout)))
}

/// Every feature, change, and priority of the repository at `repo`.
#[napi(ts_return_type = "Promise<WorkspaceView>")]
pub fn read_workspace(repo: String) -> AsyncTask<Job<WorkspaceView>> {
    job(move || api::read_workspace(Path::new(&repo)))
}

/// One feature, by its folder.
#[napi(ts_return_type = "Promise<FeatureView>")]
pub fn read_feature(repo: String, folder: String) -> AsyncTask<Job<FeatureView>> {
    job(move || api::read_feature(Path::new(&repo), &folder))
}

/// A workflow file of a feature, with its document, items, committed version, and review.
#[napi(ts_return_type = "Promise<FileView>")]
pub fn read_file(repo: String, folder: String, name: String) -> AsyncTask<Job<FileView>> {
    job(move || api::read_file(Path::new(&repo), &folder, &name))
}

/// A decision of `specs/decisions/`, by its name, as a feature's branch has it, with its change
/// against the merge base of the branch and the default branch.
#[napi(ts_return_type = "Promise<BranchDecision>")]
pub fn read_decision(repo: String, folder: String, name: String) -> AsyncTask<Job<BranchDecision>> {
    job(move || api::read_decision(Path::new(&repo), &folder, &name))
}

/// `PRIORITIES.md`, with its changes since the last commit.
#[napi(ts_return_type = "Promise<Priorities>")]
pub fn read_priorities(repo: String) -> AsyncTask<Job<Priorities>> {
    job(move || api::read_priorities(Path::new(&repo)))
}

/// The constitution and the decisions of the default branch, each decision with its last change.
#[napi(ts_return_type = "Promise<Ledger>")]
pub fn read_ledger(repo: String) -> AsyncTask<Job<Ledger>> {
    job(move || api::read_ledger(Path::new(&repo)))
}

/// A draft, by its path from the top level.
#[napi(ts_return_type = "Promise<DraftView>")]
pub fn read_draft(repo: String, path: String) -> AsyncTask<Job<DraftView>> {
    job(move || api::read_draft(Path::new(&repo), &path))
}

/// A draft or a proposal, for its editor, by its path from the top level.
#[napi(ts_return_type = "Promise<DraftView>")]
pub fn read_text(repo: String, path: String) -> AsyncTask<Job<DraftView>> {
    job(move || api::read_text(Path::new(&repo), &path))
}

/// A file of the repository as text, for links to code and mockups.
#[napi(ts_return_type = "Promise<string>")]
pub fn read_raw(repo: String, path: String) -> AsyncTask<Job<String>> {
    job(move || api::read_raw(Path::new(&repo), &path))
}

/// The files a feature's branch changed outside its folder, from the default branch's merge base,
/// or `null` when it has no branch, is merged, or the default branch is unknown.
#[napi(ts_return_type = "Promise<BranchChanges | null>")]
pub fn branch_changes(repo: String, folder: String) -> AsyncTask<Job<Option<BranchChanges>>> {
    job(move || changes::branch_changes(Path::new(&repo), &folder))
}

/// A feature's next step, with its branch and the main checkout's path, for an agent's run.
#[napi(ts_return_type = "Promise<NextView>")]
pub fn next_step(repo: String, folder: String) -> AsyncTask<Job<NextView>> {
    job(move || api::next_step(Path::new(&repo), &folder))
}

/// Asks `gh` for the repository's open pull requests, once, for every read that follows: whether
/// they changed since the last refresh.
#[napi(ts_return_type = "Promise<boolean>")]
pub fn refresh_pull_requests(repo: String) -> AsyncTask<Job<bool>> {
    job(move || api::refresh_pull_requests(Path::new(&repo)))
}

/// The directory an agent works on a feature in, its worktree created when none has its branch.
#[napi(ts_return_type = "Promise<string>")]
pub fn work_dir(repo: String, folder: String) -> AsyncTask<Job<String>> {
    job(move || api::work_dir(Path::new(&repo), &folder))
}

/// The main checkout's path, from any of the repository's working trees.
#[napi(ts_return_type = "Promise<string>")]
pub fn main_root(repo: String) -> AsyncTask<Job<String>> {
    job(move || api::main_root(Path::new(&repo)))
}

/// Drafts a priority line by its id, like `next-2`, over the priorities read at `previous`.
#[napi(ts_return_type = "Promise<DraftView>")]
pub fn create_draft(repo: String, id: String, previous: String) -> AsyncTask<Job<DraftView>> {
    job(move || api::create_draft(Path::new(&repo), &id, &previous))
}

/// Saves a draft or a proposal as typed, over the version read at `previous`; resolves with the
/// new hash.
#[napi(ts_return_type = "Promise<string>")]
pub fn save_text(
    repo: String,
    path: String,
    text: String,
    previous: String,
) -> AsyncTask<Job<String>> {
    job(move || api::save_text(Path::new(&repo), &path, &text, &previous))
}

/// Sets the discovery effort of a draft or a proposal, over the version read at `previous`.
#[napi(ts_return_type = "Promise<DraftView>")]
pub fn set_discovery(
    repo: String,
    path: String,
    level: String,
    previous: String,
) -> AsyncTask<Job<DraftView>> {
    job(move || api::set_discovery(Path::new(&repo), &path, &level, &previous))
}

/// Commits a draft, with the priorities when they changed, or a proposal.
#[napi(ts_return_type = "Promise<CommitView>")]
pub fn commit_text(repo: String, path: String) -> AsyncTask<Job<CommitView>> {
    job(move || api::commit_text(Path::new(&repo), &path))
}

/// Each section of the proposal template, with the guidance the editor shows while it is empty.
#[napi(ts_return_type = "Promise<Array<ProposalHint>>")]
pub fn proposal_hints() -> AsyncTask<Job<Vec<ProposalHint>>> {
    job(api::proposal_hints)
}

/// Starts a drafted feature, or a change with the kind `"change"`, in its own worktree.
#[napi(
    ts_args_type = "repo: string, draft: string, slug?: string | undefined | null, kind?: \"feature\" | \"change\" | undefined | null",
    ts_return_type = "Promise<StartedView>"
)]
pub fn start_feature(
    repo: String,
    draft: String,
    slug: Option<String>,
    kind: Option<String>,
) -> AsyncTask<Job<StartedView>> {
    job(move || {
        let kind = api::start_kind(kind.as_deref())?;
        api::start_feature(Path::new(&repo), &draft, slug.as_deref(), kind)
    })
}

/// Starts a change typed as a text, with its images, in its own worktree: the first written line
/// is its title.
#[napi(ts_return_type = "Promise<StartedView>")]
pub fn start_change(
    repo: String,
    text: String,
    images: Vec<Buffer>,
    slug: Option<String>,
) -> AsyncTask<Job<StartedView>> {
    let images: Vec<Vec<u8>> = images.iter().map(|image| image.to_vec()).collect();
    job(move || api::start_change(Path::new(&repo), &text, &images, slug.as_deref()))
}

/// The slug proposed for a change typed as this text, from the title its start reads in it: empty
/// when it has none.
#[napi]
pub fn propose_slug(text: String) -> String {
    api::propose_slug(&text)
}

/// The folder of the feature or the change that a path from the top level is in: `<folder>` for
/// `specs/<folder>/...` and `specs/changes/<folder>/...`, and none outside `specs/`. It reads
/// nothing.
#[napi]
pub fn path_folder(path: String) -> Option<String> {
    uraeda_core::workspace::path_folder(&path).map(|(_, folder, _)| folder.to_string())
}

/// Adds a line at the end of a section of the priorities.
#[napi(ts_return_type = "Promise<Priorities>")]
pub fn add_priority(
    repo: String,
    section: String,
    text: String,
    previous: String,
) -> AsyncTask<Job<Priorities>> {
    job(move || api::add_priority(Path::new(&repo), &section, &text, &previous))
}

/// Adds a line at the end of a section of the priorities, then commits `PRIORITIES.md` alone when
/// it had no other change: "Add and commit".
#[napi(ts_return_type = "Promise<PrioritiesAdded>")]
pub fn add_priority_and_commit(
    repo: String,
    section: String,
    text: String,
    previous: String,
) -> AsyncTask<Job<PrioritiesAdded>> {
    job(move || {
        let (priorities, added) =
            api::add_priority_and_commit(Path::new(&repo), &section, &text, &previous)?;
        Ok(PrioritiesAdded { priorities, added })
    })
}

/// Takes back a committed add: the entry, `lines` as written, leaves the priorities, and the
/// removal is committed alone.
#[napi(ts_return_type = "Promise<Priorities>")]
pub fn undo_committed_priority(
    repo: String,
    lines: Vec<String>,
    previous: String,
) -> AsyncTask<Job<Priorities>> {
    job(move || api::undo_committed_priority(Path::new(&repo), &lines, &previous))
}

/// Inserts a priority line with its nested lines, as written, before the line at `index` of a
/// section, or at its end: Undo of a removal.
#[napi(ts_return_type = "Promise<Priorities>")]
pub fn insert_priority(
    repo: String,
    section: String,
    index: u32,
    lines: Vec<String>,
    previous: String,
) -> AsyncTask<Job<Priorities>> {
    job(move || api::insert_priority(Path::new(&repo), &section, index, &lines, &previous))
}

/// Moves a priority line before the line at `index` of a section, or to its end.
#[napi(ts_return_type = "Promise<Priorities>")]
pub fn move_priority(
    repo: String,
    id: String,
    section: String,
    index: u32,
    previous: String,
) -> AsyncTask<Job<Priorities>> {
    job(move || api::move_priority(Path::new(&repo), &id, &section, index, &previous))
}

/// Replaces a priority line's text.
#[napi(ts_return_type = "Promise<Priorities>")]
pub fn edit_priority(
    repo: String,
    id: String,
    text: String,
    previous: String,
) -> AsyncTask<Job<Priorities>> {
    job(move || api::edit_priority(Path::new(&repo), &id, &text, &previous))
}

/// Removes a priority line and its nested lines.
#[napi(ts_return_type = "Promise<Priorities>")]
pub fn remove_priority(repo: String, id: String, previous: String) -> AsyncTask<Job<Priorities>> {
    job(move || api::remove_priority(Path::new(&repo), &id, &previous))
}

/// Commits the priorities alone.
#[napi(ts_return_type = "Promise<Priorities>")]
pub fn commit_priorities(repo: String) -> AsyncTask<Job<Priorities>> {
    job(move || api::commit_priorities(Path::new(&repo)))
}

/// Restores the committed priorities.
#[napi(ts_return_type = "Promise<Priorities>")]
pub fn discard_priorities(repo: String) -> AsyncTask<Job<Priorities>> {
    job(move || api::discard_priorities(Path::new(&repo)))
}

/// Uraeda's data folder: `custom` when set and not empty, else `URAEDA_DATA_DIR` from this
/// process's environment, else the operating system's default.
#[napi]
pub fn data_dir(custom: Option<String>) -> String {
    api::data_dir(custom.as_deref())
}

/// The list of repositories in the data folder, the most recently opened first.
#[napi(ts_return_type = "Promise<Array<Repository>>")]
pub fn read_repositories(data_dir: String) -> AsyncTask<Job<Vec<RepositoryView>>> {
    job(move || api::read_repositories(Path::new(&data_dir)))
}

/// Adds the git repository holding `folder`, an absolute path, to the list; one listed already
/// is opened, and returned with `existed`.
#[napi(ts_return_type = "Promise<Added>")]
pub fn add_repository(data_dir: String, folder: String) -> AsyncTask<Job<AddedView>> {
    job(move || api::add_repository(Path::new(&data_dir), Path::new(&folder)))
}

/// Sets the name and the colour a feature or a change of a repository shows in the sidebar, by its
/// folder: an empty name removes it.
#[napi(ts_return_type = "Promise<Repository>")]
pub fn set_item_settings(
    data_dir: String,
    name: String,
    folder: String,
    label: Option<String>,
    color: Option<uraeda_core::repositories::Color>,
) -> AsyncTask<Job<RepositoryView>> {
    job(move || api::set_item_settings(Path::new(&data_dir), &name, &folder, label, color))
}

/// Takes a repository off the list, leaving its folder and sessions as they are.
#[napi(ts_return_type = "Promise<void>")]
pub fn remove_repository(data_dir: String, name: String) -> AsyncTask<Job<()>> {
    job(move || api::remove_repository(Path::new(&data_dir), &name))
}

/// Records that a repository was opened now, and returns it.
#[napi(ts_return_type = "Promise<Repository>")]
pub fn open_repository(data_dir: String, name: String) -> AsyncTask<Job<RepositoryView>> {
    job(move || api::open_repository(Path::new(&data_dir), &name))
}

/// An image checked and re-encoded by the core, for a chat message. Declared here, not in the core,
/// since its bytes are a Node `Buffer`.
#[napi(object)]
pub struct EncodedImage {
    pub bytes: Buffer,
    #[napi(ts_type = "'webp' | 'gif'")]
    pub extension: String,
    pub width: u32,
    pub height: u32,
}

/// The bytes of an image file, with the MIME type detected from its first bytes.
#[napi(object)]
pub struct ImageFile {
    pub bytes: Buffer,
    #[napi(js_name = "type")]
    pub kind: String,
}

/// Re-encodes an image, saves it in the `images/` folder next to the markdown file at `path`, and
/// returns its link. `name` is the file's name, absent for a pasted image. A single-file draft
/// becomes a folder first.
#[napi(ts_return_type = "Promise<AttachedView>")]
pub fn attach_image(
    repo: String,
    path: String,
    bytes: Buffer,
    name: Option<String>,
) -> AsyncTask<Job<AttachedView>> {
    let bytes = Vec::<u8>::from(bytes);
    job(move || api::attach_image(Path::new(&repo), &path, &bytes, name.as_deref()))
}

/// Checks and re-encodes an image for a chat message, without writing it. `name` is its file name,
/// for refusals.
#[napi(ts_return_type = "Promise<EncodedImage>")]
pub fn encode_image(bytes: Buffer, name: String) -> AsyncTask<Job<EncodedImage>> {
    let bytes = Vec::<u8>::from(bytes);
    job(move || {
        let encoded = api::encode_image(&bytes, &name)?;
        Ok(EncodedImage {
            bytes: encoded.bytes.into(),
            extension: encoded.extension.to_owned(),
            width: encoded.width,
            height: encoded.height,
        })
    })
}

/// A PNG, JPEG, GIF, or WebP file under `specs/`, by its path from the top level; anything else is
/// no such file.
#[napi(ts_return_type = "Promise<ImageFile>")]
pub fn read_image(repo: String, path: String) -> AsyncTask<Job<ImageFile>> {
    job(move || {
        let (bytes, kind) = api::read_image(Path::new(&repo), &path)?;
        Ok(ImageFile {
            bytes: bytes.into(),
            kind: kind.to_owned(),
        })
    })
}

/// A running watch of a repository.
#[napi]
pub struct WatchHandle {
    watcher: Option<watch::Watcher>,
}

#[napi]
impl WatchHandle {
    /// Stops the watch.
    #[napi]
    pub fn close(&mut self) {
        self.watcher = None;
    }
}

/// Watches the repository at `repo`, and calls `onChange` with what changed after each burst of
/// file events. The watch does not keep Node running.
#[napi(ts_args_type = "repo: string, onChange: (changes: Changes) => void")]
pub fn watch(
    repo: String,
    on_change: ThreadsafeFunction<Changes, (), Changes, Status, false, true>,
) -> napi::Result<WatchHandle> {
    let watcher = watch::watch(Path::new(&repo), move |changes| {
        on_change.call(changes, ThreadsafeFunctionCallMode::NonBlocking);
    })
    .map_err(|error| napi::Error::from_reason(error.to_string()))?;
    Ok(WatchHandle {
        watcher: Some(watcher),
    })
}
