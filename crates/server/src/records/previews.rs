//! The records of previews: `Preview`, a checkout's preview command, `Story`, a story of it,
//! both of which start the command when read, and `StoryHref`, an agent's link as the core reads
//! it; and the action `preview.restart`.

use uraeda_core::files::stories::story_link;
use uraeda_protocol::{
    Preview, PreviewArgs, PreviewRestart, PreviewState, Story, StoryArgs, StoryHref, StoryState,
};

use crate::Failure;
use crate::http::segment;
use crate::live::{self, Registry};
use crate::preview::checkout::{MAIN, runnable};
use crate::preview::index::{UNREADABLE, match_story};
use crate::preview::runner::{Checkout, State};
use crate::preview::{Previews, Reader};
use crate::shared::Shared;

/// Registers the previews' records and their action.
pub(super) fn register(_: &Shared, registry: &Registry) -> Result<(), Failure> {
    registry.record::<Preview>(|shared, args| Ok(read_preview(shared, &args)));
    registry.record::<Story>(|shared, args| Ok(read_story(shared, &args)));
    registry.record::<StoryHref>(|_, args| {
        let (path, export) = story_link(&args.href)
            .map(|story| (story.path, story.export))
            .unzip();
        Ok(StoryHref { path, export })
    });
    registry.action::<PreviewRestart>(|call, input| Ok(restart(call.shared(), input)));
    Ok(())
}

/// A preview's record from its state.
fn preview_of(checkout: &Checkout, state: State) -> Preview {
    let (state, base, error) = match state {
        State::Starting => (PreviewState::Starting, None, None),
        State::Ready { .. } => (PreviewState::Ready, Some(checkout.base.clone()), None),
        State::Failed { error } => (PreviewState::Failed, None, Some(error)),
    };
    Preview { state, base, error }
}

const NO_PREVIEW: Preview = Preview {
    state: PreviewState::None,
    base: None,
    error: None,
};

/// A checkout's preview, by its folder: reading it is a view, which starts it.
fn read_preview(shared: &Shared, args: &PreviewArgs) -> Preview {
    let previews = shared.get::<Previews>();
    let Some(checkout) = runnable(shared, &previews, &args.repository, &args.folder) else {
        return NO_PREVIEW;
    };
    let reader = reader(&args.repository, &args.folder, None);
    preview_of(&checkout, previews.view(shared, &checkout, reader))
}

/// Restarts a checkout's preview, by its folder: none without a checkout or a decision.
fn restart(shared: &Shared, input: PreviewRestart) -> Preview {
    let previews = shared.get::<Previews>();
    let Some(checkout) = runnable(shared, &previews, &input.repository, &input.folder) else {
        return NO_PREVIEW;
    };
    let reader = reader(&input.repository, &input.folder, None);
    preview_of(&checkout, previews.restart(shared, &checkout, reader))
}

fn reader(repository: &str, folder: &str, story: Option<&str>) -> Reader {
    Reader {
        repository: repository.to_owned(),
        folder: folder.to_owned(),
        story: story.map(str::to_owned),
    }
}

/// The parts of a story's id, `<folder>:<path>#<export>`: its folder, its file, and its export.
/// Its link is checked by the core's rule, as written from the repository's top level: none
/// when it names no story.
fn story_parts(id: &str) -> Option<(&str, String, String)> {
    let (folder, link) = id.split_once(':')?;
    let target = story_link(link).filter(|_| !folder.is_empty())?;
    let written = format!("{}#{}", target.path, target.export) == link;
    written.then_some((folder, target.path, target.export))
}

/// A story link of a checkout, by its id: reading it is a view. Once its preview is ready, the
/// story is found in its index, or missing; a found story is starting until its compile ended,
/// so its frame is never blank.
fn read_story(shared: &Shared, args: &StoryArgs) -> Story {
    let story = |state, error| Story {
        state,
        frame: None,
        storybook: None,
        error,
    };
    let previews = shared.get::<Previews>();
    let parts = story_parts(&args.id);
    let found = parts.and_then(|(folder, path, export)| {
        let checkout = runnable(shared, &previews, &args.repository, folder)?;
        Some((folder, path, export, checkout))
    });
    let Some((folder, path, export, checkout)) = found else {
        return story(StoryState::None, None);
    };
    let reader = reader(&args.repository, folder, Some(&args.id));
    match previews.view(shared, &checkout, reader) {
        State::Starting => return story(StoryState::Starting, None),
        State::Failed { error } => return story(StoryState::Failed, Some(error)),
        State::Ready { .. } => {}
    }
    let Some(index) = live::wait(previews.runner.index(&checkout.base)) else {
        // A ready preview whose index fails, or does not answer in time.
        return story(StoryState::Failed, Some(UNREADABLE.to_owned()));
    };
    let Some(entry) = match_story(&index, &checkout.folder, &path, &export) else {
        return story(StoryState::Missing, None);
    };
    if !previews.runner.compiled(&checkout.base, entry) {
        return story(StoryState::Starting, None);
    }
    let id = segment(&entry.id);
    let page = match folder {
        MAIN => "/storybook".to_owned(),
        folder => format!("/f/{}/storybook", segment(folder)),
    };
    Story {
        frame: Some(format!(
            "{}iframe.html?id={id}&viewMode=story",
            checkout.base
        )),
        storybook: Some(format!("{page}?path=/story/{id}")),
        ..story(StoryState::Ready, None)
    }
}
