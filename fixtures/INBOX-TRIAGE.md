---
status: awaiting-human
---

# Inbox triage

> [!IMPORTANT]
>
> 3 questions on 5 notes, about 6 minutes.
>
> - Three UI notes may go together into the draft Look and feel pass
> - "Draft to proposal on mobile went 404" may be a bug

## Context

The inbox holds 11 notes: this triage covers the 5 under UI. I read the web UI's code, the
priorities, and the drafts. The other notes wait for a later triage.

## Q1: What to do with the notes about how the UI looks

"In failures the `x` is not centered in the circle", "Icons are blurry on retina screens", and
"Text input feels laggy on the sessions page" are small fixes to the look and feel of the web UI.
The draft Look and feel pass lists fixes of the same kind.

Why it matters: grouped in one draft, they are fixed in one feature instead of three.

- **A (recommended). Add the three notes to the draft Look and feel pass.**
  - [pro] one feature fixes them all.
  - [con] the draft grows.
  - Why recommended: they touch the same components.
- **B. Move the three notes to Later in the priorities.**
  - [pro] each stays a line of its own.
  - [con] three small features instead of one.

**Answer:**

## Q2: What to do with "Draft to proposal on mobile went 404"

Starting a draft from a phone opens a page that does not exist. It happens on every phone.

Why it matters: a bug blocks starting features from a phone until it is fixed.

- **A (recommended). Start a bug, `draft-404`.**
  - [pro] it gets a root cause and a test.
  - [con] a branch to review.
  - Why recommended: it is behaviour that differs from what users expect.
- **B. Keep it in the inbox.**
  - [pro] nothing to do now.
  - [con] the bug stays.

**Answer:**

## Q3: What to do with "Opening a session with 2,000 messages takes 4 s"

An agent found it while building the session view. The session view renders every message at once.

Why it matters: long sessions get slower as agents run longer.

- **A (recommended). Move it to Next in the priorities.**
  - [pro] it is fixed soon.
  - [con] Next grows by one.
  - Why recommended: sessions grow with every run.
- **B. Delete it.**
  - [pro] the inbox gets shorter.
  - [con] the problem is forgotten.

**Answer:**

**Notes:**
