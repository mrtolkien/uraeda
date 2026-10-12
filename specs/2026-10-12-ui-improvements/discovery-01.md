# Discovery, round 01: UI improvements

## Summary

The proposal is a list of fixes to the web UI, which the
[web UI feature](../done/2026-10-11-web-ui.md) shipped on 2026-10-12. It covers seven things:

- larger text on desktop;
- tappable home tasks that open a task view;
- drafts without the template's placeholders;
- navigation between questions, and the reading position kept when coming back to a round;
- justified paragraphs;
- the reviewed block highlighted while a comment is typed;
- a top bar that links home and stops being pushed around by ＋, and a priorities page that is
  usable on desktop.

It also asks for UI decisions that set how this app's UI is built, so views stop ending up "mostly
good but scuffed".

What exists explains most of these problems. The pages are built on 533 lines of global CSS in px,
and its body text is smaller on desktop than on the phone. Overlays are `BottomSheet` everywhere,
which on desktop is a 640 px sheet rising from the bottom of the screen. Navigation always scrolls
to the top, and the page shows "Loading…" while data comes back, so the browser has nothing to
restore the reading position onto. Priorities are edited only through a sheet of buttons. The web
UI's spec named Astryx components that were not used in the end: `Outline`, `Toast`, `Heading`,
`Text`, and `List`. No rule or check would have caught it.

Established products agree on most of the behaviours asked for:

- an item opens in a detail view: a side panel on desktop, a page on the phone;
- small edits happen in place;
- a new item is added inline at the end of a section;
- items are reordered with a drag handle on desktop and long-press on the phone, with a "Move to…"
  picker as the main path on phones;
- a long list of items to work through has "next open item" navigation.

They differ in where the detail view opens, whether reordering animates, and whether confirmations
use toasts.

The decisions part has well-trodden answers. Design systems back their rules with lint rules, layout
checks at fixed screen sizes, and accessibility scans. Pixel-by-pixel screenshot comparisons are
known to be fragile across machines.

## How other products do it

### Long forms and review queues

- **SurveyMonkey's progress bar** counts pages, or questions answered out of the total in its
  one-question mode. It does not recalculate when logic skips questions
  ([progress bar](https://help.surveymonkey.com/en/surveymonkey/create/progress-bar/)).
- **Tally's progress bar** sits at the top and is not sticky
  ([progress bar](https://tally.so/help/progress-bar)).
- **Qualtrics** shows "Survey Completion" as a percentage, which jumps with skip logic. Its "finish
  later" is a cookie on the same browser
  ([look and feel](https://www.qualtrics.com/support/survey-platform/survey-module/look-feel/general-look-feel-settings/),
  [survey experience](https://www.qualtrics.com/support/survey-platform/survey-module/survey-options/survey-experience/)).
- **None of the form products read documents a "jump to the next unanswered question" button.** They
  block at the page boundary instead.
- **The GOV.UK error summary** fills that gap. It sits at the top of the page and links each missing
  answer to its field
  ([error summary](https://design-system.service.gov.uk/components/error-summary/)). The GOV.UK task
  list marks incomplete tasks so they stand out
  ([task list](https://design-system.service.gov.uk/components/task-list/)).
- **GitLab merge requests** move to the next or previous open thread with `n` and `p`, and to the
  next or previous file with `]` and `[`. A counter of open threads sits at the top
  ([shortcuts](https://docs.gitlab.com/user/shortcuts/),
  [merge requests](https://docs.gitlab.com/user/project/merge_requests/)).
- **GitHub's Files changed page** has a file tree with markers for files with comments, a "Viewed"
  checkbox per file, and a progress bar of files viewed in the header
  ([reviewing changes](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/reviewing-proposed-changes-in-a-pull-request),
  [changelog](https://github.blog/changelog/2026-01-22-improved-pull-request-files-changed-page-on-by-default/)).
- **Outlines**: Google Docs shows one from the headings in a left panel
  ([outline](https://support.google.com/docs/answer/6367684)). Notion shows a floating outline on
  the right that stays while scrolling
  ([headings](https://www.notion.com/help/columns-headings-and-dividers)).
- **Google Forms** shows "Draft saved" at the top and keeps answers for 30 days, so the respondent
  comes back to where they were ([drafts](https://support.google.com/docs/answer/10952360?hl=en)).

### Prioritized lists

- **Todoist**
  - New tasks are added inline with "Add task" at the bottom of a list.
  - Editing is "not inline": a click opens the task view.
  - Reordering uses a drag handle on hover on desktop, and press-and-hold then drag on mobile.
  - A task moves to another section through "Move to…" in its ⋯ menu
    ([tasks](https://www.todoist.com/help/todoist/features/introduction-to-tasks-080OAXric)).
- **Trello**
  - "Add a card" sits at the bottom of each list, and `n` opens a composer below the hovered card.
  - `t` edits a title in place.
  - Undo covers moves and renames, but not deletion
    ([adding](https://support.atlassian.com/trello/docs/adding-cards/),
    [shortcuts](https://support.atlassian.com/trello/docs/keyboard-shortcuts-in-trello/),
    [undo](https://support.atlassian.com/trello/docs/undoing-an-action-in-trello/)).
- **GitHub Projects**
  - An "Add item" row sits at the bottom of a table or column.
  - Enter edits a cell in place, and Escape cancels
    ([adding items](https://docs.github.com/en/issues/planning-and-tracking-with-projects/managing-items-in-your-project/adding-items-to-your-project),
    [shortcuts](https://docs.github.com/en/get-started/accessibility/keyboard-shortcuts)).
- **Things 3**
  - On iPhone, a to-do is reordered with tap-and-hold, then drag.
  - The Magic Plus button can be dragged to where the new to-do goes.
  - On the Mac, Cmd+Up and Cmd+Down move a to-do
    ([iPhone](https://culturedcode.com/things/support/articles/2803582/),
    [Mac keys](https://culturedcode.com/things/support/articles/2785159/)).
- **Linear**
  - Items are ordered by dragging, and dropping into another group changes the item's group.
  - Opt+Shift+Up and Down move an item to the top or bottom.
  - Almost every change is undone with Cmd+Z
    ([display options](https://linear.app/docs/display-options),
    [board](https://linear.app/docs/board-layout),
    [undo](https://linear.app/changelog/undo-actions)).
- **Apple Reminders** reorders with tap-and-hold and drag, and a reminder dropped onto another
  becomes its subtask ([reminders](https://support.apple.com/en-us/119953)).
- **Notion** shows a hover drag handle with blue drop guides on desktop. It documents no handle and
  no hover on the phone ([editing basics](https://www.notion.com/help/writing-and-editing-basics)).

### Detail views

- **Todoist's task view**: the name, description, and sub-tasks are on the left, and the properties
  are in a right-hand sidebar on the web. On mobile the properties become tappable chips. Chevrons
  move to the previous or next task, and a ⋯ menu holds the rare actions
  ([task view](https://www.todoist.com/help/articles/use-the-task-view-to-manage-tasks-in-todoist-eDeRDO0C)).
- **Jira** lets each user choose between a right sidebar and a centred dialog
  ([board settings](https://support.atlassian.com/jira-software-cloud/docs/customize-your-view-of-the-board-and-backlog/)).
- **GitHub Projects** has a side panel that can be pinned while the list stays usable
  ([changelog](https://github.blog/changelog/2023-07-20-github-issues-projects-july-20th-update/)).
- **Linear's peek** previews the focused issue with the keyboard, and ↑ and ↓ walk the list
  ([peek](https://linear.app/docs/peek)).

### Quick capture and confirmations

- **Capture opens a small modal from one key**: Todoist `Q`, Linear `C`, Things Ctrl+Space. Linear
  keeps a local draft when it is closed
  ([Todoist](https://www.todoist.com/help/todoist/features/use-task-quick-add-in-todoist-va4Lhpzz),
  [Linear](https://linear.app/docs/creating-issues),
  [Things](https://culturedcode.com/things/support/articles/2249437/)).
- **Neither Things nor Todoist documents a toast after adding**: the item appearing in the list is
  the confirmation.
- **Transient messages sit at the bottom, bottom-left on desktop, for a few seconds**, usually with
  Undo: Todoist's undo pop-up, and Gmail's "Message sent" with a 5 to 30 s window
  ([Todoist](https://www.todoist.com/help/todoist/features/complete-a-task-with-a-recurring-date-dmI6SVqdP),
  [Gmail](https://support.google.com/mail/answer/2819488)).
- **Primer advises against toasts** for accessibility (WCAG 2.2.1 and 4.1.3), and prefers results
  that are self-evident ([toasts](https://primer.style/accessibility/toasts)).

### Commenting on a range

- **GitHub** selects a range by Shift-clicking or dragging line numbers, and the composer opens
  inline below the range. On GitHub Mobile, a long press enters multi-select
  ([commenting](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/commenting-on-a-pull-request),
  [mobile](https://github.blog/news-insights/product-news/even-better-code-review-in-github-for-mobile/)).
- **GitLab** keeps handles on the range's first and last lines while the form is open, so the range
  can still be adjusted until the comment is saved
  ([discussions](https://docs.gitlab.com/user/discussions/)).
- **Google Docs** marks commented text in yellow, and on iPhone swipes move between comments
  ([iOS comments](https://support.google.com/docs/answer/65129?hl=en&co=GENIE.Platform%3DiOS)).

### What they have in common

- **Items open in a detail view.** On desktop it is a side panel or a centred dialog, with the list
  still visible. On a phone it is a full page. Properties sit beside the content on desktop and as
  chips on a phone. Previous and next move through the list.
- **Small edits happen in place**, like a title, and full edits happen in the detail view.
- **Adding happens inline at the end of a section**, with a global quick add as a second path.
- **Reordering** uses a drag handle with a drop indicator on desktop, and long-press then drag on a
  phone. A "Move to…" picker is the main path between sections on phones. Keyboard shortcuts move an
  item up, down, to the top, or to the bottom.
- **Undo** covers moves and edits, and deletion often goes without it.
- **A long list of things to work through** shows a count of what is open, a way to the next open
  item, and an outline or tree to jump anywhere.
- **The reading position and answers survive leaving and coming back.**
- **The range being commented stays marked** while the comment is written, next to its composer.
- **Confirmations are the result itself** where it is visible, and otherwise a short bottom message,
  often with Undo.

## Standards and libraries

### Astryx 0.6.7

The app uses `@astryxdesign/core` and `theme-neutral` 0.6.7
([package.json](/packages/web/package.json)). Every fact below comes from the components' docs in
the installed package, `@astryxdesign/core/src/<Component>/<Component>.doc.mjs`.

- **`Outline`** is a table of contents with a scroll spy.
  - It takes `items` (`id`, `label`, `level`), a controlled `activeId`, an `offset` for a sticky
    header, and `onNavigateStart` and `onNavigateEnd` for an arrival flash.
  - It renders a `nav` landmark with a single tab stop and arrow keys.
  - It does not stick on its own, has no mobile mode, and has no notion of "unanswered".
- **`TreeList`** is an expandable tree with full tree semantics. Its expansion cannot be controlled
  from outside.
- **`Breadcrumbs`** exist, for a page's parents.
- **`AppShell`**
  - With `height="auto"`, the header and the side nav are sticky.
  - Below 768 px (`mobileNav.breakpoint`, `md` by default), a shell with only a side nav gets a 48
    px top bar. The bar shows the side nav's header and the menu button. The side nav's footer shows
    only in the drawer.
  - `TopNav` has `heading`, `startContent`, `centerContent`, and `endContent` slots.
- **Home links**: `SideNavHeading` and `TopNavHeading` take `headingHref`, which makes the heading a
  link. The app does not set it ([Shell.tsx](/packages/web/src/Shell.tsx)).
- **`BottomSheet`**
  - It is a native `dialog`. With a scrim it opens with `showModal()`, which makes the page inert.
    Without one it opens with `show()`, and the page stays usable.
  - It takes `height` (`hug`, `capped` about 62%, `tall` about 92%), `snapPoints`, and `purpose`.
  - On desktop it stays a sheet: full width up to 640 px, centred at the bottom of the screen.
  - Only a `tall` sheet keeps a focused field above the iOS keyboard.
  - A future minor version changes its default padding to 16 px.
- **There is no `Drawer`** in 0.6.7, 0.6.8, or the 0.7 canary, even though the 0.6.7 changelog
  mentions one.
  - `Dialog` can be pinned to an edge with `position`, but does not slide in.
  - `DropdownMenu`, `MoreMenu`, `ContextMenu`, and the selectors have `presentation="adaptive"`,
    which uses a bottom sheet under 768 px with a coarse pointer and an anchored popover otherwise.
  - Dialog and BottomSheet do not adapt on their own.
- **`List` and `Item`** have rows that can be clicked or used as links, an `isSelected` state, and
  touch swipe actions, which must also be reachable another way.
  - No Astryx component reorders by dragging or edits in place.
  - 0.6.8 lets menu items carry drag handlers, which is not a reordering feature.
- **Sizes**
  - Font sizes are in rem: the body is 0.875rem, 14 px.
  - Spacing and element heights are in px: 28, 32, and 36 px.
  - Raising the root font size therefore scales text but not controls.
  - `defineTheme({ extends, typography: { scale }, adaptations })` is the supported way to change
    sizes by width or pointer. Its own example sets `--size-element-md` to 44 px under a coarse
    pointer, which the app does by hand today ([styles.css](/packages/web/src/styles.css)).
  - Its docs recommend `astryx theme build` over defining the theme at run time.
- **`Toast` and `useToast()`**
  - It takes a `uniqueID`, an `endContent` such as Undo, and an `autoHideDuration` of 5 s by
    default.
  - Its docs name a message like "Added to Now, not committed" as its purpose.
  - It needs a `LayerProvider` or the `AppShell` above the component that calls it.
- **Selection**: no token is meant for a selection. The selected background is
  `--color-accent-muted`, which in the neutral theme is a faint gray close to
  `--color-background-muted`, the colour of the reading layout's bands.
- **0.6.8**, the latest release, came out on 2026-10-10. It fixes AppShell losing a page's content,
  state, and input focus when the window crosses the mobile breakpoint.
- **The website's component pages** returned only their navigation when fetched
  ([components](https://astryx.atmeta.com/components)), so the local docs are the source.

### Justified text

- **WCAG 2.2 SC 1.4.8 Visual Presentation** asks that text not be justified, through a mechanism. It
  is **AAA**, so justified text does not break AA
  ([understanding](https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation.html),
  [F88](https://www.w3.org/WAI/WCAG22/Techniques/failures/F88)). The reason it gives: uneven spaces
  make "rivers of white" that some readers cannot follow.
- **Practical Typography** calls justification personal preference, and says it needs hyphenation.
  It says browsers justify crudely, and left-aligns on the web
  ([justified text](https://practicaltypography.com/justified-text.html)). Lines should hold 45 to
  90 characters ([line length](https://practicaltypography.com/line-length.html)).
- At 402 px with 17 px text, a line holds about 40 to 45 characters, the bottom of that range. Fewer
  gaps per line means wider gaps, so rivers are likelier on the phone than on desktop (judgement).
- **CSS support**
  - `hyphens: auto` needs the page's `lang`, which [index.html](/packages/web/index.html) sets to
    `en`. Safari still needs its `-webkit-` prefix ([caniuse](https://caniuse.com/css-hyphens)).
  - `text-justify` is not supported in Safari at all
    ([caniuse](https://caniuse.com/css-text-justify)).
  - `text-wrap: pretty` is in Safari 26 and Chrome 117, not Firefox. It balances the lines but does
    not yet prevent rivers in WebKit
    ([WebKit blog](https://webkit.org/blog/16547/better-typography-with-text-wrap-pretty/)).
- **Code spans and links** are long words that cannot break. In a justified line they stretch the
  gaps of the line before them, and hyphenation must stay off inside them (judgement).

### Text size on desktop

- **WCAG 2.2 SC 1.4.4 Resize Text (AA)** requires text to reach 200% with zoom. Failure F94 rules
  out text sized in viewport units alone
  ([resize text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html)). MDN's advice for
  `clamp()` is rem bounds, with the maximum at least twice the minimum
  ([clamp](https://developer.mozilla.org/en-US/docs/Web/CSS/clamp)).
- **Reference sizes**
  - GOV.UK's current scale sets body text to 19 px on both phones and desktops
    ([type scale](https://design-system.service.gov.uk/styles/type-scale/)).
  - Apple's default body is 17 pt on iOS and 13 pt on macOS
    ([typography](https://developer.apple.com/design/human-interface-guidelines/typography)).
- **The user's 120% desktop zoom** turns today's 16 px into 19.2 px, close to GOV.UK's 19 px.
- **CSS `zoom`** is supported everywhere, in Firefox since 126. It changes layout and compounds when
  nested, and it can throw off code that measures positions, such as dragging
  ([zoom](https://developer.mozilla.org/en-US/docs/Web/CSS/zoom),
  [Chrome 128](https://developer.chrome.com/release-notes/128)).
- **The `pointer` media feature** tests only the primary pointer, so it cannot tell a laptop with a
  touch screen apart (judgement). Primer advises against changing the interface on it alone
  ([responsive](https://primer.style/product/getting-started/foundations/responsive)).

### Reordering by dragging

Registry data read on 2026-10-12:

| Library                        | Version                   | Size, minified and gzipped | Keyboard and screen reader                                    | Animates the other items | Touch                    |
| ------------------------------ | ------------------------- | -------------------------- | ------------------------------------------------------------- | ------------------------ | ------------------------ |
| `@dnd-kit/react`               | 0.5.0, June 2026, pre-1.0 | about 33 kB                | keyboard sensor, live regions                                 | yes                      | press delay configurable |
| `@dnd-kit/core` and `sortable` | December 2024, "legacy"   | about 18 kB                | yes                                                           | yes                      | yes                      |
| Pragmatic drag and drop        | 4.0.0, September 2026     | about 4.7 kB               | none: its guidelines recommend menu actions and a live region | no                       | native drag and drop     |
| Motion `Reorder`               | 14.1.0                    | about 48 kB                | not documented                                                | yes, the smoothest       | pointer events           |
| React Aria `useDragAndDrop`    | 1.22.1                    | large package              | the most complete                                             | drop indicators only     | native                   |

Sources: [dnd-kit](https://github.com/clauderic/dnd-kit),
[sortable state](https://dndkit.com/react/guides/sortable-state-management),
[sensors](https://dndkit.com/react/guides/sensors),
[Pragmatic](https://github.com/atlassian/pragmatic-drag-and-drop),
[its accessibility guidelines](https://atlassian.design/components/pragmatic-drag-and-drop/accessibility-guidelines),
[Motion](https://motion.dev/docs/react-reorder), [React Aria](https://react-aria.adobe.com/dnd).

- **Native drag and drop on the phone**: iPhones support HTML drag and drop only since iOS 15. It
  starts on a long press, which competes with text selection and scrolling
  ([caniuse](https://caniuse.com/dragndrop)).
- **Without a library**
  - The FLIP technique animates a move by measuring before and after
    ([FLIP](https://aerotwist.com/blog/flip-your-animations/)).
  - View Transitions are in Safari 18 and Firefox 144
    ([caniuse](https://caniuse.com/view-transitions)).
  - React 19.3's `<ViewTransition>` animates updates made inside `startTransition`. It does not
    honour reduced motion by itself
    ([ViewTransition](https://react.dev/reference/react/ViewTransition)).
  - These animate a move once it is made, such as after a drop or a "Move up". They do not animate
    the item following the finger (judgement).

### Scroll position and navigation in a page

- **Restoring the scroll position**
  - With `history.scrollRestoration = "auto"`, the browser restores the scroll position on Back as
    soon as the page changes, which is before an app's data has loaded
    ([scrollRestoration](https://developer.mozilla.org/en-US/docs/Web/API/History/scrollRestoration)).
  - The usual fix is `manual`: save the position in the history entry with `replaceState` before
    leaving, and restore it once the page has drawn.
  - WebKit throws after 100 `pushState` or `replaceState` calls in 30 seconds, so saving on every
    scroll needs throttling ([WebKit bug](https://bugs.webkit.org/show_bug.cgi?id=156115)).
  - React Router keeps the positions in `sessionStorage`, keyed by history entry or by path
    ([ScrollRestoration](https://reactrouter.com/api/components/ScrollRestoration)).
  - The Navigation API restores the position after an intercepted navigation's data arrives. It is
    in Safari 26.2 and Firefox 147, too recent to rely on alone
    ([Navigation API](https://developer.chrome.com/docs/web-platform/navigation-api),
    [caniuse](https://caniuse.com/mdn-api_navigation)).
- **Jumping within a page**
  - `scroll-margin-top` keeps a target clear of a sticky header
    ([scroll-margin-top](https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-margin-top)).
  - `scrollIntoView` does not move focus, so a "next" button must also focus its target
    ([scrollIntoView](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView)).
- **Breadcrumbs are for a page's parents** in a hierarchy, not for a position within a page
  ([APG breadcrumb](https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/)).
  - An in-page index is a table of contents: a `nav` with `aria-current="location"` on the current
    item
    ([aria-current](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-current)).
  - The proposal's "breadcrumbs at the top" for questions is this kind of navigation.

### Highlighting while commenting

- **On iOS, `interactive-widget` is not supported**, so the keyboard covers the page without
  resizing it
  ([caniuse](https://caniuse.com/mdn-html_elements_meta_name_viewport_interactive-widget)).
  `window.visualViewport` measures what stays visible.
- **The CSS Custom Highlight API** marks a range without changing the page's DOM. It is in Safari
  17.2 and Firefox 140
  ([Custom Highlight API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API)).
  - For whole blocks, as the review selects, a class on the block is simpler (judgement).

### UI rules that can be checked

- **The rules design systems write**
  - Use a component when one exists, and use tokens rather than raw values: Atlassian's
    [spacing](https://atlassian.design/foundations/spacing), and the Astryx README.
  - Name width classes by intent: Primer's narrow is under 768 px and regular from 768
    ([layout](https://primer.style/product/getting-started/foundations/layout)). Android's compact,
    medium, and expanded classes split at 600, 840, and 1200 dp, and Android says never to choose a
    layout by device type
    ([window size classes](https://developer.android.com/develop/ui/compose/layouts/adaptive/use-window-size-classes)).
  - Use a modal only for irreversible actions or for input needed to continue, one at a time
    ([NN/g](https://www.nngroup.com/articles/modal-nonmodal-dialog/),
    [Atlassian](https://atlassian.design/components/modal-dialog/usage)).
  - Never put content that has its own URL in a dialog
    ([Primer dialog](https://primer.style/product/components/dialog/guidelines)).
  - Show status inline next to its control, and use a toast only for confirmations that carry no
    action ([Pajamas](https://design.gitlab.com/patterns/saving-and-feedback)).
  - Give every bottom sheet a visible close button, and let Back close it
    ([NN/g bottom sheets](https://www.nngroup.com/articles/bottom-sheet/)).
  - Keep state in the URL ([Vercel](https://vercel.com/design/guidelines)).
- **Adaptive layouts**
  - In a list-detail layout, both panes show side by side when wide. When narrow, the detail
    replaces the list and Back returns to it.
  - A supporting pane goes below the content or into a bottom sheet when narrow
    ([canonical layouts](https://developer.android.com/develop/ui/compose/layouts/adaptive/canonical-layouts)).
  - Primer turns a narrow dialog with input fields into a full-screen view.
- **How the rules are checked**
  - **Lint**: oxlint has `react/forbid-elements`, which bans a raw element and names its replacement
    ([forbid-elements](https://oxc.rs/docs/guide/usage/linter/rules/react/forbid-elements)). It also
    has `react/forbid-dom-props` and `react/forbid-component-props`, which ban `style` and
    `className`.
  - **StyleX's lint plugin** runs through oxlint's JavaScript plugins, which are in alpha
    ([JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)). Its `valid-styles` rule
    can limit values to tokens
    ([StyleX lint](https://stylexjs.com/docs/api/configuration/eslint-plugin/)).
    [vite.config.ts](/vite.config.ts) already loads JavaScript plugins.
  - **Layout checks at fixed sizes**, like the app's
    [layout test](/packages/web/src/__browser__/layout.test.tsx), are deterministic.
  - **Accessibility scans** with axe-core catch labels, contrast, and duplicate ids, but not
    everything ([accessibility testing](https://playwright.dev/docs/accessibility-testing)).
  - **Screenshot comparisons** depend on the operating system, the browser, and the fonts, and
    Vitest advises against making the reference images on developer machines
    ([Playwright](https://playwright.dev/docs/test-snapshots),
    [Vitest](https://vitest.dev/guide/browser/visual-regression-testing)).
- **Guidance for agents writing UI** follows the same loop: a fixed set of components and tokens
  given upfront, a short checklist with numbers, and a review of screenshots the agent takes of its
  own work. Examples are Anthropic's
  [frontend-design skill](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md)
  and Vercel's
  [web interface guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md).

## The code

### Important reads

- [`styles.css`](/packages/web/src/styles.css): 533 lines of global classes (`.page`, `.row`,
  `.band`, `.option`, `.block`, `.commit-bar`, ...), every size in px.
  - `.page` is 17 px on a phone and 16 px from 768 px wide, in a column at most 720 px wide: text is
    smaller on desktop than on the phone.
  - No StyleX is written anywhere in [`packages/web/src`](/packages/web/src/).
- [`Shell.tsx`](/packages/web/src/Shell.tsx)
  - The shell is `AppShell` with a `SideNav`. Its header is a `SideNavHeading`: "Uraeda", with the
    repository as subheading and `QuickAdd` as `headerEndContent`.
  - Neither the heading nor the subheading is a link.
- [`QuickAdd.tsx`](/packages/web/src/QuickAdd.tsx)
  - ＋ opens a `BottomSheet`.
  - Once a line is added, a `role="status"` text, "Added to Next, not committed", is placed
    beside ＋ in the navigation's header, which is also the phone's top bar. It stays there
    until ＋ is tapped again.
  - On the phone, the text fills the bar between the title and the menu button, and ＋ keeps its
    focus ring after the sheet closes (screenshots in this session).
- [`routes.tsx`](/packages/web/src/routes.tsx) and [`App.tsx`](/packages/web/src/App.tsx)
  - Navigation uses `pushState` with no state, and `navigate()` always scrolls to the top.
  - Back fires `popstate`, and the page asks for its data again behind a `Suspense` fallback,
    "Loading…". The page is one line tall when the browser restores the scroll position, so the
    position is lost.
- [`data.ts`](/packages/web/src/data.ts): every page asks for its records by id and keeps them live.
- **A missing file loads forever.**
  - The server leaves out the ids it cannot read
    ([sources.ts](/packages/server/src/fate/sources.ts), `each`). The client then asks again without
    end, and the page shows "Loading…" forever instead of "No file".
  - Observed on a stale link to a merged feature's `proposal.md`, whose folder is now a record.
- [`Home.tsx`](/packages/web/src/Home.tsx): a priority's row is a plain `div` with a Draft or Start
  button. Its text does nothing, and "Start" opens the editor rather than starting.
- [`EditorPage.tsx`](/packages/web/src/EditorPage.tsx)
  - Drafts and proposals open as a raw `TextArea`, and "Preview" swaps it for the drawn blocks.
  - The text area grows to its text, so a long draft is one tall field.
- [`draft.rs`](/crates/core/src/actions/draft.rs)
  - A draft is the proposal template with the line as its title, placeholders included.
  - [`start.rs`](/crates/core/src/actions/start.rs) refuses a draft that still holds the
    placeholders, or whose `## What` or `## Why` is empty (`unwritten`).
  - [`SKILL.md`](/skills/uraeda/SKILL.md) says a draft is made "from the proposal template with the
    line as its title", and `ura draft` follows it.
- [`PrioritiesPage.tsx`](/packages/web/src/PrioritiesPage.tsx)
  - Each row has a drag handle driven by hand-written pointer events. Nothing moves during the drag,
    and the line jumps to its place on release.
  - Each row's ⋯ button opens a `BottomSheet` of full-width buttons: Move up and down, Move to each
    section, Edit (a text area inside the sheet), and Delete, with no confirmation and no undo.
  - Sections are small uppercase labels with no count, Now looks like Later, and lines are added
    only through ＋.
  - On desktop, the sheet is 640 px wide, and its title runs under its handle (screenshots in this
    session).
- [`RoundPage.tsx`](/packages/web/src/RoundPage.tsx) and
  [`Question.tsx`](/packages/web/src/Question.tsx)
  - The page has a 4 px sticky progress bar and "N of M answered", with every question in full.
  - The only navigation is the list of blank questions above Submit, at the end of the page, as
    `#Q7` anchors.
- [`ReviewPage.tsx`](/packages/web/src/ReviewPage.tsx) and
  [`Blocks.tsx`](/packages/web/src/Blocks.tsx)
  - Tapping a block sets `aria-selected`, which `.block[aria-selected="true"]` tints, and opens a
    `BottomSheet` without a scrim for the comment.
  - The tint is `--color-accent-muted`, nearly the gray of the bands.
  - The sheet covers about 62% of the screen, and the iOS keyboard covers more. The block, usually
    tapped in the lower half, ends up under them, and nothing scrolls it into view.
  - Not reproduced on a phone: no spec waits for review in this repository.
- [`layout.test.tsx`](/packages/web/src/__browser__/layout.test.tsx) checks, in WebKit at 402 × 874
  only:
  - no text is cut and nothing scrolls sideways;
  - body text is at least 16 px;
  - question, option, story, and scenario text starts within 50 px of the left edge.
  - Nothing is checked at desktop size.
- [The web UI's record](../done/2026-10-11-web-ui.md) lists the Astryx components its spec named.
  `Outline` for headings, `Toast` for saves, and `Heading`, `Text`, and `List` for documents were
  not used: the pages use the global classes instead.
- **Recent commits**: the files above were last changed by the web UI's fixes and by
  [finish feature](../done/2026-10-12-finish-feature.md), which added finished features to the
  feature page (`git log -- packages/web`).

### The proposal's path and existing actions

- **Desktop text**: every page's text comes from `.page` and the classes under it, in px. Astryx
  controls use their own rem text and px heights. Raising the size touches both.
- **Home task → task view**
  - Today the text does nothing: Draft creates a draft and opens the editor, and Start opens the
    editor.
  - A task view meets every action on a line: edit its text, move it, delete it, draft it, open or
    start its draft.
  - It also meets the line's id. Ids are positions, `next-2`, which change when a line above moves
    ([priorities.rs](/crates/core/src/files/priorities.rs)), so a task view's address cannot be the
    id alone.
- **Drafting**: Draft writes the template with its placeholders. The human deletes them by hand
  before `ura start` accepts the draft. An empty What or Why stays refused.
- **Questions**
  - The page is one long column, 12 questions with all their options.
  - Leaving it through a link, like the discovery or the nav, then coming back with Back or the nav,
    lands at the top.
  - Answers are saved as typed, so nothing is lost, only the position.
- **Justified paragraphs** meet the document blocks ([Blocks.tsx](/packages/web/src/Blocks.tsx)),
  the questions' context, and the options, which use the same blocks. Lists, tables, code, and the
  answer line are not paragraphs.
- **Review highlight**: tapping a block opens the sheet, and tapping another while it is open
  extends the selection. Cancel clears the selection. Editing a pending comment opens the same sheet
  with no selection.
- **Top bar**
  - On the phone, the bar is AppShell's mobile bar, showing the side nav's header.
  - On desktop, ＋ and the message sit in the side nav's header.
  - The theme switch is the side nav's footer, so on the phone it shows only in the drawer.
- **Priorities**
  - Each change is written at once, uncommitted, and the bar commits or discards them all.
  - Moving with nested lines, editing with links, and a change made elsewhere are handled by the
    core ([spec, US7](../done/2026-10-11-web-ui.md)).
  - An inline add, an edit in place, and an animated drag all call the same mutations.

### Likely changes

Under every option:

- [`packages/web/src/`](/packages/web/src/): every page and `styles.css`.
- [`packages/web/src/__browser__/`](/packages/web/src/__browser__/): checks at desktop size, and the
  new rules' checks.
- [`specs/decisions/`](/specs/decisions/): the UI decisions, new files.

With some options:

- [`vite.config.ts`](/vite.config.ts): the lint rules of a UI decision, with option A of
  [how the UI is built](#how-the-ui-is-built).
- [`packages/web/package.json`](/packages/web/package.json)
  - Astryx 0.6.8, with [scope](#extra-findings).
  - A drag library, with option A of [reordering](#reordering-priorities).
  - Axe, with option A of [checks](#how-the-rules-are-checked).
- [`routes.tsx`](/packages/web/src/routes.tsx): the scroll position saved per history entry, and a
  route for the task view.
- [`draft.rs`](/crates/core/src/actions/draft.rs), [`SKILL.md`](/skills/uraeda/SKILL.md), and
  `ura draft`: with option A of [drafts](#what-a-new-draft-holds). Together, as the
  [CLI decision](../decisions/cli.md) requires.
- [`priorities.rs`](/crates/core/src/files/priorities.rs) and the binding: only if the task view
  needs a stable id for a line.
- [`sources.ts`](/packages/server/src/fate/sources.ts): with [scope](#extra-findings), so a missing
  file answers "not found" instead of looping.

**No feature in flight touches the same code.** The only other open branch,
`2026-10-12-finish-feature`, is merged into main and merged into this branch.

## The proposal

### "Breadcrumbs" for questions

The proposal asks for breadcrumbs at the top of the round, to jump to the next unanswered question
and to move through the tree of questions and follow-ups. Breadcrumbs show a page's parents, not a
position within a page ([APG](https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/)). What is
described is an index of the questions with their state, plus "next unanswered": Astryx's `Outline`
and a button. Astryx's `Breadcrumbs` fit the feature and file pages instead, which today show a
plain "folder › file" line.

### The sentence cut short

"When navigating out and back to the questions page, it put me back at the" ends there. The
judgement here is that it means the top of the page: the code always scrolls to the top on a
navigation, and loses the position on Back ([the code](#important-reads)).

### What a "task" is on home

Home lists the human's gates, the agents' work, the Now and Next priority lines, and the Done
features. The features are already links. "Tasks" with "all the options" and drafts with markdown
point to the priority lines: their actions are scattered between home's buttons, the priorities
page's sheet, and the editor.

### Justified text against the reading layout

The proposal asks for justified paragraphs because they look better on the phone. Every source read
says the opposite risk is highest there:

- WCAG's AAA criterion asks for text not to be justified, through a mechanism.
- Safari cannot tune justification.
- Narrow lines make the widest gaps.

Not a conflict with a rule: the app claims no AAA, and no decision covers type.

### Decisions, and how many

The proposal wants "a few UI-related decisions" that make the right approach clear. Nothing says
what they cover. The research points to four subjects:

- how the UI is built: components, styles, and tokens;
- how it adapts to a phone and a desktop;
- how it behaves: overlays, feedback, editing, and state;
- how agents check their work before handing it over.

### Scope beyond the list

Three problems found while reading the code are outside the proposal's list, on the same pages:

- a missing file loads forever;
- the theme switch is only in the phone's drawer;
- Astryx 0.6.7 loses a page's state when the window crosses 768 px, fixed in 0.6.8.

"Look and feel pass", a separate line in Next, would cover visuals. This proposal says "solely
focused on functionality".

## Approaches

Criteria come from the [proposal](proposal.md), the [constitution](../CONSTITUTION.md), and the
[stack decision](../decisions/stack.md):

- **Usable on the phone and on desktop**: the proposal.
- **Simple and explicit code**: principle VI.
- **Checkable by a tool**: principle V, and the proposal's wish to avoid half-baked views.
- **Astryx and React**: the stack decision.

### How the UI is built

What a UI decision says about components and styles. Relies on [Astryx](#astryx-067),
[checkable rules](#ui-rules-that-can-be-checked), and [the code](#important-reads).

| Option                                                                                                                                 | Consistency                           | Checkable                                                              | Cost now                                             |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------- |
| A. Astryx components wherever one exists; the app's own styles in StyleX with Astryx tokens only; no global stylesheet but the theme's | one vocabulary, scales with the theme | lint: banned raw elements and `style`, StyleX values limited to tokens | every page's styles move from `styles.css` to StyleX |
| B. A. for components, but the reading layout's classes kept in one global stylesheet, in tokens instead of px                          | two styling systems                   | lint for components only                                               | the classes are rewritten in tokens                  |
| C. Written guidelines only, no lint                                                                                                    | depends on each agent                 | none: what happened with the web UI                                    | none                                                 |

### Adapting to the phone and the desktop

What changes between a phone and a desktop. Relies on [Astryx's overlays](#astryx-067),
[detail views](#detail-views), and [adaptive layouts](#ui-rules-that-can-be-checked).

| Option                                                                                                                                                                              | Desktop                                      | Phone    | Cost                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | -------- | --------------------------------------- |
| A. Two width classes at Astryx's 768 px: on wide screens, a detail opens in a side pane next to its list, menus are popovers, and forms are dialogs; on the phone, pages and sheets | uses the width, like Todoist and Jira        | as today | a pane layout, and a switch per overlay |
| B. One column everywhere, wider and larger on desktop; bottom sheets become centred dialogs on wide screens                                                                         | one reading column, no side pane             | as today | small                                   |
| C. As today: the same layout and sheets everywhere                                                                                                                                  | a 640 px sheet from the bottom of the screen | as today | none                                    |

### How the UI behaves

What a UI decision says about overlays, feedback, editing, and state. Relies on
[checkable rules](#ui-rules-that-can-be-checked), [confirmations](#quick-capture-and-confirmations),
and [the proposal's path](#the-proposals-path-and-existing-actions).

| Option                                                                                                                                                                                                                            | Answers the proposal's problems                                  | Accessibility                       | Cost  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------- | ----- |
| A. Rules: whole rows tappable, small edits in place, modals only for irreversible actions, close and Back on every overlay, status inline, short toasts with Undo for unseen results, Back keeps the position, nothing hover-only | each one: the modal edit, the top bar message, the lost position | toasts are timed (Primer's concern) | small |
| B. A, without toasts                                                                                                                                                                                                              | each one, but ＋ from another page has nowhere to confirm        | the most accessible                 | small |
| C. No behaviour decision                                                                                                                                                                                                          | settled again per view                                           | depends                             | none  |

### How the rules are checked

What runs to enforce the decisions. Relies on [checkable rules](#ui-rules-that-can-be-checked).

| Option                                                                                                                                                                                                 | Catches                                                      | Flakiness                                  | Fits the toolchain decision      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------ | -------------------------------- |
| A. Lint, layout checks at a phone size and a desktop size, axe in both themes, all in `vp run ready`; plus screenshots of every changed view the agent takes and reviews, attached to the pull request | rules, geometry, accessibility, and looks seen by a reviewer | none in the checks                         | yes                              |
| B. A, plus pixel comparisons of screenshots in CI                                                                                                                                                      | also any visual change                                       | fonts and platforms; references made in CI | CI only, allowed for slow checks |
| C. Lint and the existing phone layout test only                                                                                                                                                        | rules                                                        | none                                       | yes                              |

### Desktop text size

How large text is on a desktop. Relies on [text size](#text-size-on-desktop) and
[Astryx sizes](#astryx-067).

| Option                                                                                                                                                            | Matches the 120% zoom | Controls scale | Risk                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | -------------- | -------------------------------- |
| A. Sizes in rem; body 17 px on the phone and 19 px from 1024 px wide, through Astryx's `typography.scale` and an adaptation; column capped at about 70 characters | text yes, controls no | no             | none                             |
| B. CSS `zoom: 1.2` on the page from 1024 px wide                                                                                                                  | exactly               | yes            | breaks position math in dragging |
| C. As A, plus element heights and spacing raised through Astryx's adaptation tokens                                                                               | close                 | yes            | more tokens to tune              |

### Justifying paragraphs

Whether paragraphs are justified. Relies on [justified text](#justified-text).

| Option                                                                                                                      | What the proposal asks | Readability                | WCAG      |
| --------------------------------------------------------------------------------------------------------------------------- | ---------------------- | -------------------------- | --------- |
| A. Justified paragraphs everywhere, with hyphenation, the last line left-aligned, never in lists, code, tables, or headings | yes                    | rivers likely on the phone | AA kept   |
| B. Justified from 768 px wide only, left-aligned on the phone with `text-wrap: pretty`                                      | no, for the phone      | safe                       | AA kept   |
| C. Left-aligned with `text-wrap: pretty` everywhere                                                                         | no                     | the advice of every source | AAA-ready |

### The task view

What tapping a priority line opens. Relies on [detail views](#detail-views) and
[the proposal's path](#the-proposals-path-and-existing-actions).

| Option                                                                                                                                                                                        | Actions in one place | Drafts with markdown | Cost                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | -------------------- | --------------------------------- |
| A. A task view for a line, its own address: the line editable, its section, move and delete, Draft, and the draft drawn with Edit and Start; a page on the phone, a side pane on wide screens | yes                  | yes                  | a view, a route, a stable address |
| B. The line expands in place on home, with its actions                                                                                                                                        | partly               | no                   | small                             |
| C. Tapping opens the draft's editor, or drafts the line first                                                                                                                                 | no                   | through the editor   | smallest                          |

### Editing priorities

How a line is edited and added on the priorities page. Relies on
[prioritized lists](#prioritized-lists).

| Option                                                                                                                                              | Taps to edit | Desktop      | Cost                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------ | ------------------------ |
| A. Tap the text to edit it in place; an "Add" row at the end of each section; the other actions in an adaptive ⋯ menu; the task view from a chevron | 1            | popover menu | medium                   |
| B. Tap the line to open the task view, where everything happens                                                                                     | 2            | side pane    | small with the task view |
| C. As today, with the sheet replaced by an adaptive menu                                                                                            | 2            | popover menu | small                    |

### Reordering priorities

How a line is dragged. Relies on [reordering](#reordering-by-dragging).

| Option                                                                           | Animation                   | Phone                           | Keyboard and screen reader | Dependency      |
| -------------------------------------------------------------------------------- | --------------------------- | ------------------------------- | -------------------------- | --------------- |
| A. `@dnd-kit/react`, with the menu's Move actions kept                           | items make room as you drag | press delay, no scroll conflict | yes                        | 33 kB, pre-1.0  |
| B. The hand-written pointer drag kept, with FLIP animations and a drop indicator | after the drop only         | as today                        | menu only                  | none, more code |
| C. No dragging: Move up, Move down, and Move to, animated with view transitions  | each move                   | taps only                       | yes                        | none            |

### What a new draft holds

What Draft writes from a priority line. Relies on [the code](#important-reads).

| Option                                                                    | Placeholders to delete | Skill and CLI change | `ura start`'s guard                |
| ------------------------------------------------------------------------- | ---------------------- | -------------------- | ---------------------------------- |
| A. The line as the title, and the template's headings with empty sections | none                   | yes, both            | still refuses an empty What or Why |
| B. As A, with the line's text also in What                                | none                   | yes, both            | What is never empty                |
| C. As today; the editor shows placeholder lines dimmed                    | still there            | no                   | as today                           |

### Navigating a round

How the human moves through questions. Relies on [long forms](#long-forms-and-review-queues) and
[navigation within a page](#scroll-position-and-navigation-in-a-page).

| Option                                                                                                                                                                                           | Next unanswered | Index of the questions | Space taken on the phone |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- | ---------------------- | ------------------------ |
| A. A sticky bar: "7 of 12 answered", "Next unanswered", and an index button; the index is `Outline` with each question's state, in a sheet on the phone and a sticky side column on wide screens | yes             | yes, follow-ups nested | one 48 px bar            |
| B. The sticky bar with "Next unanswered" only                                                                                                                                                    | yes             | no                     | one bar                  |
| C. An `Outline` at the top of the page, not sticky                                                                                                                                               | no              | yes                    | none while reading       |

### Coming back to a round

Where a round opens when the human comes back to it, not by Back. Relies on
[scroll position](#scroll-position-and-navigation-in-a-page).

| Option                                                                   | Fits answering in several sittings | Works across devices |
| ------------------------------------------------------------------------ | ---------------------------------- | -------------------- |
| A. Where it was left on this browser, else the first unanswered question | yes                                | falls back           |
| B. The first unanswered question, always                                 | yes                                | yes                  |
| C. The top                                                               | no                                 | yes                  |

### Extra findings

Whether the problems found outside the list join this feature. Relies on
[scope beyond the list](#scope-beyond-the-list).

| Option                                | Fixed when                       | Size     |
| ------------------------------------- | -------------------------------- | -------- |
| A. All three join this feature        | now, on the pages being reworked | small    |
| B. Only the missing file's loop       | partly now                       | smallest |
| C. None; each becomes a priority line | later                            | none     |

### Needs no choice

- **Home link**: `headingHref` on the navigation's heading makes "Uraeda" a link home, as the
  proposal asks.
- **The confirmation of ＋**: the text placed in the top bar goes. The result shows where the line
  lands, or in a toast where it does not.
- **Undo for moves and edits**: each change is uncommitted, and the bar's Discard undoes them all.
  An undo per change is a convenience the interaction decision can name. Deletion is undone the same
  way.
- **Previous and next in the task view**: it follows from the task view, in its spec.
- **Keyboard shortcuts** like GitLab's `n` and `p`: Astryx has `useHotkeys`, and they follow from
  the navigation chosen.
- **The highlight while commenting** is a bug with a clear intent. Whatever the overlays become, the
  block stays tinted in a colour distinct from the bands, it is scrolled into view above the
  composer, and the composer quotes its lines.
- **Back restores the position**: a bug with a clear intent, fixed by saving the position in the
  history entry and restoring it once the page has drawn, and by keeping the page drawn while its
  data reloads.
- **Languages, time zones, and data**: the feature changes no stored data and no dates. The UI is in
  English only, as the web UI is.
- **Security**: no new endpoint. A drag library or axe runs in the browser or in tests only.

## Not checked

- No spec waits for review in this repository, so the review highlight was read in the code, not
  reproduced on a phone.
- The Typeform help center returned 403, and Material 3's pages and Apple's sheet guidelines did not
  render.
- Linear's issue view and its mobile app are not documented in pages that could be read. Linear's
  undo toasts were seen only in search snippets.
- No official page documents a "jump to unanswered" feature in Qualtrics or other form tools, so its
  absence is not proven.
- OpenAI's frontend guidance, Atlassian's token lint rule, and the reports on screenshot test
  flakiness were read only as search summaries.
