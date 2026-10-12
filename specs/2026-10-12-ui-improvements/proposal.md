# UI improvements

## What

Make the UI easier to use and smoother. This is solely focused on functionality at the moment.

## Notes

- Use a bigger font on desktop if possible? I need to scale desktop by 120% to look good. Mobile is
  ok.
- In home, the tasks should be clickable and open a "task view" with all the options. Already
  written out drafts/proposals should have markdown
- Remove default fields in proposal when moving from a priorities.md line
- Top navigation for questions -> right now it's impossible to jump to the next unanswered
  question/quickly navigate the tree. We need some sort of breadcrumbs at the top. I'm sure Astryx
  has something.
- No reset when coming back to the answers page: when navigating out and back to the questions page,
  it put me back at the
- Text alignment should be justified for paragraphs, it looks better on mobile.
- Block highlight while typing comment: when commenting a spec line, the block is not highlighted
  atm
- Click "uraeda" in the top bar -> go home, of course
- When using the top left `+` to add a priority, then it takes the place of the "uraeda" bar, and
  "Added to Now, not committed" takes it place. This is just weird behaviour.
- Priorities page is a mess right now: no good visual hierarchy, everything behind a modal including
  simple edits (can't tap the task to edit it), the modal is really mobile-only atm, can't easily
  add a line, drag and drop ordering has no animation (on PC), ...

We'll have a few UI-related decisions coming with this: it should clearly highlight the right
approach to building UI for this app. I don't want to come back to half-baked views again where it's
mostly good but also very scuffed.
