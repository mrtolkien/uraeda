# Mockups

How Uraeda's own planned UI is shown to the human before it is built. The
[Preview](../decisions/preview.md) decision holds the boundaries: a mockup behaves, it is made of
the real components where they exist, and an HTML page may carry a layout or a sketch. This guide
says which form fits which job, and what the human looks for. The skill's
[spec step](/skills/uraeda/references/spec.md#mockups) says how any project draws its mockups: read
it first.

## What the human wants from a mockup

The first answer on the subject is still the one to remember:

> "I AM NOT LOOKING FOR SCREENSHOTS. I want REAL, INTERACTIVE MOCKUPS that PROPERLY show how the
> feature will BEHAVE. That's where the issues lie usually."

A mockup is there to settle behaviour before the code exists. It is part of the spec, not a file
beside it: "I want the ability to show UI mocks AS PART OF THE SPECS. There's not always a question
coming with the mock: it's more to validate the behaviour and UX before it gets implemented."

It must also look like the app. When a set of mockups was drawn in a style of its own, the human
could not decide from them: "The mockups are very bad, they look nothing like the actual app, making
it extremely hard to decide. Redo the mockups, make sure they are close to the actual app look and
feel."

And it deserves care. Asked whether the new look should get a mockup: "Yes, build the HTML mockup.
Work hard on it."

## Which form for which job

| The job                                         | The form                                 | How the human sees it                   |
| ----------------------------------------------- | ---------------------------------------- | --------------------------------------- |
| A component, a control, or a view's named state | A gallery page, in `app/gallery/`        | `just gallery`, or its pictures         |
| A page's layout, or a whole new look            | An HTML page in the feature's `mockups/` | Live, in the spec's page                |
| Several looks to choose between, in a round     | Throwaway prototypes, in any format      | Linked from each option of the question |

- **A gallery page is the rule for what the components can draw.** The picked variant is then the
  first commit of its view. `just gallery-shots [word]` pictures a page in both themes, at 1400,
  900, and 390 points wide: look at each picture before linking the page.
- **An HTML page is for what no component holds yet.** The human allowed it in these words: "Ok: add
  that HTML mockups are ok for layout or freeform mockups." Draw it with the app's tokens and fonts,
  so that it reads as the app. A browser is not the real renderer: what an HTML page settles is
  checked again in the gallery before it becomes a token or a rule.
- **Prototypes are for choosing a direction**, and are deleted once it is chosen. For the app's
  whole look the human set no limit on the format: "The mockups can be whatever: storybook stories,
  pure HTML, SVGs, PNGs made with image-generation models, ..." and "It's about vibes." A prototype
  is not a spec's mockup: the picked one is rebuilt as a gallery page or an HTML page.

## What the human reviews, and where

At the desk, the human tries a mockup: presses its keys, resizes it, opens what opens. On the phone,
they read "big picture mockups" and skip the rest: reviewing component stories there is "too
annoying". So a mockup that needs a decision shows its whole view, at a phone's width too, and a
component's states are for the agent's own review, and for the human at the desk.

A habit from the first reviews: a mockup is shown at the widths the app serves. "On desktop it
should be easy to look and test both", desktop and phone.

## What is not settled

A gallery page cannot be drawn inside a spec's page today: the gallery is a native app. The human
asked for mockups as part of the spec, and only an HTML page is. Until the gallery can be embedded,
a spec that relies on a gallery page says how to run it, and shows its pictures in the pull request.
