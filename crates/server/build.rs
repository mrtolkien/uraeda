#[path = "../core/build/track.rs"]
mod track;

fn main() {
    // The app's modules a page is built with, embedded with include_dir, which does not track the
    // files it reads: without this, an incremental build kept an old copy (`src/extensions/modules.rs`).
    track::track("../../app/ui");
    track::track("../../app/extensions");
}
