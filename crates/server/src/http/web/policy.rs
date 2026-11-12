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
/// - Frames show the server's own: a preview, a mockup, an inline page, each sandboxed by the
///   app, and an extension's page, at its own host, `<extension>.localhost` on the server's port,
///   where a browser runs it in a process of its own. Workers are the page's own.
/// - Only Uraeda's own pages frame the page, as `X-Frame-Options` says too.
pub(super) const POLICY: &str = "default-src 'self'; \
    script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob:; \
    style-src 'self' 'unsafe-inline'; connect-src 'self'; \
    img-src 'self' data: blob: https:; media-src 'self' data: blob: https:; \
    font-src 'self' data:; frame-src 'self' blob: data: http://*.localhost:*; \
    worker-src 'self' blob:; \
    object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'";

/// The policy of the page an extension's page runs in, `extension.html`, at its own host: its
/// own files and WebAssembly, its own origin for its requests, which carry no session there, so
/// a page reaches no other site, and the app on this machine alone may frame it.
pub(super) const EXTENSION_POLICY: &str = "default-src 'self'; \
    script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob:; \
    style-src 'self' 'unsafe-inline'; connect-src 'self'; \
    img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self' data:; \
    frame-src 'none'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; \
    form-action 'none'; frame-ancestors http://127.0.0.1:* http://localhost:*";
