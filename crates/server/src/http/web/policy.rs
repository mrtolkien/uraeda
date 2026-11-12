//! The page's `Content-Security-Policy`: what the app's page may load, run, and reach. The app
//! talks to its own origin alone, so a script that got into the page could send nothing out
//! with a request of its own.

/// The page's policy.
///
/// - Scripts are the build's own files and WebAssembly. Scripts written in the page are allowed
///   too, and that is Native Shell's doing: its runtime writes the import map of the app's own
///   frame as a script in that frame, new at each build, so no hash or nonce the server knows
///   names it (seen in Chromium: without it, "Failed to resolve module specifier nsh"). The rules
///   below are what holds then.
/// - The page reaches its own origin alone: its requests and its WebSocket.
/// - Styles are the app's own, which Native Shell writes on each view as it draws.
/// - Pictures and sounds come from the server, from the page itself (`data:`, `blob:`, a pasted
///   picture's preview), and from the web, as a document's own links name them.
/// - Frames show the server's own: a preview, a mockup, and an inline page, each sandboxed by
///   the app. Workers are the page's own. Both leave room for an extension's page to run in a
///   frame or a worker of this origin (the plan's task 58).
/// - Only Uraeda's own pages frame the page, as `X-Frame-Options` says too.
pub(super) const POLICY: &str = "default-src 'self'; \
    script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob:; \
    style-src 'self' 'unsafe-inline'; connect-src 'self'; \
    img-src 'self' data: blob: https:; media-src 'self' data: blob: https:; \
    font-src 'self' data:; frame-src 'self' blob: data:; worker-src 'self' blob:; \
    object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'";
