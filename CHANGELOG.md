# Changelog

## 0.5.0 - 2026-10-15

### Features

- **[Image attachments](https://github.com/mrtolkien/uraeda/blob/v0.5.0/specs/done/2026-10-13-image-attachments.md)**
  ([#14](https://github.com/mrtolkien/uraeda/pull/14)): Chats, proposals, and reviews accept images,
  dropped anywhere on the page or picked with a dedicated button, because "screenshots are often
  useful!". The answers widened it to every text a human writes, added paste, and a Neovim command
  to paste from the clipboard. Since committed images live in git history forever, the human asked
  for "an efficient, highly compressed format, that still works well for screenshots": every image
  is re-encoded as WebP by the Rust core.
- **[Multi-repo server](https://github.com/mrtolkien/uraeda/blob/v0.5.0/specs/done/2026-10-13-multi-repo-server.md)**
  ([#12](https://github.com/mrtolkien/uraeda/pull/12)): The server served one repository, the folder
  it started in. The human wanted Uraeda to manage several repositories from one web UI, with a
  repository selector at the top left and any folder of the machine addable, since a packaged Uraeda
  needs a flow to pick its first repository anyway. Running the UI easily, with `npx`, was split
  into its own feature,
  [Run the web UI with npx](https://github.com/mrtolkien/uraeda/blob/v0.5.0/specs/done/2026-10-14-run-ui.md).
- **[Code quality and maintainability through the skill](https://github.com/mrtolkien/uraeda/blob/v0.5.0/specs/done/2026-10-14-code-quality-in-the-skill.md)**
  ([#13](https://github.com/mrtolkien/uraeda/pull/13)): The human wants high-quality, maintainable
  apps with the least work, without reading a line of code. Research and a review of this repository
  showed agents grow and copy code feature after feature, held back by instructions alone, and that
  specs of 431 to 719 lines bury what the human must approve. This feature puts the human's part of
  a spec first and folds the build details in the web UI, writes a few code-quality concepts into
  the skill, each backed by a check, pushes every project to set those checks up, makes `SKILL.md` a
  lean entry point, and turns plan review off by default. This repository adopts the checks itself.
  The maintenance flow, an audit the human answers like a round of questions, was left for its own
  feature.
- **[Run the UI easily](https://github.com/mrtolkien/uraeda/blob/v0.5.0/specs/done/2026-10-14-run-ui.md)**
  ([#17](https://github.com/mrtolkien/uraeda/pull/17)): The web UI only ran from a checkout of
  Uraeda, with Rust, Node, pnpm, and a build. The human asked for the best and simplest way to
  package Uraeda today, so anyone can run it with one command, and for every promising solution to
  be tested: a single binary, a desktop app, or `npx uraeda`. Three were built and run during
  discovery: an npm package (3.5 MB, needs Node 24), a Node single executable (159 MB), and a Bun
  one (90 MB). The human chose the npm package.
- **[Dedicated session view](https://github.com/mrtolkien/uraeda/blob/v0.5.0/specs/done/2026-10-14-session-view.md)**
  ([#15](https://github.com/mrtolkien/uraeda/pull/15)): Following what an agent does is one of the
  main things the web UI is for, and a feature's session was a pane 40 % wide beside the feature
  page on a desktop, about 480 px of a 1440 px window: "it's hard to really follow what is happening
  at the moment". The session became a page of its own at every width, with a column beside the
  transcript for the feature's progress and the files changed on its branch. The sidebar shows each
  feature by its slug and, during its implementation, its current task, "7/11", taken from the
  plan's checkboxes, so it shows whoever runs the agent, the UI or a terminal.
- **[Text inputs and comments](https://github.com/mrtolkien/uraeda/blob/v0.5.0/specs/done/2026-10-14-text-inputs.md)**
  ([#16](https://github.com/mrtolkien/uraeda/pull/16)): Writing is most of what the human does in
  the web UI, and it did not feel solid: the round's notes lost letters and showed twice on the
  page, review comments lagged on long specs, and some fields saved as they were typed while others
  waited for a button. The human asked for every text field to save only with a button, and for
  comments on the points a round settled without them, written into its notes.
