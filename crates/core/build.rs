fn main() {
    // napi-rs regenerates the TypeScript declarations of a dependency crate only when its build
    // script registers napi's environment variables.
    if std::env::var_os("CARGO_FEATURE_NAPI").is_some() {
        napi_build::setup();
    }
}
