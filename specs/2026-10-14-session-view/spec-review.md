---
verdict: approved
commit: 4de36e0
---

# Review: Spec, Dedicated session view

## C1: Lines 15–17, under "Spec: Dedicated session view"

> > - **One changed decision, [UI layout](../decisions/ui-layout.md).** A session, a feature's or a
> >   chat, becomes a page of its own at both widths, never a pane. The sidebar's rows are kept
> >   short: features by their slug, with progress and status as icons and counts.

Generally this UI layout decision should be more concepts-based and less “hard rules”.

Goal #1 is always readability and clarity for the user. Some features will live well in a pane,
others in a dedicated page.
