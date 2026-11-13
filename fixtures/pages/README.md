# Page fixtures

What the server's tests of extension pages build, in
[`extension_pages.rs`](/crates/server/tests/extension_pages.rs): an extension with a page, copied
into a temporary config folder, and stand-ins for the two modules of the app a page gets built in.

- `hello/`: an extension that is only a page, with a file it imports, `nsh`, `uraeda/ui`, and
  `uraeda/page`.
- `modules/`: stand-ins for `uraeda/ui` and `uraeda/page`, laid out as `app/` is: `ui/index.ts` and
  `extensions/page.tsx`. The tests name this folder in `URAEDA_PAGE_MODULES`, so they build the same
  page whatever the app's own modules become.
