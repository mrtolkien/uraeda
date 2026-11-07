fn main() {
    // The skill is embedded with include_dir, which does not track the files it reads.
    println!("cargo:rerun-if-changed=../../skills/uraeda");
    // The shipped colour themes, embedded the same way.
    println!("cargo:rerun-if-changed=themes");
    // napi-rs regenerates the TypeScript declarations of a dependency crate only when its build
    // script registers napi's environment variables.
    if std::env::var_os("CARGO_FEATURE_NAPI").is_some() {
        napi_build::setup();
    }
}
