//! An extension's page and the app that shows it: what the server builds a page around, and the
//! names of the host channel between the page and the app. The server signs these names into
//! every page's package as its rights, and the app answers them: a page reaches nothing else.
//!
//! A page talks to its host in these messages, each a `host.post` or a `host.call` of the page,
//! all but `start` and `loaded` sent by `uraeda/page` (`app/extensions/page.tsx`):
//!
//! - `start`: the page's engine runs, posted before any of the page's code.
//! - `loaded`: the page's code ran to its end; `problem` instead when it threw.
//! - `ready`, with what the page declared: its slot is drawn.
//! - `problem`, with a `message`: the page threw, as it loaded or later.
//! - `alive`, with the number of the `ping` it answers.
//! - `record`, `call`, and `navigate`: what the app answers for the page.
//!
//! The app's events to a page are `show`, `ping`, `theme`, `props`, `record`, and `key`:
//! `app/extensions/host.tsx` says what each carries.

/// What a page may call of its host, and nothing else of the machine: no file, no process, no
/// network, no web view, no clipboard. A package's capabilities are `{ "host": PAGE_HOST }`.
pub const PAGE_HOST: [&str; 8] = [
    "start", "loaded", "ready", "problem", "alive", "record", "call", "navigate",
];

/// In a browser, the page's way to the app is its frame's, `uraedaHost`, on the page's own
/// window or, where the player runs it in a window of its own, its frame's. Native Shell 0.5.0's
/// browser runtime sends `host.post` and `host.call` to an engine channel nothing answers there,
/// never to the frame's player's `host`, so the entry points them at the frame's before any of
/// the page's code runs: every module importing `host` gets the same object. The Linux host has
/// no such window, and keeps its channel. Ruling R466 holds the upstream report.
const BROWSER: &str = "const frame = (globalThis as { uraedaHost?: typeof host }).uraedaHost\n  \
    ?? (globalThis.parent as { uraedaHost?: typeof host } | undefined)?.uraedaHost;\n\
    if (frame) {\n  \
    host.post = frame.post;\n  \
    host.call = frame.call;\n\
    }\n\n";

/// The module a page's build starts from, which imports the page whose entry is the absolute path
/// `page`. It posts `start` first, answers the host's pings, then runs the page's code, and says
/// how that ended: a page that throws while it loads is named by its host, with what it threw,
/// and the app goes on. A page that holds its engine answers its pings late, whatever it imports.
///
/// The page is imported by `import()`, which the bundler builds into the same module: its code
/// then runs in a promise the entry catches.
pub fn page_entry(page: &str) -> String {
    let page = serde_json::Value::from(page);
    format!(
        "import {{ host }} from \"nsh\";\n\
         \n\
         {BROWSER}\
         host.post(\"start\");\n\
         host.on(\"ping\", (ping: unknown) => host.post(\"alive\", ping));\n\
         import({page}).then(\n  \
           () => host.post(\"loaded\"),\n  \
           (error: unknown) => host.post(\"problem\", {{ message: String(error) }}),\n\
         );\n"
    )
}
