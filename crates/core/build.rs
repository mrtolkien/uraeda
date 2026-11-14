#[path = "build/track.rs"]
mod track;

fn main() {
    // The skill, embedded with include_dir, which does not track the files it reads.
    track::track("../../skills/uraeda");
}
