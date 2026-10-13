---
status: awaiting-human
---

# Clarifications, round 01: Image attachments

> [!IMPORTANT]
>
> 8 questions on image attachments, about 30 minutes.
>
> - One choice lasts beyond this feature: committing images to the repository, next to the files
>   they illustrate. The constitution asks for plain text in git, so it becomes a decision. Its
>   follow-up sets where images go and what happens to them when a feature finishes.
> - How chat images reach the agent is separate: chats are not in git, so they stay out of it.
> - Three gaps in the proposal: paste is not mentioned though every product has it, "in the page"
>   needs a rule on pages with several fields, and drafts, bug reports, answers, and notes are not
>   named.
> - Whether agents must open the images a proposal or review links to decides if screenshots are
>   seen at all during the workflow's steps.
> - Sixteen points are settled without you, at the end: check the size limit, the image types, and
>   the drafts that turn into folders.

## Context

The [proposal](proposal.md) asks for images in chats, proposals, and reviews, by drag and drop in
the page and by a dedicated button, since screenshots help explain things.

Today, no part of Uraeda handles an image. The chat [composer](/packages/web/src/Composer.tsx) sends
text only, as a plain string to Claude Code's stdin
([runner](/packages/server/src/runner/claude.ts)). Proposals are written in a plain text area
([editor](/packages/web/src/EditorPage.tsx)), and review comments in a
[comment form](/packages/web/src/CommentForm.tsx), both saved as markdown by the core, which writes
text only and commits only the files each action names. The server cannot serve an image, and the
core's document tree, which the UI draws, has no image node. Astryx already has the parts: a
composer that takes pasted and dropped files, a file button, thumbnails, and a lightbox.

The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Q1: Where are images attached to proposals, reviews, and answers stored?

GitHub and GitLab host attachments outside the repository, behind unguessable URLs, while Obsidian,
VS Code, Hugo, and Docusaurus keep them as files next to the text, which GitHub renders by relative
path. The [constitution](../CONSTITUTION.md#ii-git-and-plain-text-first) asks for workflow state as
plain text in git, with exceptions justified in a decision, and for durable state recoverable from
the repository alone. Chats are Q2. More in
[discovery](discovery-01.md#storing-images-of-workflow-files).

Why it matters: it decides whether a proposal's screenshot reaches another machine, another agent,
and GitHub, and how the repository grows.

- **A (recommended). Commit each image to the repository, as a regular file next to the markdown
  file that links to it, in the same commit, and record this exception to plain text in a new
  "attachments" decision.**
  - [pro] the proposal and its screenshots read the same in Uraeda, Obsidian, GitHub, and any agent,
    on any machine.
  - [con] every image stays in git history forever, even once removed: a screenshot of a secret
    needs a history rewrite.
  - Why recommended: it is the only option that keeps the workflow readable without Uraeda and
    recoverable from git, as the constitution asks.
- **B. Store images in Uraeda's data folder, outside git, and link them from the markdown file.**
  - [pro] the repository stays plain text.
  - [con] the links break on every other machine and on GitHub, which conflicts with the
    constitution's principles II and III.
- **C. Commit images through Git LFS.**
  - [pro] the repository keeps pointers only.
  - [con] every clone and CI needs LFS installed and an LFS server; without it, the images are
    missing.

**Answer:**

### Q1.A: Where in the repository do images go, and what happens to them when the feature finishes?

Only if you picked A or C in Q1. Obsidian saves attachments in the vault folder, the note's folder,
or a subfolder under it; Hugo and Docusaurus next to the page. Finishing a feature replaces its
folder with one record in `specs/done/` and deletes the folder, git history keeping it
([finish](/skills/uraeda/references/finish.md)); the [UI checks](../decisions/ui-checks.md) decision
already lets a feature's `screenshots/` go with it. More in
[discovery](discovery-01.md#folder-and-names) and
[the end of a feature](discovery-01.md#images-at-the-end-of-a-feature).

Why it matters: an agent without Uraeda must find the images, the skill's folder layout changes, and
it decides whether the default branch keeps growing with every feature's screenshots.

- **A (recommended). In an `images/` folder inside the feature's or the draft's folder, deleted with
  the folder when the feature finishes: the record stays text only, and git history keeps the
  images.**
  - [pro] images sit next to the files they explain without crowding them, move with the folder, and
    leave the default branch with it.
  - [con] reading a finished feature's screenshot needs `git log`.
  - Why recommended: screenshots explain a request while it is worked on; the record keeps what was
    decided. It follows `mockups/` and `screenshots/`.
- **B. In the same `images/` folder, but finishing moves the images the record links to into
  `specs/done/<record name>/`, and deletes the rest.**
  - [pro] a record can show a screenshot that explains a decision.
  - [con] a new layout in `specs/done/`, and the default branch grows with every such image.
- **C. In the feature's folder itself, next to `proposal.md`, deleted with the folder.**
  - [pro] no new folder name.
  - [con] images mixed with the workflow files the human and agents scan.
- **D. In one `specs/images/` folder for the whole project, with the feature's slug before each
  name, kept after the feature finishes.**
  - [pro] images outlive their feature.
  - [con] far from the files that link to them, a new top-level folder in `specs/`, and the default
    branch keeps every image.

**Answer:**

## Q2: How does a chat image reach the agent, and where is it kept?

Chats are not workflow state: their messages live in Uraeda's cache, outside the repository
([agents](../decisions/agents.md)). Claude Code takes images inside a message, as base64 blocks, and
keeps them in its transcript across `--resume` (tested on 2.1.296); Codex takes image file paths,
and pi base64 images. More in [discovery](discovery-01.md#images-in-chats).

Why it matters: it decides whether the agent sees the image at once, and whether images survive in
the transcript.

- **A (recommended). Save each image in Uraeda's data folder, next to its cache, and send it inside
  the message, as each agent takes it: base64 for Claude Code, a path for agents that take paths.
  The transcript shows it as a thumbnail.**
  - [pro] the agent sees the image with the message, without a tool call, like in Claude Code
    itself.
  - [con] the image is resent with each later request of the session, costing about 1,500 tokens for
    a full-HD screenshot.
  - Why recommended: it matches how coding agents take images, and keeps the agent's format inside
    its adapter, as the agents decision requires.
- **B. Save each image in the data folder, and write its path in the message, for the agent to open
  with its Read tool.**
  - [pro] one way for every agent, and the image costs tokens only once read.
  - [con] the agent may skip it, and the message shows a file path.
- **C. Commit chat images to the repository, like workflow files' images.**
  - [pro] they survive a lost cache.
  - [con] the repository fills with images of conversations nobody reads again.

**Answer:**

## Q3: Which texts take images?

The proposal names chats, proposals, and reviews. Drafts and bug reports are written in the same
editor as proposals, and answers to questions and round notes are also free text written to a file.
More in [discovery](discovery-01.md#which-texts-take-images).

Why it matters: a screenshot often answers a question best ("like this, not that"), and leaving some
texts out makes the feature feel uneven.

- **A (recommended). Chats, drafts, proposals, bug reports, review comments, answers' comments, and
  round notes.**
  - [pro] every place the human writes free text takes images the same way.
  - [con] answers and notes join the commits that include images.
  - Why recommended: one component does it everywhere, and a human who drops a screenshot on a
    question expects it to work.
- **B. Chats, drafts, proposals, bug reports, and review comments.**
  - [pro] the proposal, plus what shares its editor.
  - [con] no image in answers, where a screenshot can settle a choice.
- **C. Only chats, proposals, and review comments, as written.**
  - [pro] exactly the proposal.
  - [con] the editor accepts images for proposals but not for the drafts that become them.

**Answer:**

## Q4: Do images also come from the clipboard?

The proposal names drag and drop and a button. Every product compared also takes paste, the fastest
path for a screenshot taken with the system's tool, which copies it to the clipboard. More in
[discovery](discovery-01.md#entry-points).

Why it matters: without paste, a screenshot must first be saved as a file, then dropped or picked.

- **A (recommended). The button, drag and drop, and paste.**
  - [pro] matches every product, and the fastest path for screenshots.
  - [con] none found: paste is one more event on the same field.
  - Why recommended: it adds what users expect at almost no cost.
- **B. The button and drag and drop, as proposed.**
  - [pro] exactly the proposal.
  - [con] screenshots copied to the clipboard need saving first.

**Answer:**

## Q5: Where on the page can an image be dropped?

Claude.ai and Claude Code take a drop anywhere in their window; GitHub, GitLab, and Slack take it on
the text field only. A page-wide drop needs a rule on pages with several fields: the review page has
a comment form only once opened, and a question page one comment per question. More in
[discovery](discovery-01.md#drop-target).

Why it matters: a large target is easier to hit, but must never land in a field the human did not
mean.

- **A (recommended). Anywhere on the page. It lands in the field that has focus, or else the page's
  main field: the chat composer, the editor's text area, or, on the review page, a new general
  comment. While a file is dragged over the page, the target field is outlined.**
  - [pro] as easy as in Claude.ai, and the outline shows where the image goes before it is dropped.
  - [con] a page-wide listener, written by hand, since Astryx has none.
  - Why recommended: it is what the proposal asks, and the outline removes the ambiguity.
- **B. Only onto a text field.**
  - [pro] never ambiguous.
  - [con] a smaller target, and the proposal asks for "in the page".

**Answer:**

## Q6: Are images changed before they are saved or sent?

Screenshots are often large PNGs, and phone photos carry metadata such as the place they were taken.
GitLab strips EXIF from JPEG uploads; Obsidian users add a plugin to convert images to WebP. Claude
downscales large images itself. More in [discovery](discovery-01.md#processing-images).

Why it matters: it trades repository size and privacy against a new dependency.

- **A (recommended). Keep images as they are, after checking their type by their first bytes and
  their size.**
  - [pro] no new dependency, and the image is exactly what the human saw.
  - [con] a photo's metadata, such as its location, is committed with it.
  - Why recommended: screenshots, the proposal's use, carry no location, and a new native dependency
    costs more than it saves.
- **B. Re-encode images on the server, with the sharp library: drop metadata and downscale to 2576
  pixels at most.**
  - [pro] smaller files, and no metadata.
  - [con] a native dependency to build on every platform and in the Nix shell.
- **C. Re-encode images in the browser, with a canvas, before upload.**
  - [pro] no metadata, no dependency.
  - [con] screenshots may grow as PNG or blur as JPEG, and animated GIFs lose their animation.

**Answer:**

## Q7: Do agents open the images linked in the files they read?

An agent running a step reads the proposal, the review, or the answers as text. Nothing in the skill
tells it to open the images they link to, and Claude Code's Read tool would show them. More in
[discovery](discovery-01.md#agents-reading-images).

Why it matters: a screenshot the agent never opens is a screenshot the human attached for nothing.

- **A (recommended). The skill says to open every image linked in a human's file the step reads:
  proposal, answers, notes, and review comments.**
  - [pro] screenshots are seen at every step that relies on them.
  - [con] each image costs tokens at every step that reads its file.
  - Why recommended: the human attached it to be seen, and screenshots are few.
- **B. Leave it to the agent.**
  - [pro] no change to the skill.
  - [con] the agent may skip an image that answers its question.

**Answer:**

## Settled without the human

- **Previews in the chat composer** are thumbnails above the text, each with a ✕ to remove it, as
  Astryx's composer and every chat product do. Clicking one opens it full screen. See
  [discovery](discovery-01.md#astryx).
- **In files, the image is a link inserted at the cursor**, `![name](images/name.png)` with A in
  Q1.A, the only form that reads in plain text, on GitHub, and in Obsidian. See
  [discovery](discovery-01.md#markdown-image-syntax).
- **With A or C in Q1, image names** come from the original file, in lowercase with dashes, or are
  `pasted-YYYYMMDD-HHmmss.png` for an image from the clipboard, with `-2`, `-3` added on a conflict,
  never overwriting, like VS Code. See [discovery](discovery-01.md#folder-and-names).
- **Alt text** is the image's name, selected after insertion so typing replaces it; no dialog asks
  for it, as no product compared does. See [discovery](discovery-01.md#accessibility).
- **Accepted images** are PNG, JPEG, GIF, and WebP, the types Claude reads. SVG is refused, since it
  can run scripts and Claude cannot read it, and HEIC too: iPhones convert their photos to JPEG when
  the button asks for those types. See [discovery](discovery-01.md#file-safety).
- **The size limit is 5 MB per image**, under every Claude provider's limit, with a message naming
  the limit when a file is over it, or of another type. See
  [discovery](discovery-01.md#claude-code-and-the-claude-api).
- **Upload status and errors are announced** to screen readers, and the button is reachable by
  keyboard, as WCAG asks. See [discovery](discovery-01.md#accessibility).
- **Uploads go through their own server route**, as multipart forms with a body limit, instead of
  base64 through fate, and the core writes the file, as the [stack](../decisions/stack.md) decision
  requires. The UI still reads its data through fate; the route only sends files, like `/raw` and
  `/mockups` only serve them. See [discovery](discovery-01.md#server-uploads).
- **The UI shows images** in proposals, reviews, and the editor's preview: the core's document tree
  gets an image node, and the server serves image files with their type and `nosniff`. See
  [discovery](discovery-01.md#important-reads).
- **`ura check` checks that image links into `specs/` resolve**, as it does for other links. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **With A or C in Q1, an image commits with the text that links to it**: a proposal, draft, review,
  or round of answers. An image added then unlinked before the commit is deleted, since it was never
  committed. See [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **With A or C in Q1, a draft that gets an image becomes a folder**,
  `specs/drafts/<slug>/proposal.md` with its images, so starting the feature moves the images with
  it, as it already does for postponed features. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **With A or C in Q1, the images of a replaced review file stay in the folder** until the feature
  finishes, rather than being deleted with the review: a later comment may link to them.
- **A chat message can be an image alone**, without text, and taking a message back returns its
  images to the composer with its text. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **The attach button appears in a chat only when its agent declares images**, as the
  [agents](../decisions/agents.md) decision requires of every capability. The Claude Code validation
  script checks images by hand. See [discovery](discovery-01.md#other-agents).
- **Left out**: listing and serving image mockups written by agents, attaching images from the CLI
  or editors (which have their own paste tools), and scanning screenshots for secrets. See
  [discovery](discovery-01.md#needs-no-choice).

**Notes:**
