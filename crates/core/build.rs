#[path = "build/track.rs"]
mod track;

fn main() {
    // The skill, the shipped colour themes, and the built-in extensions' manifests, embedded with
    // include_dir, which does not track the files it reads.
    track::track("../../skills/uraeda");
    track::track("themes");
    track::track("extensions");
    // napi-rs regenerates the TypeScript declarations of a dependency crate only when its build
    // script registers napi's environment variables.
    if std::env::var_os("CARGO_FEATURE_NAPI").is_some() {
        napi_build::setup();
    }
}
