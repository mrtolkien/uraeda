//! Previews: a checkout's preview command as the server runs it, a story of it, and an agent's
//! link to a story.
//!
//! A preview's addresses are paths on the server, which carry the frame secret: a client shows
//! them from the server's own address, and never builds one itself.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::registry::{Action, Record};

/// Which checkout's preview: a repository of the list, and a feature's or a change's folder, or
/// `main` for the main checkout.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct PreviewArgs {
    /// The repository's name in the list, the `<name>` of `/r/<name>/`.
    pub repo: String,
    /// A feature's or a change's folder, or `main`.
    pub folder: String,
}

/// Where a checkout's preview is.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
pub enum PreviewState {
    /// The checkout has no preview: no worktree, or no active preview decision.
    None,
    /// Its command runs, and does not answer yet.
    Starting,
    /// It answers, under `base`.
    Ready,
    /// It did not start, or it ended: `error` says why.
    Failed,
}

/// A checkout's preview. Subscribing to it starts its command, which stops 30 minutes after its
/// last read.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Preview {
    pub state: PreviewState,
    /// Once ready, the path it is served under, `/r/<name>/preview/<secret>/<folder>/`, with the
    /// frame secret: on the server's address, it is the preview's own first page.
    pub base: Option<String>,
    /// When failed, why, as one sentence.
    pub error: Option<String>,
    /// The command its preview decision runs, as written there, `{port}` included: none
    /// without a preview.
    pub command: Option<String>,
    /// The folder it runs in, from the checkout's top level: none without a preview.
    pub folder: Option<String>,
}

impl Record for Preview {
    const NAME: &'static str = "Preview";
    type Args = PreviewArgs;
    type Value = Self;
}

/// Which story: a repository of the list, and the story's link in a checkout.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct StoryArgs {
    /// The repository's name in the list.
    pub repo: String,
    /// `<folder>:<path>#<export>`: a feature's folder or `main`, the stories file from the
    /// repository's top level, and the export's name.
    pub id: String,
}

/// Where a story is.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
pub enum StoryState {
    /// The link names no story, or its checkout has no preview.
    None,
    /// Its preview starts, or the story's code compiles.
    Starting,
    /// It shows, at `frame`.
    Ready,
    /// Its preview is ready, and holds no such story.
    Missing,
    /// Its preview failed: `error` says why.
    Failed,
}

/// A story of a checkout's preview. Subscribing to it starts the preview.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Story {
    pub state: StoryState,
    /// Once ready, the path of the story alone, to show in a web view:
    /// `/r/<name>/preview/<secret>/<folder>/iframe.html?id=<id>&viewMode=story`.
    pub frame: Option<String>,
    /// Once ready, the app's route to the story in the whole preview:
    /// `/f/<folder>/storybook?path=/story/<id>`, or `/storybook?path=..` for `main`.
    pub storybook: Option<String>,
    /// When failed, why, as one sentence.
    pub error: Option<String>,
}

impl Record for Story {
    const NAME: &'static str = "Story";
    type Args = StoryArgs;
    type Value = Self;
}

/// Which link: its address as an agent wrote it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct StoryHrefArgs {
    pub href: String,
}

/// The story an agent's link names, by the core's rule: both fields are null for any other link.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct StoryHref {
    /// The stories file, from the repository's top level.
    pub path: Option<String>,
    /// The export's name.
    pub export: Option<String>,
}

impl Record for StoryHref {
    const NAME: &'static str = "StoryHref";
    type Args = StoryHrefArgs;
    type Value = Self;
}

/// Which mockup: a repository of the list, and the mockup's file.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct MockupArgs {
    /// The repository's name in the list.
    pub repo: String,
    /// The file, from the repository's top level, in a `mockups/` folder:
    /// `specs/<folder>/mockups/<name>.html`. A feature's is read from its worktree, else its
    /// branch, as the core reads a raw file.
    pub path: String,
}

/// A page of a `mockups/` folder, to show in a web view.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Mockup {
    /// Its path on the server, `/r/<name>/mockups/<secret>/<path>`, with the frame secret: none
    /// when no such file is there, or it is in no `mockups/` folder. A link's query and anchor
    /// go after it.
    pub frame: Option<String>,
}

impl Record for Mockup {
    const NAME: &'static str = "Mockup";
    type Args = MockupArgs;
    type Value = Self;
}

/// Stops a checkout's preview command, if it runs, and starts it again: the way out of a failed
/// preview. It answers the preview as it is then, starting.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct PreviewRestart {
    /// The repository's name in the list.
    pub repo: String,
    /// A feature's or a change's folder, or `main`.
    pub folder: String,
}

impl Action for PreviewRestart {
    const NAME: &'static str = "preview.restart";
    type Input = Self;
    type Output = Preview;
}
