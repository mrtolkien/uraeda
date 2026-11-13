---
status: active
approved-by: mrtolkien
icon: eye
---

# Preview

Uraeda's planned UI and the states of its views are pages of its gallery, an app that shows the real
components alone, in named states, so a mockup is the code that ships. The gallery draws with the
real framework, on each platform the app ships on. A user project's Storybook, a tool that shows web
components the same way, is still embedded live in specs, questions, and sessions.

## Rules

- A spec's mockups, and the named states of Uraeda's views, MUST be gallery pages written with the
  real components.
- The gallery MUST draw with the app's own framework and tokens, on each platform the app ships on.
- Gallery pages MUST NOT run as tests: the rare UI tests run elsewhere, as [Testing](testing.md)
  says.
- The full check, `just ready`, MUST check the gallery, so a page that does not compile fails it.
  Checked by `just app-check`, which checks the types of every TSX file of `app/`.
- A project's own preview MUST be the command its `preview-folder` and `preview-command` fields
  hold. Checked by `ura check`.
- A native client MUST draw a project's preview in a web view, apart from the app's own views.
- A page's layout, or a sketch no component holds yet, MAY be an HTML page in the feature's
  `mockups/` folder, linked from its gallery page.
- An investigation MAY compare throwaway prototypes in any format, which the spec's approval
  deletes.

## Why

Mockups made of the real components cannot drift from the code. Storybook draws in a browser, with a
web framework, so it cannot show Native Shell's components: the gallery draws them with the real
framework, on the real platform, and is what a design review looks at. Users' projects keep their
Storybooks, which only a web view can draw inside a native app. History:
[UI iteration](../done/2026-10-15-ui-iteration.md).

## Alternatives considered

- Storybook over the app's web build: one platform only, and not the one the Linux app draws with.
- A task serving the whole app over fixtures: no new dependency, but pages only, and no place for
  variants.

## Consequences

- Planned UI starts as real code: the picked variant is the first commit of its view.
- An investigation can compare several looks cheaply, and git keeps its prototypes once deleted.
- The gallery is Uraeda's to keep: Storybook's controls and add-ons are gone.
- Uraeda's own repository has no preview command: its gallery is an app, not a page to embed.

## Applies to

- `app/gallery/`, and every feature with UI work
- `crates/server/`, for the previews of users' projects
