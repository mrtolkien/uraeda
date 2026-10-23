# Mockups: deleted, the stories replace them

The investigation's throwaway prototypes lived here: five directions for the layout and look, the
comparison page, the logo and icon comparisons, their screenshots, and the second round's
`terminal-2.html`, the terminal look with a little cyber that the human picked. They were clickable
HTML over fake data, never shipping code.

They were deleted once the stories, written with the real components over Uraeda's real server,
replaced them, as the [preview decision](../../decisions/preview.md) asks. Git keeps them: they are
whole at commit `bb5c553b`, the commit before their deletion. `git show bb5c553b:<path>` reads one,
and `git log -- specs/2026-10-20-layout-look/mockups/` lists their history.

## Where the stories live

The spec's mockups are stories in `packages/web/src/`, each embedded in the spec at a phone's width
and a desktop's:

- [The shell](/packages/web/src/shell/Shell.stories.tsx): wide, semi-wide with its rail open, and
  narrow.
- [The home](/packages/web/src/Home.stories.tsx): wide, with the fixture's problem, and semi-wide.
- [Constitution and decisions](/packages/web/src/decisions/DecisionsPage.stories.tsx): the
  constitution, a principle, a decision, a decision changed on a branch, and the palette.
- [Settings](/packages/web/src/settings/SettingsView.stories.tsx): the form, and a search.

The app's own screenshots of these views, at both sizes and in both schemes, and at 1205 px for the
shell and the home, are in [`screenshots/`](../screenshots/).
