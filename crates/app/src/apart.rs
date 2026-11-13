//! Work that takes tens of milliseconds, a diagram drawn or a code block read, kept off the
//! thread that draws the app where the platform has another.

/// Runs `work` on a thread of its own, and gives its result. A browser gives a page one thread:
/// there the work runs at once, in the call.
#[cfg(not(target_arch = "wasm32"))]
pub(crate) async fn apart<T: Send + 'static>(
    work: impl FnOnce() -> T + Send + 'static,
) -> Result<T, String> {
    nsh_core::prelude::blocking(work)
        .await
        .map_err(|error| error.to_string())
}

/// Runs `work` on a thread of its own, and gives its result. A browser gives a page one thread:
/// there the work runs at once, in the call.
#[cfg(target_arch = "wasm32")]
#[expect(
    clippy::unused_async,
    reason = "the same signature as where it waits for a thread"
)]
pub(crate) async fn apart<T>(work: impl FnOnce() -> T) -> Result<T, String> {
    Ok(work())
}
