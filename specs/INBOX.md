# Inbox

- If there's nothing in progress, the "nothing in progress" in the sidebar looks weird
- Cross repo notes would be nice!
- I dislike moving buttons: for example on feature start, the composer jumps around

## Bugfix

- In a failed change (because inbox had uncommitted change: why the fuck does it block btw),
  clicking "go to proposal" didn't work.

## To test

## Deferred fixes

- [agent] [inbox-again] The leader key fixtures' spec and rounds still link the UI checks and UI
  coherence decisions, gone from `fixtures/realistic/decisions/`: in the sandbox those links open a
  missing decision (`fixtures/spec-leader-key/`, `fixtures/round-leader-key/`)
- [agent] [mockup-previews] An agent's image whose path holds a percent-encoded character, as
  `my%20shot.png`, shows "Image missing" in a session though it draws in a page: `repositoryPath` in
  `packages/web/src/AgentStories.tsx` does not decode it before `imagePath` encodes it again
- [agent] [mockup-previews] `is_svg` in `crates/core/src/images.rs` refuses a doctype in mixed case,
  `<!DocType svg>`, or an internal subset closed as `] >`: such an SVG shows "Image missing"
- [agent] [mockup-previews] In Firefox, an SVG drawn in an `<img>` follows the OS's colour scheme,
  not Uraeda's theme, so a prototype's `prefers-color-scheme` styles can show the other theme's
  colours; Chromium follows the theme
- [agent] [mockup-previews] A clicked link to an SVG in `mockups/` opens it through the mockup
  route, whose policy lets its scripts run in an opaque origin, while the image route runs none:
  `pathLink` in `packages/web/src/links.tsx` could send it to the image route
