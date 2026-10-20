# Discovery, round 01: Layout and look and feel

## Summary

The feature is one design pass over the whole web UI: its layout and its visual identity, decided
together. The human wrote an information architecture for each view in [the proposal](proposal.md).
It says what the view shows, what is primary, and what stays visible together. The proposal then
asks for three to five throwaway prototypes of complete directions. The spec then writes the chosen
direction down as layout behaviour, design tokens, icons, and a logo.

Three terms recur below. A CF is a change or a feature, the human's shorthand in the proposal.
Astryx is the open-source React component library, from Meta, that the web UI is built on. StyleX is
the compile-time styling library Astryx uses. All styling goes through its tokens, and lint enforces
it.

This round built the prototypes as the investigation's artefacts. Five clickable HTML mockups share
one set of fake data and draw the same views. A
[README](/specs/2026-10-20-layout-look/mockups/README.md) presents them.
[compare.html](/specs/2026-10-20-layout-look/mockups/compare.html) shows them side by side at 1440,
960, and 390 px wide. [logos.html](/specs/2026-10-20-layout-look/mockups/logos.html) draws five logo
concepts. They are not shipping code, and they are neither Astryx nor Storybook.

- **[Natural](/specs/2026-10-20-layout-look/mockups/natural.html)**: washi paper (Japanese handmade
  paper), moss and bark colours, and a bonsai home whose branches are features. It has a floating
  bottom dock and a bottom-sheet session, in light and dark.
- **[Cyber](/specs/2026-10-20-layout-look/mockups/cyber.html)**: the author's own violet-black and
  neon-green palette, with chamfered (corner-cut) HUD panels. It has a branch-map home, a left rail
  plus a bottom dock of running work, and a side "comm" panel for the session. Dark only.
- **[Terminal](/specs/2026-10-20-layout-look/mockups/terminal.html)**: a LazyVim look in Catppuccin
  Mocha colours, with a tab line on top and a status line at the bottom. It has titled bordered
  panes, a keyed start menu with a pixel bonsai, a picker overlay, and a split session. Dark only.
- **[Glass](/specs/2026-10-20-layout-look/mockups/glass.html)**: Apple's Liquid Glass used only for
  navigation and overlays. It has a floating sidebar, a toolbar, and a session sheet with three
  detents (rest heights). Reading sheets are opaque, and the home uses Fitness-style rings.
- **[Blueprint](/specs/2026-10-20-layout-look/mockups/blueprint.html)**: technical drawing sheets
  with a drawing list and a title-block footer. Questions are numbered callouts, changed decisions
  get revision clouds, and live previews are framed as "Detail A". The home is a process plan.
  Cyanotype (dark) and vellum (light).

Established agent tools converge on a few patterns, listed under
[What they have in common](#what-they-have-in-common). Their sidebars list sessions grouped by whose
move it is. They use one small status vocabulary, a diff beside the chat, a command palette, and a
usage meter in the chrome. The proposal covers the shell, the session list, and the usage limit. It
does not mention a command palette, the weekly usage window, or a diff beside the chat. Those are
scope gaps, raised once under
[the proposal](#the-proposal-says-almost-only-ui-while-the-capabilities-users-expect-add-behaviour).

The code has one layout breakpoint, 768 px, and a theme that grows sizes by 1.2 from 1024 px.
Between 768 and about 1100 px, the sidebar takes 280 px. A column of 320 px or a detail pane of at
least 400 px takes more. The main area is left with roughly 280 to 360 px. That is the "half a
screen" breakage the proposal reports, by arithmetic. The look is Astryx's neutral greys with a
black and white accent. The font the theme names is never loaded, and the app has no logo and no
favicon. The colour option on features is already removed by the feature that merges chats before
this one.

Four tensions need a human ruling.

- The preview decision says mockups are Storybook stories, while the proposal and the skill allow
  throwaway HTML.
- The stack decision forbids parsing markdown in the UI, which every editor with a live preview
  does.
- The layout decision fixes two width classes, while all five mockups adapt near 1000 to 1180 px.
- The proposal says "almost only UI", while several capabilities users expect are behaviour.

## How other products do it

"Read" means the page was fetched and read in this round. "Snippet only" means the fact comes from a
search result's summary, and its page is under [Not checked](#not-checked). Screenshots were taken
in a browser only for DeepSeek Harness, Kiro Crew, and Zed.

### DeepSeek Harness

DeepSeek Harness is an open-source, plugin-based agent app, as a desktop app or a web UI
([read](https://www.deepseek.com/en/harness/)).

- The sidebar has New Session, Plugins, and Automation, then a Workspace section listing sessions by
  title. Tool calls draw as inline cards with line deltas such as "+35 −0", and a total such as
  "Took 5m 24s".
- On the live page, user messages are right-aligned bubbles. Assistant text is flush, with no
  bubble, at about 65 characters. The composer is a rounded card floating above the bottom, with a
  permission chip and a model chip.
- The "waterfall-like graph" in the proposal is the developer-tools trajectory view. Tabs for
  Duration, Turns, and Calls sit above a three-lane overview labelled Input, Model, and Tools. Each
  call is a coloured block on one time axis. Below it, a hierarchical log has role badges and a turn
  gutter. The page never says "waterfall": that reading is from the screenshot.
- Diff review is a floating card tied to a turn. The site's own navigation is a floating frosted
  pill.
- A third-party guide calls the web UI "an observation and intervention layer", and says closing it
  does not stop a running session ([read](https://teamorouter.com/blogs/dsh-web-ui-guide)).

### Kiro Crew

Kiro Crew is an open-source workspace that keeps context across sessions, as a desktop app, a web
dashboard, a CLI, and chat apps ([read](https://kiro.dev/crew/)).

- The main view has three columns: a sessions list, an agent thread, and an artefact on the right,
  such as a merged pull request.
- In the browser, the shell has a far-left icon rail that expands to a labelled sidebar. A top bar
  holds environment tabs and a centred "⌘K Search for anything" field. A violet "+ New" split button
  opens a menu of kinds. Each session row shows its folder, a bold title, a status line, and
  pull-request chips.
- Its sessions documentation ([read](https://kiro.dev/docs/crew/chat/sessions/)) describes each chat
  as a tab above the transcript. The sidebar has a lane switch: a folder tree, a flat list, or a
  conductor view. The conductor view nests worker sessions under the session that opened them, and
  shows "needs-you" counts when collapsed. Idle sessions fold into "Dormant sessions" after 7 days.
  Pinned, running, and unread sessions never fold.
- The dashboard offers 14 colour themes and a responsive mobile layout.
- Agent Worlds draws running sessions as pixel-art characters in themed scenes. A Japanese review
  ([read](https://dev.classmethod.jp/articles/kiro-crew-agent-worlds/)) finds it more intuitive than
  the list when several sessions run. It adds that the text in the scene is too small and ignores
  the font-size setting.

### Zed and Delta

Zed is a code editor, and Delta is its multiplayer agent app ([read](https://zed.dev/),
[blog](https://zed.dev/blog/introducing-delta), [agent panel](https://zed.dev/docs/ai/agent-panel),
[parallel agents](https://zed.dev/docs/ai/parallel-agents)).

- Zed's docks sit left, right, and bottom around a central pane grid. The agent panel keeps a
  proportion of the window when docked left or right. A double-click on its resize handle restores
  the default ([configuration](https://zed.dev/docs/configuring-zed)).
- A threads sidebar groups threads by project, with a status per thread. It is 300 px by default and
  clamped between 200 and 800 px. A new "Agentic" layout puts threads and the agent panel on the
  left, and project and git panels on the right.
- Delta's sidebar has Pinned, Projects, and Threads, with sub-threads nested under a parent. Agent
  activity collapses into one line, such as "Thought 3 times, ran 1 search, read 2 files". Comments
  anchor to any line of code or of the conversation. A right Changes panel lists touched files and
  hunks.
- The Delta blog says "diffs open in full, transcripts stay whole" and "the conversation is a
  document, and your cursor works everywhere in it".

### Agent tools as a group

These tools were read through their official documentation and changelogs.

- **Cursor** ([Agents Window](https://cursor.com/docs/agent/agents-window)): one sidebar for all
  local and cloud agents, with a needs-attention group for agents blocked on approvals. Staff called
  a mismatch between three unread counters "telling two different stories"
  ([read](https://forum.cursor.com/t/dock-menu-bar-badge-count-does-not-match-agents-sidebar-needs-attention-glass/168982)).
  The status bar shows two circles, plan usage and context
  ([read](https://forum.cursor.com/t/agent-window-status-bar-hiding-plan-usage/167323)).
- **OpenAI Codex** ([docs](https://learn.chatgpt.com/docs/app)): a sidebar of Pinned, Projects, and
  Recents, with a blue unread dot. A bell opens an Activity view of chats that are "unread, running,
  or waiting for your response". Alerts can be set to never, only in background, or always
  ([notifications](https://learn.chatgpt.com/docs/notifications)).
- **Claude Code** ([desktop](https://code.claude.com/docs/en/desktop),
  [web](https://code.claude.com/docs/en/claude-code-on-the-web),
  [agent view](https://code.claude.com/docs/en/agent-view)): a sessions sidebar and drag-and-drop
  panes for chat, diff, browser, terminal, and files. A session rail shows `+12 -1` line counts and
  the pull request with its CI state. A usage ring sits beside the model picker. The terminal agent
  view groups sessions as Pinned, Ready for review, Needs input, Working, and Completed. A session
  archives itself when its pull request merges.
- **Conductor** ([changelog](https://www.conductor.build/changelog/0.35.0-workspace-status)):
  workspaces are grouped by stage: backlog, in progress, in review, and done.
- **Amp** ([manual](https://ampcode.com/manual)): pinned threads first, then active threads by
  project. Threads idle for 72 hours collapse. Snoozed and Archived sections sit at the bottom, and
  each thread has an unread dot.
- **Warp** ([docs](https://docs.warp.dev/agents/using-agents/managing-agents)): an Agent Management
  Panel with one row per conversation, and the statuses Working, Blocked, Canceled, Failed, and
  Success.
- **GitHub Copilot**
  ([agents panel](https://github.blog/changelog/2025-08-19-agents-panel-launch-copilot-coding-agent-tasks-anywhere-on-github-com)):
  an Agents button in the site header opens an overlay on every page.
- **Jules** ([usage limits](https://jules.google/docs/usage-limits/)): at the daily or concurrent
  cap, the new-task button is disabled and a tooltip explains why.
- **Superset** ([agent status](https://docs.superset.sh/agent-status)): questions, tool approvals,
  and plan reviews flag a workspace as needing attention, and the dock badge counts them.
- **Devin** ([session tools](https://docs.devin.ai/work-with-devin/devin-session-tools)) and
  **Factory** ([overview](https://docs.factory.com/docs/factory-app/overview)): the chat sits beside
  the worklog, a diff, or a live site that the session produced.

On mobile, these tools offer a list of sessions plus one session view. The lists group by state more
often than by recency. A newer layer is a coordinator conversation that spawns threads as cards with
live status, in Cursor Projects and Claude Projects.

### Usage-limit widgets

- Claude Code's `/usage` shows plan usage bars. Its statusline JSON exposes
  `rate_limits.five_hour.used_percentage` and `rate_limits.seven_day.used_percentage`, with a reset
  time ([costs](https://code.claude.com/docs/en/costs),
  [statusline](https://code.claude.com/docs/en/statusline)).
- Codex shows percent left, not percent used ([pricing](https://learn.chatgpt.com/docs/pricing),
  [issue](https://github.com/openai/codex/issues/32791)). A third-party guide says its five-hour
  meter disappeared for some plans in mid-2026. The cause is snippet only.
- ccusage colours a bar green under 70%, yellow from 70 to 90%, and red from 90%
  ([guide](https://ccusage.com/guide/blocks-reports)). CodexBar dims its icon when data is stale
  ([repo](https://github.com/steipete/CodexBar)).
- Uraeda today reads only the five-hour window, only from Claude Code, in
  [claude-events.ts](/packages/server/src/runner/claude-events.ts) lines 164 to 189.

### Linear, Things, Obsidian, and other productivity apps

- **Linear** ([redesign](https://linear.app/now/how-we-redesigned-the-linear-ui),
  [2026 refresh](https://linear.app/blog/behind-the-latest-design-refresh)): the sidebar is "a few
  notches dimmer" so the content wins, with fewer dividers and warmer greys. Its principles are
  "Don't compete for attention you haven't earned" and "Structure should be felt not seen". Themes
  come from three inputs: base colour, accent colour, and contrast. The Inbox has Priority and Other
  tabs, and j and k move through items ([inbox](https://linear.app/docs/inbox)). Triage uses keys 1,
  2, 3, and H to snooze ([triage](https://linear.app/docs/triage)). Space peeks at an item
  ([board layout](https://linear.app/docs/board-layout)). Group headers stay visible while scrolling
  ([display options](https://linear.app/docs/display-options)). No source read describes Linear in a
  narrow window.
- **Things 3** ([features](https://culturedcode.com/things/features/),
  [lists](https://culturedcode.com/things/support/articles/4001304/)): Inbox, Today, Upcoming,
  Anytime, Someday, and Logbook. Projects that start later are hidden from the sidebar until active,
  the closest analogue to Ongoing, Now, Next, and Later. A to-do opens as "a clean, white sheet".
- **Obsidian** ([workspace help](https://mintlify.wiki/obsidianmd/obsidian-help/ui/workspace),
  [1.0 changelog](https://obsidian.md/changelog/2022-10-13-desktop-v1.0.0)): two sidebars collapse
  independently, and a ribbon (icon strip) stays when the left sidebar is closed. A tab group can
  switch to stacked tabs, as in Andy Matuschak's notes.
- **Notion** ([sidebar](https://www.notion.com/help/navigate-with-the-sidebar),
  [peek](https://www.notion.com/releases/2022-07-20)): database pages open in a side peek by
  default, with centre peek or full page as options.
- **Height**, shut down in September 2025
  ([review](https://freshvanroot.com/blog/height-app-review/)): every task had its own chat, which
  doubled as its activity log.
- **Plane** ([layouts](https://docs.plane.so/core-concepts/issues/layouts)): a quick-add row at the
  bottom of each group inherits the group's value. **Todoist**
  ([new task view](https://todoist.com/inspiration/todoist-new-task-view)): a minimised top bar
  keeps the task name visible on scroll.
- **Raycast** ([action panel](https://manual.raycast.com/action-panel.md)) and **Superhuman**
  ([Computerworld](https://www.computerworld.com/article/3706873/superhuman-email-app.html)): every
  item has contextual actions, and Cmd or Ctrl plus K opens a command prompt from anywhere.
- **Tana** ([navigation](https://outliner.tana.inc/docs/navigation)): the sidebar cycles between
  full, mini (icons only), and hidden.

### Graphs, traces, and home pages that stand out

The proposal asks for a home that is "visually striking" and useful. These products draw work as a
picture.

- **GitKraken** ([interface](https://help.gitkraken.com/gitkraken-desktop/interface/),
  [Launchpad](https://help.gitkraken.com/gitkraken-desktop/gitkraken-launchpad/)): the graph draws
  uncommitted work as a node at the top. A status-bar summary groups pull requests by state and
  opens the matching group.
- **Graphite** ([PR inbox](https://graphite.com/docs/use-pr-inbox)): inbox sections are named by
  whose move it is, such as "Needs your review" and "Returned to you".
- **Sapling ISL** ([docs](https://sapling-scm.com/docs/addons/isl/)): a commit tree with a "You are
  here" marker and badges for pull request and CI state.
- **GitButler**
  ([virtual branches](https://docs.gitbutler.com/features/branch-management/virtual-branches)): each
  virtual branch is a vertical lane. A branch integrated upstream disappears on its own.
- **Honeycomb, Chrome DevTools, Braintrust, and Langfuse**
  ([Honeycomb](https://docs.honeycomb.io/reference/honeycomb-ui/query/trace-waterfall),
  [Chrome](https://developer.chrome.com/docs/devtools/network/reference),
  [Braintrust](https://www.braintrust.dev/docs/observe/examine-traces),
  [Langfuse](https://langfuse.com/docs/observability/features/agent-graphs)): waterfalls of bars on
  a time axis, a brushable overview strip, and a "Worked" block that folds many tool calls into one
  line.
- **Railway** ([smart canvas](https://railway.com/changelog/2025-12-05-smart-canvas)): a tile names
  a failure in words, such as "Build failed." **Grafana**
  ([state timeline](https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/visualizations/state-timeline/)):
  one row per entity, with coloured bands for the time spent in each state.
- **GitHub's home dashboard**
  ([changelog](https://github.blog/changelog/2025-10-28-home-dashboard-update-in-public-preview))
  now leads with agent tasks and their status.
- **Generative trees.** An L-system rewrites an axiom with production rules. Two symbols push and
  pop the drawing position, which makes branches
  ([Wikipedia](https://en.wikipedia.org/wiki/L-system)). cbonsai grows a terminal bonsai from a
  seed, and growth can be saved and loaded ([manual](https://www.mankier.com/1/cbonsai)). The
  Obsidian graph view ([help](https://obsidian.md/help/plugins/graph)) is the usual example of a
  picture that is pretty and hard to use. That judgement is this round's own.

### Apple Liquid Glass

Liquid Glass is Apple's 2025 material for controls and navigation. Its official sources were all
read: the
[HIG materials page](https://developer.apple.com/design/human-interface-guidelines/materials), the
[adoption guide](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass),
the
[newsroom post](https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/),
and [WWDC25 session 323](https://developer.apple.com/videos/play/wwdc2025/323/).

- "Liquid Glass forms a distinct functional layer for controls and navigation elements — like tab
  bars and sidebars — that floats above the content layer."
- The guidelines add "Don't use Liquid Glass in the content layer" and "Use Liquid Glass effects
  sparingly". They also say to avoid "overcrowding or layering Liquid Glass elements on top of each
  other".
- The regular variant blurs and adjusts luminosity, for components "that have a significant amount
  of text". The clear variant is highly translucent and only for media, with a dimming layer of 35%
  when the content below is bright.
- A half sheet is inset from the display edge. "When a half sheet expands to full height, it
  transitions to a more opaque appearance to help maintain focus on the task."
- A scroll edge effect obscures content under floating bars. Nested shapes are concentric with their
  container. The tab bar can minimise on scroll down. Appearance changes with Reduce Transparency
  and Increase Contrast.
- The Nielsen Norman Group's critique ([read](https://www.nngroup.com/articles/liquid-glass/)) says
  "Text on top of text creates an illegible mess" and "Motion for motion's sake is not usability".
  It says controls that appear and vanish make users "play hide-and-seek with the navigation
  controls".
- The web techniques and their limits are under
  [Motion, transparency, contrast, and engine support](#motion-transparency-contrast-and-engine-support).

### Japanese design, bonsai vocabulary, and the author's own sites

- The name 裏枝 (ura-eda) is another name for 後ろ枝 (ushiro-eda), a branch growing behind the
  trunk. Bonsai glossaries say having one creates depth
  ([Kotobank, read](https://kotobank.jp/word/%E5%BE%8C%E3%82%8D%E6%9E%9D-22216),
  [Kinji Shuppan, read](https://www.bonsai.co.jp/glossary/)). They also list 枝順 (the order of main
  branches), 枝芯 (a branch's centre line), 芽当たり (buds after pruning), 剪定 (pruning),
  and 根張り (the surface root spread)
  ([read](https://bonsai-bonsai.com/ninki/%E7%9B%86%E6%A0%BD%E3%81%AE%E5%89%AA%E5%AE%9A%E3%82%84%E4%BD%9C%E3%82%8A%E6%96%B9%E3%81%AB%E9%96%A2%E3%81%99%E3%82%8B%E9%87%8D%E8%A6%81%E7%94%A8%E8%AA%9E/)).
  Mapping each term to a UI concept is this round's own idea.
- Design rules: 間 (ma) is active empty space. Pasting sakura or torii motifs on a Western layout
  "reads cheap" ([Utsubo, read](https://www.utsubo.com/ja/blog/japanese-web-design-style-guide)).
  Wabi-sabi is beauty that is "imperfect, impermanent, and incomplete"
  ([Wikipedia, read](https://en.wikipedia.org/wiki/Wabi-sabi)). Shibui is "simple, subtle, and
  unobtrusive beauty", with muted tones mixed with grey and sometimes one bright accent
  ([Wikipedia, read](https://en.wikipedia.org/wiki/Shibui)).
- A designer interview about the Palace Museum's calendar app says too much design may weaken the
  objects themselves. Its motion stayed small and tied to one motif
  ([ifanr, read](https://www.ifanr.com/app/521115)).
- Traditional colour names with hex values come from two sources that disagree on many values:
  [colordic](https://www.colordic.org/w) and [NIPPON COLORS](https://nipponcolors.com/), both read.
  The names are not a standard.
- **The author's own sites.** The shop's source is at
  `/home/tolki/Development/keyboards/tolkeebs-website`, and its page
  [shop.tolki.dev](https://shop.tolki.dev/) was read. Its stylesheet names the palette "Eva
  Unit-01": `#0a0710` violet-black, `#150f22` surface, `#f3f1fb` text, `#9a8fc0` muted, `#8dff5a`
  neon green, and `#7c3fd0` violet. Headings are mono bold, labels are mono uppercase with wide
  tracking, and the body is Inter. Neither site uses chamfered clip paths, HUD panes, chromatic
  aberration, or a running glitch.
- [ghost.tolki.dev](https://ghost.tolki.dev/) uses Tokyo Night values, a katakana rain canvas at 8%
  opacity, scanlines at 1.5%, and a typing tagline. Its rain and typing have no
  `prefers-reduced-motion` guard. Its glitch keyframes are defined and never used.
- **The author's terminal.** His Neovim config sets `colorscheme = "catppuccin-mocha"`, and his
  dashboard draws a pixel-art sprite with `chafa`. Ghostty uses the Monaspace family (read from
  `~/.config/nvim` and `~/.config/ghostty`). This explains the colours in the proposal's
  screenshots.

### Game UIs and terminal UIs

- **Cyberpunk 2077**: almost everything shares one shade of red, so decoration is hard to tell from
  function
  ([Interface In Game, read](https://interfaceingame.com/articles/cyberpunk-2077-ux-ui-critique)).
- **Arknights**: a mostly black, white, and grey UI with blue and orange accents, serif titles, and
  sans-serif everything else ([GCORES, read](https://www.gcores.com/articles/135723)). Another
  analysis credits cards with parallax, blur to push the background back, and fewer page levels
  ([GCORES, read](https://www.gcores.com/articles/123154)).
- **Zenless Zone Zero**: a type designer calls its flashing effects and ultra-bold type visually
  tiring. Display type is for looking at, and body type is for reading. White on black looks
  heavier, so dark UIs need lighter weights
  ([GCORES, read](https://www.gcores.com/articles/184502)).
- **Persona 5**: red as the main colour, with sub-colours avoided on purpose. Brightness shows
  priority, and each menu depth has a different layout
  ([Famitsu, read](https://www.famitsu.com/news/201711/13145540.html)).
- **NieR:Automata**: a UI meant to be "systematic and sterile, but also beautiful", with "a nice,
  warm beige" and a muted red-orange for emphasis
  ([PlatinumGames, read](https://platinumgames.com/official-blog/article/9624)).
- **Terminal tools.** The snacks.nvim dashboard is a declarative list of header, keys, recent files,
  and a cached terminal section
  ([docs, read](https://github.com/folke/snacks.nvim/blob/main/docs/dashboard.md)). The which-key
  plugin shows bindings in a popup after about 200 ms
  ([README, read](https://github.com/folke/which-key.nvim)). The btop monitor highlights the key
  letter inside each label and keeps the label clickable
  ([README, read](https://github.com/aristocratos/btop)). The Posting client labels every pane for a
  jump mode ([site, read](https://posting.sh/)). Crush, a terminal agent, has a command palette with
  live theme preview ([README, read](https://github.com/charmbracelet/crush)).
- **The terminal look on the web.** WebTUI is a pure CSS library with Catppuccin, Nord, and Gruvbox
  themes ([read](https://webtui.ironclad.sh/)). terminal.css weighs about 3 kB
  ([read](https://terminalcss.xyz/)).
- **The cyber look on the web.** augmented-ui is "just CSS", gives chamfered panes with borders, and
  is BSD-2-Clause ([read](https://augmented-ui.com/)). Arwes says it is "no longer maintained and
  currently outdated" ([README, read](https://github.com/arwes/arwes)). The CSS property
  `corner-shape: bevel` makes borders follow a cut corner, and is experimental
  ([MDN, read](https://developer.mozilla.org/en-US/docs/Web/CSS/corner-shape)). A glitch effect is
  three copies of the text clipped in animated bands, and "a little goes a long way"
  ([CSS-Tricks, read](https://css-tricks.com/glitch-effect-text-images-svg/)).

### Reading, comments, and callouts

- Butterick gives 45 to 90 characters a line
  ([read](https://practicaltypography.com/line-length.html)). He gives a line spacing of 120% to
  145% of the point size ([read](https://practicaltypography.com/line-spacing.html)), and a web body
  size of 15 to 25 px ([read](https://practicaltypography.com/point-size.html)).
- iA asks for adaptive layouts "with few breakpoints" over liquid ones, and 140% line height as "a
  good benchmark". It asks for dark grey text over pure black on white
  ([read](https://ia.net/topics/responsive-typography-the-basics)). It writes that a monospace font
  says "this text is work in progress", and a proportional one "as good as done"
  ([read](https://ia.net/topics/in-search-of-the-perfect-writing-font)).
- Zenn's article stylesheet sets Japanese body text at line-height 1.9. Its message boxes are a
  round icon beside tinted content (`zenn-content-css` 0.5.7, read from the npm tarball). Latin text
  sits in the lower range above.
- GitHub alerts should be limited to "one or two per article" and not placed back to back
  ([docs](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax)).
  Obsidian callouts take a Lucide icon id ([help](https://obsidian.md/help/callouts)).
- Comments on a document's parts. GitHub pull requests batch pending comments and count "Viewed"
  files
  ([docs](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/reviewing-proposed-changes-in-a-pull-request)).
  GitHub's prose diff shows removed text on red and added text on green
  ([docs](https://docs.github.com/en/repositories/working-with-files/using-files/working-with-non-code-files#rendering-differences-in-prose-documents)).
  Google Docs suggesting mode colours edits and crosses out deletions
  ([help](https://support.google.com/docs/answer/6033474)).
- One question at a time against all at once: the evidence is mixed. A Typeform community test of a
  20-question quiz found the one-at-a-time form completed less often, 35% against 45%. Fillout says
  conversational forms lose past 12 to 14 questions. Both are snippet only
  ([Fillout](https://www.fillout.com/blog/one-question-at-a-time-form),
  [Typeform community](https://community.typeform.com/build-your-typeform-7/more-than-one-question-on-a-page-258/index7.html)).
- Framing a live preview: Storybook's viewport addon only resizes the iframe and draws no bezel
  ([docs, read](https://storybook.js.org/docs/essentials/viewport)). Pure-CSS device frames exist as
  MIT packages with global stylesheets, such as
  [devices.css](https://github.com/picturepan2/devices.css), last pushed in December 2023.
- Sessions beside documents: Cursor's agent opens in a side pane
  ([docs, read](https://cursor.com/docs/agent/overview)). GitHub Copilot Chat is a page reachable
  from any GitHub page
  ([docs, read](https://docs.github.com/en/copilot/how-tos/chat-with-copilot/chat-in-github)).

### What they have in common

These are the capabilities users of such tools now expect. The sources are in the sections above.
Each one is settled in a topic under [Approaches](#approaches), or on a line under
[Needs no choice](#needs-no-choice).

1. A session list in a left sidebar, grouped by whose move it is, not by recency. Idle items fold
   away. Running, unread, and pinned items never fold.
2. One small status vocabulary used everywhere: working, needs input, ready or done, failed, and
   idle, plus a separate unread dot. The "needs you" state is the loudest and is counted in the
   chrome.
3. A "New" button at the top of the sidebar, with a keyboard shortcut. The composer doubles as the
   task form. A quick add inside a group inherits the group's value.
4. A diff or an artefact beside the chat, opened from a `+N −M` badge, with line comments sent back
   to the agent. The proposal does not mention a diff beside the session.
5. A command palette on Cmd or Ctrl plus K, with shortcuts shown beside the actions. The proposal
   does not mention it.
6. A usage meter in the chrome that expands to two windows, five hours and weekly, each with a
   percent and a reset time. The proposal asks only for the five-hour limit.
7. Notifications on two events, needs input and finished, often with separate toggles. The app
   already has notifications under an active decision.
8. Item detail in three modes: a peek, a side panel, and a full page.
9. A sidebar in three states, full, icon rail, and hidden. It collapses as the window narrows and is
   dimmed so the content wins.
10. Agent activity collapsed into one summary line per turn, with details one click away, and a
    trace or waterfall lens as a secondary view.
11. Isolation per task, with pull request and CI state on the row.
12. Mobile as a list of sessions plus one session view, with a bottom bar of three to five
    destinations.
13. Calm, mostly neutral visuals, with colour reserved for meaning. The striking elements sit on the
    home and in illustration.
14. Comments anchored to any paragraph, including conversation text.
15. Deterministic layouts. Sources that draw work as a graph warn that a random layout carries no
    meaning.
16. Reordering that works without dragging: a menu of move actions beside the drag handle, announced
    to screen readers.

## Standards and libraries

Versions are those of the repository on 2026-10-20: Astryx 0.6.8, StyleX 0.19.1, Storybook 10.6.2,
and `@dnd-kit/react` 0.5.0, all pinned in [package.json](/packages/web/package.json). "Repo" marks
facts read in the repository or in `node_modules`. "Measured" marks numbers from a throwaway script
run in this round and not committed.

### Astryx components and theme levers

- Astryx 0.6.8 has 106 component folders (repo: the `exports` of `@astryxdesign/core/package.json`).
  Those that matter here are listed below.
  - Shell: `AppShell`, `SideNav` (collapsible to an icon rail, resizable), `TopNav`, `MobileNav`,
    `TabList`, and `Toolbar`.
  - Panels and layers: `Layout` with `LayoutPanel`, `Resizable`, `BottomSheet`, `Dialog`, `Overlay`,
    `Popover`, and `HoverCard`.
  - Other: `CommandPalette`, `Kbd`, `Stepper`, `TreeList`, `Collapsible`, `Lightbox`, `Markdown`,
    and the `Chat` parts for the session.
- `BottomSheet` is documented as "a mobile touch sheet that rises from the bottom edge". It takes
  `snapPoints` for dragging between heights, as viewport fractions, percentages, or lengths. It has
  named heights `hug`, `capped` (about 62% of the viewport), and `tall` (about 92%). It is modal by
  default and non-modal with `hasScrim={false}` (repo: `BottomSheet.doc.mjs`). The documentation
  does not describe use on a wide screen.
- [Overlay.tsx](/packages/web/src/layout/Overlay.tsx) already draws a `Dialog` on wide screens and a
  `BottomSheet` on narrow ones, as the layout decision asks.
- `Resizable` has a focusable separator, a grip, and an enlarged grab zone. The app uses it through
  `useResizable` in [SideColumn.tsx](/packages/web/src/layout/SideColumn.tsx): default 320 px,
  minimum 280, maximum 560, folding to a 48 px rail.
- The theme is a `defineTheme` call that extends Astryx's neutral theme in
  [theme.ts](/packages/web/src/theme/theme.ts). It sets tokens as light and dark pairs, local size
  tokens, component overrides, icons, and adaptations. An adaptation tests width, pointer, contrast,
  or motion. It cannot test reduced transparency or forced colours (repo: `themeAdaptations.ts`). A
  theme that drops translucency on request would list that as an Astryx gap, as
  [the components decision](/specs/decisions/ui-components.md) asks.
- The theme build accepts only the neutral theme as a base, so the neutral sizes are restated by
  hand in `theme.ts` lines 12 to 32. The built CSS has two media queries, `(width >= 1024px)` and
  `(pointer: coarse)`, and 156 uses of `light-dark()` (repo).
- Astryx's `Icon` registry holds 29 semantic names. Its documentation says any other icon is passed
  as an SVG component (repo: `Icon.doc.mjs`).
- The neutral theme names Figtree for text and imports it only in a separate `fonts.css` from Google
  Fonts. Nothing in `packages/web`, Storybook, or the server imports that file. Users see the system
  font, and tests and screenshots see DejaVu (repo: `fonts.css`, [flake.nix](/flake.nix) lines 77 to
  87).

### StyleX and the lint that guards it

- 100 files import StyleX, with 103 `stylex.create` calls. The app defines no `defineVars`,
  `createTheme`, or keyframes. Every token is Astryx's or the theme's `var(--…)` (repo, counted with
  `rg`).
- Lint in [vite.config.ts](/vite.config.ts) allows raw values only for `0`, percentages, `auto`, and
  keywords. It forbids `style`, `className`, and raw `<button>`, `<input>`, `<textarea>`,
  `<select>`, and `<dialog>` elements. It also forbids importing Astryx's `Markdown` outside
  `Prose.tsx`.
- A test, [lint.test.ts](/packages/web/src/__tests__/lint.test.ts) lines 59 to 78, allows three
  stylesheets only: Astryx's `reset.css` and `astryx.css`, and the built theme. A font package that
  ships a stylesheet would be a fourth. How the theme build could register self-hosted font files
  was not checked.
- No animation exists in the app's StyleX today. A parallax, glitch, or growth animation would be
  the first.

### Panel, drawer, and palette libraries

All were read from their READMEs and documentation.

| Library                                                                         | What it gives                                   | Facts that matter here                                                                                                          |
| ------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels) 4.x | Group, Panel, Separator, collapse, saved layout | Units in px, %, rem, em, vh, vw. `preserve-pixel-size` for a fixed sidebar. ARIA separator. Version 3 had no pixel constraints. |
| [Allotment](https://github.com/johnwalley/allotment)                            | VS Code style splits                            | `preferredSize`, `snap`, `priority`. React 17 to 19.                                                                            |
| [dockview](https://dockview.dev/)                                               | Tabbed docking, floating groups, pop-outs       | Zero dependencies. Floating groups cannot be maximised. Layout undo is in a commercial package.                                 |
| [FlexLayout](https://github.com/caplin/FlexLayout)                              | JSON-model tabsets, edge tabsets                | The README states no React range.                                                                                               |
| [Golden Layout](https://github.com/golden-layout/golden-layout)                 | Pop-out windows, saved layouts                  | The next major version is unstable. The README names Angular and Vue, not React.                                                |
| [cmdk](https://github.com/pacocoursey/cmdk)                                     | Unstyled command palette                        | Needs React 18 or later. Nested pages are a pattern, not an API.                                                                |
| [vaul](https://github.com/emilkowalski/vaul)                                    | Drawers                                         | Its README says "This repo is unmaintained".                                                                                    |

Astryx ships `Resizable`, `Layout`, `BottomSheet`, and `CommandPalette`. They overlap
react-resizable-panels, Allotment, vaul, and cmdk. Only dockview's floating and pop-out groups have
no Astryx counterpart. [The components decision](/specs/decisions/ui-components.md) says views use
Astryx components "wherever one fits the job". Whether Astryx's components meet the needs here was
not tested.

### Markdown editors, and whether the file survives

[The stack decision](/specs/decisions/stack.md) says "The web UI MUST draw workflow files from the
core's document tree, never parsing their markdown." The editor today is a plain text area
([DraftEditor.tsx](/packages/web/src/pane/DraftEditor.tsx), `TextField kind="editor"`). No editor
library is in [package.json](/packages/web/package.json).

Each library's default markdown parse and serialize was run headless on three files. They are this
proposal (229 lines), the example round
[clarifications-01.md](/skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/clarifications-01.md)
(263 lines), and a file of edge cases. The edge cases hold frontmatter, `*` bullets, `__bold__`,
wikilinks, an alert, a setext heading, a table, raw HTML, task items, and a pasted image. The table
counts changed lines on both sides of a diff. It is measured in this round with a throwaway script,
not committed, at default settings.

| Library (version)                  | Proposal          | Clarifications | Edge cases |
| ---------------------------------- | ----------------- | -------------- | ---------- |
| Tiptap `@tiptap/markdown` 3.32.0   | 52                | 142            | 31         |
| Milkdown `@milkdown/kit` 7.22.3    | 110               | 180            | 27         |
| `prosemirror-markdown` 1.13.8      | 187               | 281            | 31         |
| Lexical `@lexical/markdown` 0.52.0 | 36                | 138            | 2          |
| Any CodeMirror 6 editor            | 0 by construction | 0              | 0          |

- Tiptap, Milkdown, and `prosemirror-markdown` destroy YAML frontmatter. The `---` lines become a
  rule, and `discovery: high` becomes a heading. A proposal's `discovery` field would break on the
  first save. Lexical kept it as text.
- Those three also escape alerts such as `> [!NOTE]` and wikilinks. Tiptap turns `[pro]` and `[con]`
  into `\[pro\]`. Milkdown rewrites `-` bullets as `*` across the whole proposal.
- Lexical flattened the nested `[pro]` and `[con]` bullets under a bold option line that spans two
  lines. Its low count on the edge-case file is because it did not recognise frontmatter, table,
  alert, or setext heading at all. They show as plain text.
- Whether any library can keep the file byte for byte with custom serializers was not tried.
- The repository's formatter wraps markdown at 100 columns, so a format pass would re-wrap after any
  editor. A user's project may have no such formatter.

Editor candidates, from the npm registry and GitHub (read):

| Editor                                                         | Model                                 | Licence                                             | Version and date    | Vim mode                             |
| -------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------- | ------------------- | ------------------------------------ |
| CodeMirror 6 with `@codemirror/lang-markdown`                  | Text buffer                           | MIT                                                 | 6.43.15, 2026-10-19 | `@replit/codemirror-vim` 6.4.0 (MIT) |
| [Atomic Editor](https://github.com/kenforthewin/atomic-editor) | CodeMirror 6 with live preview, React | MIT                                                 | 0.6.2, 2026-07-11   | Through extensions                   |
| [ink-mde](https://github.com/davidmyersdev/ink-mde)            | CodeMirror 6, hybrid rendering        | MIT                                                 | 0.34.0, 2024-09-28  | Built-in option                      |
| [OverType](https://github.com/panphora/overtype)               | Text area overlay                     | MIT                                                 | 2.6.1, 2026-10-05   | None                                 |
| Tiptap with `@tiptap/markdown`                                 | ProseMirror document                  | MIT                                                 | 3.32.0, 2026-10-13  | None found                           |
| Milkdown (Crepe)                                               | ProseMirror and remark                | MIT                                                 | 7.22.3              | None found                           |
| Lexical                                                        | Lexical document                      | MIT                                                 | 0.52.0, still 0.x   | None found                           |
| MDXEditor                                                      | Lexical                               | MIT                                                 | 4.3.3               | None found                           |
| BlockNote                                                      | Tiptap blocks                         | MPL-2.0, with GPL-3.0 or commercial `xl-*` packages | 0.56.0              | None found                           |
| Plate                                                          | Slate                                 | MIT, per-package exceptions                         | 53.3.18             | None found                           |

- The Atomic Editor README says "Raw markdown is the source of truth ... byte-for-byte identical".
  It is 0.x with 158 stars. Its behaviour on this repository's files, its bundle size, and image
  paste were not checked.
- Every candidate ships its own CSS or needs styling, which is an Astryx gap to list. Every live
  preview parses markdown in the browser. Even a CodeMirror live preview parses with
  `@lezer/markdown` to place decorations.
- The `@replit/codemirror-vim` README says `vim()` must come before other keymaps, and
  `Vim.defineEx('write', 'w', ...)` defines `:w`. For ProseMirror and Tiptap no vim package turned
  up, from one forum thread (snippet only) and the searches made.
- The language server `ura lsp` exists in this repository. Whether a CodeMirror client for it fits
  was not checked.

### Width classes, window classes, and container queries

- Material 3 defines window width classes. Compact is under 600 dp, medium 600 to 839, expanded 840
  to 1199, large 1200 to 1599, and extra-large from 1600. A class describes the window, not the
  device, and can change at runtime
  ([window size classes](https://developer.android.com/develop/ui/compose/layouts/adaptive/use-window-size-classes),
  [adaptive navigation](https://developer.android.com/develop/ui/compose/layouts/adaptive/build-adaptive-navigation),
  [canonical layouts](https://developer.android.com/develop/ui/compose/layouts/adaptive/canonical-layouts),
  all read). Half of a 1920 px screen is "expanded", and half of 2560 px is "large". The
  m3.material.io pages returned errors, so the thresholds come from the Android pages.
- In Material 3, list-detail shows both panes at expanded width and one pane at medium or compact. A
  supporting pane is 70/30 at expanded width, and moves into a sheet or below the content at smaller
  widths. A coplanar side sheet is "not recommended for narrow screens"
  ([SideSheet docs, read](https://github.com/material-components/material-components-android/blob/master/docs/components/SideSheet.md)).
- Apple's HIG says "Avoid hiding the sidebar by default". It says to "Consider automatically hiding
  and revealing a sidebar when its container window resizes". It also says to show no more than two
  levels of hierarchy in a sidebar
  ([sidebars](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/sidebars.json),
  [split views](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/split-views.json),
  [sheets](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/sheets.json),
  all read). It also says "Avoid using a sheet to help people navigate your app's content". And it
  says "Use a panel instead of a sheet if people need to repeatedly provide input and observe
  results".
- A CSS container query reads the width of an ancestor with `container-type: inline-size`. Support
  is about 96% globally: Chrome 106, Firefox 110, Safari 16
  ([caniuse, read](https://caniuse.com/css-container-queries)). Chrome's guidance is media queries
  for macro layout and container queries for component layout
  ([Chrome developers, read](https://developer.chrome.com/blog/css-ui-ecommerce-cq?hl=ja),
  [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries)).
  Tailwind v4's container steps run from 320 px at `@xs` to 1024 px at `@5xl`.
- [The layout decision](/specs/decisions/ui-layout.md) says "The UI MUST adapt to two width classes,
  not to the device, through the theme and never per-view media queries". No container query exists
  in the code. Where a component needs an element's width, it measures with `useWidthOf`, a
  `ResizeObserver` hook, in three places.

### Accessibility, WCAG 2.2

All pages below are W3C "Understanding" pages, and were read.

| Criterion                                                                                                          | Level | What it asks                                                                                                                                                       | Where it bears here                                               |
| ------------------------------------------------------------------------------------------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| [1.4.3 Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)                      | AA    | Text 4.5:1, large text 3:1. Failure F83 covers text over background images without enough contrast.                                                                | Every theme. Glass text over a blurred backdrop.                  |
| [1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)                     | AA    | 3:1 for component boundaries, states, and icons needed to understand, focus indicators included.                                                                   | Status icons, pane borders in glass and terminal looks.           |
| [1.4.1 Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)                                | A     | Colour is never the only means of conveying information.                                                                                                           | Statuses, diffs, priorities, the recommended option.              |
| [2.4.11 Focus Not Obscured (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) | AA    | A focused component is not entirely hidden by author content. It names sticky headers, sticky footers, and non-modal dialogs. Technique C43 uses `scroll-padding`. | A sticky question header, a floating session panel, HUD overlays. |
| [2.4.13 Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html)                       | AAA   | A focus indicator of at least a 2 CSS px perimeter at 3:1.                                                                                                         | Optional target.                                                  |
| [2.3.3 Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)  | AAA   | Motion triggered by interaction can be disabled unless essential. It cites parallax. Technique C39 uses `prefers-reduced-motion`.                                  | The cyber look's parallax and glitch.                             |
| [1.4.10 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)                                           | AA    | Content reflows at 320 CSS px without two-way scrolling. It suggests making sticky sidebars and toolbars static or toggleable at small sizes.                      | Half-screen and phone shells.                                     |

Animation that the page starts by itself also falls under 2.2.2 Pause, Stop, Hide, per the 2.3.3
page. The browser tests emulate `prefers-reduced-motion`
([vite.browser.color-scheme.ts](/packages/web/vite.browser.color-scheme.ts)), and the screenshots
run with reduced motion.

### Accessible reordering

- Atlassian's pragmatic-drag-and-drop guidelines advise against dragging by arrow keys. It is hard
  to follow without sight, JAWS needs a mode switch, and complex moves take many keystrokes. They
  advise a menu on each item with outcomes such as "Move to top". The menu's name should include the
  item. The old and new position are announced in a live region, and focus returns to the trigger
  ([design](https://atlassian.design/components/pragmatic-drag-and-drop/design-guidelines/),
  [accessibility](https://atlassian.design/components/pragmatic-drag-and-drop/accessibility-guidelines),
  both read). Drag handles are at least 24 by 24 px.
- The dnd-kit guide says the keyboard sensor is on by default: Enter or Space picks up and drops,
  arrows move, and Escape cancels. Its live-region texts are English only
  ([read](https://dndkit.com/guides/accessibility)).
- GitHub Projects disables manual reordering while a board is sorted
  ([docs, read](https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/customizing-the-board-layout)).
  Trello users report that sideways scrolling shows one column on a small laptop (snippet only).

### Motion, transparency, contrast, and engine support

From MDN's browser-compatibility data, read on GitHub:

| Feature                                       | Chrome | Firefox            | Safari                            |
| --------------------------------------------- | ------ | ------------------ | --------------------------------- |
| `prefers-reduced-motion`                      | 74     | 63                 | 10.1                              |
| `prefers-contrast`                            | 96     | 101                | 14.1                              |
| `forced-colors`                               | 89     | 89                 | 16                                |
| `prefers-color-scheme`                        | 76     | 67                 | 12.1                              |
| `prefers-reduced-transparency` (experimental) | 118    | 113, behind a pref | Not supported (WebKit bug 175497) |
| `backdrop-filter`                             | 76     | 103                | 18, prefixed since 9              |

- WebKit cannot see `prefers-reduced-transparency`, so the OS Reduce Transparency setting is
  invisible to CSS in Safari. Uraeda's tests and screenshots run in WebKit through Playwright
  ([screenshots.ts](/packages/web/scripts/screenshots.ts)).
- Refraction with `backdrop-filter: url(#svgFilter)` and `feDisplacementMap` works in Chromium only.
  Safari and Firefox render nothing for the `url()` part. `@supports` reports success in Safari, so
  engines must be detected
  ([DEV article, read](https://dev.to/devyatov/liquid-glass-on-the-web-6-ways-to-build-it-with-css-and-svg-3m07),
  [liquid-glass-react, read](https://github.com/rdev/liquid-glass-react)). WebKit bug 313914, filed
  2026-05-02 and still new, says an SVG filter fails inside `foreignObject` in Safari
  ([read](https://bugs.webkit.org/show_bug.cgi?id=313914)).
- A static blur is cheap. A sticky blurred header over scrolling content recomputes every frame, and
  each stacked backdrop adds a compositing pass (DEV article). Animating only `transform` and
  `opacity` keeps animation on the compositor. In the web.dev test, `top` and `left` dropped 50% of
  frames against 1% for `transform` ([web.dev, read](https://web.dev/articles/animations-guide)).
- MDN calls `corner-shape: bevel` experimental: Chrome and Edge 139, Firefox and Safari in preview
  only.
- Astryx's adaptations cover motion and contrast, not transparency. An in-app setting is the only
  way to cover an engine that lacks a media feature.

### Contrast of the mockups' own colours

Measured in this round with the WCAG relative-luminance formula, on the colours the mockups'
stylesheets declare. Which pairs the mockups actually draw was not traced.

| Mockup               | Text tokens on their surfaces                      | Lowest pair                 |
| -------------------- | -------------------------------------------------- | --------------------------- |
| Natural, light       | ink 12.5 to 13.6, ink2 6.8 to 7.4, ink3 4.9 to 5.4 | ink3 on paper, 4.91         |
| Natural, dark        | ink 12.6 to 14.4, ink3 5.6 to 6.4                  | ink3 on card, 5.63          |
| Cyber                | ink 15.8 to 17.9, muted 5.9 to 6.7, dim 4.3 to 4.9 | dim on raised surface, 4.34 |
| Terminal             | text 8.7 to 12.1, sub 5.7 to 7.9, dim 3.5 to 4.9   | dim `o0` on `s0`, 3.54      |
| Glass, light         | ink 14.3 to 16.8, ink3 4.3 to 5.1                  | ink3 on sheet3, 4.30        |
| Glass, dark          | ink 11.7 to 15.6, ink3 4.4 to 5.9                  | ink3 on sheet3, 4.44        |
| Blueprint, cyanotype | ink 9.8 to 12.6, ink3 4.3 to 5.6                   | ink3 on bg3, 4.33           |
| Blueprint, vellum    | ink 11.5 to 14.2, ink3 4.6 to 5.7                  | ink3 on bg3, 4.57           |

- Highlight yellow `#f3b800` on vellum `#f1f4f8` measures 1.63:1, so it cannot carry text there.
  Where the blueprint mockup uses it as text was not traced.
- The author's own palettes, measured the same way: the shop's muted `#9a8fc0` reaches 6.72:1 on its
  background, and its gray-4 `#594775` only 2.46:1. Ghost's label `#565f89` reaches 3.20:1.
  Catppuccin Mocha's overlay0 `#6c7086` reaches 3.36:1, and its subtext0 `#a6adc8` reaches 7.37:1.
  The "comment grey" of every Neovim palette checked fails 4.5:1.
- Among traditional colours, moss `#838A2D` on washi `#FCFAF2` is 3.6:1, so it cannot carry
  text. 千歳緑 `#36563C` on the same paper is 7.9:1.

### Icon sets

Counts are SVG files in each npm tarball. Licences are from the npm registry and the linked
repositories. All were read.

| Set                                                                         | Icons                       | Styles                                    | Licence                                                                                                           | React package                              |
| --------------------------------------------------------------------------- | --------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| [Lucide](https://github.com/lucide-icons/lucide/blob/main/LICENSE)          | 2,167                       | One stroke style                          | ISC, Feather-derived icons MIT                                                                                    | `lucide-react` 1.60.0, 2026-10-20          |
| [Phosphor](https://github.com/phosphor-icons/homepage)                      | 1,512 per weight            | Thin, light, regular, bold, fill, duotone | MIT                                                                                                               | `@phosphor-icons/react` 2.1.10, 2025-05-22 |
| Tabler                                                                      | 5,184 outline, 1,054 filled | Outline, filled                           | MIT                                                                                                               | `@tabler/icons-react` 3.49.0, 2026-10-05   |
| Iconoir                                                                     | 1,383 regular, 288 solid    | Regular, solid                            | MIT                                                                                                               | `iconoir-react` 7.12.1                     |
| [Remix Icon](https://github.com/Remix-Design/RemixIcon/blob/master/License) | 1,539 line, 1,539 fill      | Line, fill                                | Remix Icon License v1.0 (January 2026): free in products, forbids use "as a logo, trademark, or brand identifier" | `@remixicon/react` 4.9.0                   |
| [Material Symbols](https://github.com/google/material-design-icons)         | Not counted                 | Outlined, rounded, sharp, variable axes   | Apache-2.0                                                                                                        | `@material-symbols/svg-400`                |
| [Hugeicons](https://github.com/hugeicons/hugeicons)                         | 6,000+ free of 60,000+      | Ten styles in the full set                | MIT for the free set                                                                                              | `@hugeicons/react` 1.1.10                  |
| Pixelarticons                                                               | 1,036 free                  | 24 by 24 pixel paths, regular and sharp   | MIT for the free set                                                                                              | `pixelarticons` 2.4.2                      |

- Today the app uses Lucide. The neutral theme bundles `lucide-react` and registers 29 semantic
  names. The app hand-copies Lucide outlines into [icons.ts](/packages/web/src/theme/icons.ts) as 53
  named icons: 20 `uraeda:` icons, 28 `uraeda:decision-*` icons, and 5 `uraeda:strength-*` icons.
- No `plus` icon exists in either registry. The sidebar's "＋" rows draw the text character U+FF0B
  (fullwidth plus sign), in [SidebarAdd.tsx](/packages/web/src/SidebarAdd.tsx) line 45. Screenshots
  from the dev shell show an empty box there. The dev shell pins browser fonts to DejaVu, which has
  no glyph at U+FF0B. That cause is inferred from `fc-query` and not reproduced.
- Lucide and Tabler share a 24-pixel grid with a 2 px round-cap stroke, so they mix. Phosphor's
  weights let one set serve several looks. Pixelarticons includes git branch, commit, merge, and
  pull request glyphs.

### Fonts

All faces below were checked as SIL Open Font License (OFL) in the `google/fonts` repository's
`METADATA.pb` files or in their own repositories. All were read.

| Face                                                                        | Role            | Notes                                                                              |
| --------------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------- |
| Fraunces                                                                    | Display serif   | Axes for optical size, weight, softness, and "wonk"                                |
| Newsreader, Source Serif 4, Literata                                        | Reading serifs  | Made for reading, with optical-size axes                                           |
| Instrument Serif                                                            | Display         | One condensed editorial weight                                                     |
| Zen Old Mincho, Shippori Mincho, Noto Serif JP                              | Japanese serif  | For kanji labels                                                                   |
| Inter, Geist, IBM Plex Sans                                                 | UI sans         | Geist is the system face of Nothing OS 4.0 (snippet only)                          |
| JetBrains Mono, IBM Plex Mono, Geist Mono, Iosevka, Maple Mono, Commit Mono | Code and chrome | Commit Mono's site code is MIT and its font OFL                                    |
| Monaspace (Neon, Argon, Xenon, Radon, Krypton)                              | Code and chrome | Five metric-compatible families with "texture healing". The author's terminal font |
| Space Grotesk                                                               | Grotesk         | Swiss look                                                                         |
| Doto, DotGothic16                                                           | Dot matrix      | Variable, and Japanese                                                             |
| iA Writer Duo and Quattro                                                   | Draft editor    | OFL per Fontsource (snippet only)                                                  |

- Berkeley Mono is commercial: a search summary lists a developer licence with commercial use marked
  "No" (snippet only, the shop page returned 403).
- The mockups also load Rajdhani, Figtree, and Barlow Condensed. Their licences were not checked.
- All five mockups load their fonts from Google Fonts at view time. The app's lint and test allow no
  font stylesheet.

### Harness marks and trademarks

A harness is an agent program that Uraeda drives, such as Claude Code. The proposal asks for icons
for Claude Code, Codex, and Pi.

| Harness      | In simple-icons 16.35.0 (CC0 set)                        | In lobe-icons 1.95.1 (MIT)   | Official assets                                      | Rules found                                                                                                                                              |
| ------------ | -------------------------------------------------------- | ---------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code  | `claudecode` in `#D97757`, also `claude` and `anthropic` | `claudecode`, colour variant | No public brand kit found                            | See below                                                                                                                                                |
| OpenAI Codex | None                                                     | `codex`, `openai`            | openai.com/brand returned 403                        | Snippet only: no alteration, no use in own branding, co-branding needs approval. Codex is not named.                                                     |
| Pi           | None                                                     | `pi`                         | A TUI logo in the repository                         | None found                                                                                                                                               |
| Gemini CLI   | `googlegemini` only                                      | `gemini`, `geminicli`        | [Brand kit](https://geminicli.com/brand-kit/) (read) | The rules are in a PDF that was not read. The page says Gemini CLI "was replaced by Antigravity CLI on June 18th, 2026" for unpaid and Google One users. |
| opencode     | `opencode`                                               | `opencode`                   | [Brand page](https://opencode.ai/brand) (read)       | None stated                                                                                                                                              |
| Cursor       | `cursor`                                                 | `cursor`                     | [Brand page](https://cursor.com/brand) (read)        | "Refer to us as Cursor. Not Cursor AI or Cursor Code."                                                                                                   |

- Anthropic's guidelines allow its marks "only as specifically permitted by us and only in materials
  we approve beforehand". They say "No alterations ... (changes to color, font, proportion, or
  otherwise)" ([read](https://www.anthropic.com/legal/trademark-guidelines)).
- The Agent SDK overview allows "Claude Agent" or "{YourAgentName} Powered by Claude". It does not
  permit "Claude Code" naming or "visual elements that mimic Claude Code"
  ([read](https://code.claude.com/docs/en/agent-sdk/overview)). Uraeda's server has no Agent SDK
  dependency, so whether that page applies is open.
- simple-icons says its CC0 licence "doesn't mean to imply that all icons within the project are
  also CC0". It asks users to "seek the correct permissions" (its `DISCLAIMER.md`, read).
  lobe-icons' MIT licence covers its code, and the marks stay their owners'.
- The mockups' harness glyphs are stand-ins in
  [icons.js](/specs/2026-10-20-layout-look/mockups/shared/icons.js): an asterisk of lines for
  Claude, a hexagon for Codex. They are not the official marks, so the mockups alter no Claude Code
  mark.

## The code

Paths are relative to the repository root. The feature that merges chats and changes into one thing,
the session, merges before this one. Its files are on another branch. Its facts are written as code
text such as `2026-10-20-merge-chats:path:line`, and marked "after merge-chats". Line numbers may
drift by one or two.

### Important reads

- [Shell.tsx](/packages/web/src/Shell.tsx) (287 lines): Astryx `AppShell` with a `SideNav`. The
  sidebar resizes between 200 and 480 px, defaults to 280, and saves its width under `uraeda.nav`
  (line 197). It folds to a 48 px rail, or 57.6 px from 1024 px wide. Nothing folds it
  automatically. There is no top bar on wide screens, since the heading lives in the sidebar. On the
  phone, Astryx draws that heading as a top bar.
- [sidebar/Sidebar.tsx](/packages/web/src/sidebar/Sidebar.tsx) (351 lines): Home, "Needs you", Inbox
  and Priorities rows with counts and "＋" buttons, then "Changes", "Features", and "Chats", then
  the five-hour allowance. Each card is a bordered box with a step icon, a status mark, and an
  always-visible "…" menu. After merge-chats, one "Sessions" section replaces the last three. It has
  a "＋ New" row first, and sorts sessions oldest first so rows never jump
  (`2026-10-20-merge-chats:specs/2026-10-20-merge-chats/spec.md:294-295`).
- [layout/SideColumn.tsx](/packages/web/src/layout/SideColumn.tsx) (253 lines): the resizable,
  foldable right column of the session's "Progress" and the spec's "Contents". It is toggled with
  `]`. The token `--size-session-aside` (320 px) is defined and never used.
- [layout/Panes.tsx](/packages/web/src/layout/Panes.tsx) (94 lines): a list plus a detail pane of
  40%, at least 400 px (`--size-pane-min`), on wide screens only. The priority, note, and decision
  details use it.
- [layout/Page.tsx](/packages/web/src/layout/Page.tsx) (84 lines): the centred reading column, 720
  px wide, or 1200 px from 1024 px wide. A session column is 95 characters. Column widths are named
  properties backed by tokens, as [the coherence decision](/specs/decisions/ui-coherence.md) asks.
- [layout/useWidthClass.ts](/packages/web/src/layout/useWidthClass.ts): the one place a component
  learns the width. It returns "narrow" under 768 px and "wide" from it. About 55 call sites use it
  (counted with `rg`).
- [theme/theme.ts](/packages/web/src/theme/theme.ts) (194 lines): the adaptations that multiply
  spacing and sizes by 1.2 from 1024 px wide, and make controls 44 px under a coarse pointer. It
  also holds the local size tokens (lines 128 to 183).
- [theme/icons.ts](/packages/web/src/theme/icons.ts) (482 lines): hand-copied Lucide outlines as 53
  named icons. Lint limits a file to 500 lines, which leaves 18 lines of room. Many more icons, as
  the proposal asks, need a split first, as
  [extract, don't grow](/skills/uraeda/references/code-quality.md#extract-dont-grow) says.
- [Prose.tsx](/packages/web/src/Prose.tsx): the one place reading text is drawn. Seven files still
  set the reading size by hand, on a list in
  [lint.test.ts](/packages/web/src/__tests__/lint.test.ts) lines 80 to 89 that may only shrink.
- [home/HomeHub.tsx](/packages/web/src/home/HomeHub.tsx) (348 lines): four stat tiles, then two
  columns of panels: "Needs you", "Agents at work", "Recently done", priorities, inbox, and
  decisions.
- The clarifications round: [RoundPage.tsx](/packages/web/src/RoundPage.tsx),
  [QuestionCard.tsx](/packages/web/src/QuestionCard.tsx),
  [Question.tsx](/packages/web/src/Question.tsx), and
  [RoundNav.tsx](/packages/web/src/RoundNav.tsx). The context is plain prose with no card. "Why it
  matters" is a muted rounded box that keeps its literal label. A card has two columns when wide and
  roomy, on a token of 840 px. The question header sticks only on the phone. "Ask the agent" leaves
  the page for the session, with the quoted question in the composer. The core splits a question
  into context, "why", and options in [round.rs](/crates/core/src/files/items/round.rs) lines 233
  to 263. It has no special case for an `Example:` line.
- [SessionPage.tsx](/packages/web/src/SessionPage.tsx) (441 lines) and
  [SessionAside.tsx](/packages/web/src/SessionAside.tsx) (381 lines): the session page, its sticky
  composer, and the "Progress" column. At about 960 px, with the sidebar open and the column shown
  by default, the transcript has about 360 px before the page's insets. Sub-agents appear only
  inline in the transcript and in the column.
- [spec/SpecPage.tsx](/packages/web/src/spec/SpecPage.tsx) and its siblings: every part, decision,
  and story is a card when wide and a flat band on the phone. Decision diffs use the core's word
  diff, shown with underline and tint, never a strike, so colour is not the only cue. The "Contents"
  column starts shown only from 1100 px (`SHOWN_FROM` in `SpecContents.tsx` line 219).
- [EditorPage.tsx](/packages/web/src/EditorPage.tsx) and
  [pane/DraftEditor.tsx](/packages/web/src/pane/DraftEditor.tsx): a plain `TextField kind="editor"`
  of 20 rows, with a rendered preview toggle, unsaved text held per field, and the template hints
  under it.
- [feature/FeaturePage.tsx](/packages/web/src/feature/FeaturePage.tsx) and
  [feature/FileList.tsx](/packages/web/src/feature/FileList.tsx): the stage timeline, "Next" and
  agent cards, figures, the files list, and a "Storybook" link in its `Links` (lines 108 to 114).
- [lists/WorkList.tsx](/packages/web/src/lists/WorkList.tsx) (356 lines): the one list under Inbox
  and Priorities. Tones: green ongoing, blue Now, neutral Next and inbox, grey Later, orange
  Blocked. Drag uses `@dnd-kit/react`: the whole row after a 500 ms press on touch, the handle only
  with a mouse, plus keyboard and announcements.
- [server/src/files.ts](/packages/server/src/files.ts): serves mockups, covered under
  [Worth it and feasibility](#worth-it-and-feasibility).
- [index.html](/packages/web/index.html): the page shell, with no font link and no favicon.
- Tests and tools: browser tests run only at a phone, 402 by 874, and a desktop, 1440 by 900, in
  WebKit ([vite.browser.config.ts](/packages/web/vite.browser.config.ts) lines 467 to 476). Other
  tests cross 768 px at 700 and 800 px, and run at 1024 and 1200 px. No layout or accessibility
  check runs between 768 and 1023 px. [screenshots.ts](/packages/web/scripts/screenshots.ts) takes
  each view at both sizes in both themes. The [sandbox](/packages/web/sandbox/main.ts) runs the real
  app over sample projects and a fake agent. There are 22 story files with 70 stories. Their
  "Mockups/…" titles show how design variants are named.
- History: 646 commits touch `packages/web`. Each redesign feature from 2026-10-16 to 2026-10-19
  redid one view in its own pass. That matches the proposal's "grew view by view" (from `git log`).

### The proposal's path and existing actions

The proposal's user path is the sequence of views. For each, this is today's behaviour:

- **Shell.** Home, the Inbox draft through a "＋" button, New, running sessions, in-progress
  features, and the allowance are all reachable. The "＋" glyph shows as an empty box in the dev
  shell (see [Icon sets](#icon-sets)). No shortcut opens the quick-add forms. The hotkeys are `[`
  and `]` for the columns, and `n` and `p` in a round. When folded, the rail shows only rows with an
  icon.
- **Home.** Stat tiles and panels. After merge-chats, the lists read from the merged sessions.
- **Inbox.** One list per category, drag between categories, a note pane beside the list on wide
  screens, and "Organize with an agent". A note offers "Make a draft", "Move to priorities", and
  "Add to a draft". After merge-chats, "Start the change" on a note opens the New page.
- **Priorities.** A grouped list. "Ongoing" is derived on the client from running features. The file
  holds Now, Next, Later, and Blocked. A drag writes `priorities.move` against the hash the drag
  started from.
- **Feature home.** Described above. One page serves a change and a feature.
- **Proposal and discovery.** `DocumentPage` draws the core's document tree. Only a proposal has an
  Edit button.
- **Clarifications.** An answer saves on a tap. A comment saves on its button or Ctrl or Cmd plus
  Enter. Submit flushes pending saves.
- **Spec, plan, and data model.** The spec has the Contents column and cards. The plan review page
  draws blocks that can be tapped for comments. The data model is a "Data" group of the spec.
- **Session.** The transcript draws the latest 20 messages, with "Show earlier messages". The
  composer is sticky, with a jump to the latest message and a screen-reader announcer. The
  bounded-mounting rule of [the behaviour decision](/specs/decisions/ui-behaviour.md) must survive
  any new session surface.
- **New.** After merge-chats, one `/new` page has a segmented control for session, change, and
  feature, and a sentence for each. The three kinds differ only by the control and one sentence. The
  picker is a flat list of "Inbox · text" rows with one identical button each (from the merge-chats
  screenshots).
- **Decisions and constitution.** A list of principle cards and decision rows, with a pane beside it
  on wide screens. Sort is kept in the browser. There is no search or filter field today. The
  proposal asks for one.
- **Settings.** Server, Appearance, and Sign-in categories. Agents, Runs, and Reviews are
  placeholders. Appearance holds the theme mode, system, light, or dark, stored as `uraeda.theme`.

Existing actions that meet a visual pass:

- **Stored layout state.** The browser keeps `uraeda.nav`, `uraeda.column`, `uraeda.sessionAside`,
  `uraeda.specContents.width`, `uraeda.theme`, and the position per round. A new shell that reuses a
  key with a different meaning would read stale values. Fold state also lives in the history entry.
- **Back and overlays.** Each open overlay pushes a history entry, and Back closes it, through
  `useBackCloses`. A session surface that is an overlay or a sheet must use the same hook. The
  layout decision says "An open detail, tab, or sheet MUST be in the URL". The behaviour decision
  says Back keeps the reader's place.
- **Reordering.** `@dnd-kit/react` already has a keyboard sensor and announcements. Menu actions
  beside the drag handle, such as "Move to top", exist only partly: the pane has a Section control.
- **Sandbox and screenshots.** Both hold fixed views. A new view needs a sample and a name in each.
- **Notifications.** The tab title counts items, and a banner asks for permission. Their placement
  moves with the shell.
- **Text carried into the composer.** After merge-chats, `?ask=<quote>` and `?continue=` carry text
  into the composer from a round or a review. A session surface beside a document would reuse them.

Features in flight that overlap, from the open branches and their specs:

- **Merge chats and changes** rewrites the shell, sidebar, session page, New page, feature page, and
  routes. This feature starts from the merged result. The merged spec fixes that "every card of the
  Sessions section has its status and its '…' at the same horizontal position"
  (`2026-10-20-merge-chats:specs/2026-10-20-merge-chats/spec.md:283-284`). A new sidebar must keep
  or amend that.
- **Fix testing** culls tests. Its spec says "Ready keeps the required page matrix and Storybook
  build; stories do not become tests"
  (`2026-10-19-fix-testing:specs/2026-10-19-fix-testing/spec.md:48`). A new width size would add a
  size to that matrix.

### Rules and their owners

| Rule                              | Owner                                                                             | Copies                                                                                                                                                                                                                                                                                                                     |
| --------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Narrow under 768 px, wide from it | [useWidthClass.ts](/packages/web/src/layout/useWidthClass.ts)                     | [SpecContents.tsx](/packages/web/src/spec/SpecContents.tsx) shows its column from 1100 px. [Blocks.tsx](/packages/web/src/Blocks.tsx) lines 150 to 158 reads `window.innerWidth`. The theme multiplies sizes from 1024 px. A token fixes the round's two-column split at 840 px. Three components measure their own width. |
| Reading size, line, and measure   | [Prose.tsx](/packages/web/src/Prose.tsx)                                          | Seven files set the size by hand, on a list that only shrinks.                                                                                                                                                                                                                                                             |
| Colours and sizes                 | The theme, [theme.ts](/packages/web/src/theme/theme.ts)                           | None allowed: lint rejects raw values.                                                                                                                                                                                                                                                                                     |
| Which stylesheets load            | [lint.test.ts](/packages/web/src/__tests__/lint.test.ts) lines 59 to 78           | The allowlist of three.                                                                                                                                                                                                                                                                                                    |
| Icons                             | The neutral theme's 29 and [icons.ts](/packages/web/src/theme/icons.ts)'s 53      | The "＋" glyph is typed as text in five files, including `SidebarAdd.tsx` and `sidebar/Row.tsx`.                                                                                                                                                                                                                           |
| A step's icon and a status's mark | [sidebar/StepIcon.tsx](/packages/web/src/sidebar/StepIcon.tsx)                    | The home panels and the `WorkList` tones draw their own marks.                                                                                                                                                                                                                                                             |
| The five-hour usage window        | [claude-events.ts](/packages/server/src/runner/claude-events.ts) lines 164 to 189 | The UI reads `agent.fiveHourLimit` and draws `Allowance.tsx`, for Claude only.                                                                                                                                                                                                                                             |
| Theme mode                        | [theme.tsx](/packages/web/src/theme.tsx)                                          | Settings > Appearance, and browser tests that emulate the colour scheme.                                                                                                                                                                                                                                                   |
| The colour of a feature           | `crates/core/src/repositories.rs`                                                 | Copies across the binding, server, and web. Merge-chats removes all of them.                                                                                                                                                                                                                                               |

### Likely changes

- [`theme/theme.ts`](/packages/web/src/theme/theme.ts) and `theme/built/`: new colour tokens (light
  and dark pairs), radii, motion, and type scale, under every option of
  [the visual direction](#the-visual-direction). A dark-only direction drops the light half of each
  pair, per [colour modes](#colour-modes).
- [`theme/icons.ts`](/packages/web/src/theme/icons.ts): more icons and a plus icon, under every
  option of [the icon set](#icon-set). It splits first, because of the 500-line limit. A second icon
  set adds a dependency.
- [`index.html`](/packages/web/index.html) and `public/`: a favicon, per [the logo](#logo), and
  fonts, per [dependencies and fonts](#dependencies-and-fonts).
- [`Shell.tsx`](/packages/web/src/Shell.tsx) and [`sidebar/`](/packages/web/src/sidebar/): the shell
  pattern, under each option of [mixing directions](#mixing-directions). A second usage window needs
  the server to read the weekly window from Claude Code, and an equivalent for other harnesses.
- [`layout/useWidthClass.ts`](/packages/web/src/layout/useWidthClass.ts),
  [`SideColumn.tsx`](/packages/web/src/layout/SideColumn.tsx),
  [`Panes.tsx`](/packages/web/src/layout/Panes.tsx), and
  [`Page.tsx`](/packages/web/src/layout/Page.tsx): with option B or C of
  [width classes](#width-classes). Option A changes the column defaults only.
- [`home/HomeHub.tsx`](/packages/web/src/home/HomeHub.tsx): the home centrepiece, under
  [mixing directions](#mixing-directions). A bonsai, branch map, keyed menu, rings, or process plan
  is computed from the workspace's features, which the client already holds.
- [`RoundPage.tsx`](/packages/web/src/RoundPage.tsx),
  [`QuestionCard.tsx`](/packages/web/src/QuestionCard.tsx),
  [`Question.tsx`](/packages/web/src/Question.tsx), and `RoundOpening.tsx`: the reading treatment of
  context, "Why it matters", examples, and "Check these", under every direction. A distinct look for
  Examples needs the core's `question_blocks` to mark them. That is a small core change beyond
  "almost only UI".
- [`SessionPage.tsx`](/packages/web/src/SessionPage.tsx) and `SessionAside.tsx`, plus a new session
  surface: under each option of [the session beside a document](#the-session-beside-a-document).
- [`EditorPage.tsx`](/packages/web/src/EditorPage.tsx) and `pane/DraftEditor.tsx`: under
  [the split](#the-split), a CodeMirror editor, an Atomic Editor wrapper, or the same text field
  with a preview toggle and image paste.
- [`feature/FileList.tsx`](/packages/web/src/feature/FileList.tsx): the Storybook link goes
  ([Needs no choice](#needs-no-choice)), and the files list gets its new look.
- [`lists/WorkList.tsx`](/packages/web/src/lists/WorkList.tsx), `PrioritiesList.tsx`, and
  `InboxPage.tsx`: the list look, category management, and menu actions beside dragging, under
  [priorities layout](#priorities-layout).
- [`decisions/`](/packages/web/src/decisions/): a search and filter, and principle plates.
- `NewPage` (after merge-chats, `2026-10-20-merge-chats:packages/web/src/NewPage.tsx`): three
  visually distinct options and a picker overlay.
- `**/*.stories.tsx`, `packages/web/sandbox/`, `packages/web/samples/`, and
  [`screenshots.ts`](/packages/web/scripts/screenshots.ts): stories and screenshots of the picked
  direction, at the sizes the width option picks.
- The decisions [ui-layout](/specs/decisions/ui-layout.md), [preview](/specs/decisions/preview.md),
  [stack](/specs/decisions/stack.md), and [ui-components](/specs/decisions/ui-components.md): a
  change to each, or none, depending on [width classes](#width-classes),
  [prototypes in the workflow](#prototypes-in-the-workflow), [the split](#the-split), and
  [dependencies and fonts](#dependencies-and-fonts).
- The skill, under [prototypes in the workflow](#prototypes-in-the-workflow):
  [discovery.md](/skills/uraeda/references/discovery.md) (visual questions),
  [spec.md](/skills/uraeda/references/spec.md) (mockups), their templates under
  `skills/uraeda/assets/templates/specs/`, and the example under
  `skills/uraeda/assets/example/specs/`. A change to a step touches its reference, its template, and
  the example together, as [AGENTS.md](/AGENTS.md) says.
- `specs/2026-10-20-layout-look/mockups/`: the five directions, `compare.html`, and `logos.html` are
  the investigation's artefacts, not shipping code.

## The proposal

### The proposal says "almost only UI", while the capabilities users expect add behaviour

The constraint reads "Almost only UI: minimal core and server changes, and no new operational
concept." Several things need more than UI:

- A second usage window, the weekly one, and a window for harnesses other than Claude Code. The
  server reads only `five_hour`, from Claude Code's events
  ([claude-events.ts](/packages/server/src/runner/claude-events.ts) lines 164 to 189). The
  proposal's "5h limit of provider" reads as one window.
- A distinct look for "Examples" in a question. The core does not mark an `Example:` line, so it
  lands in the question's context as a paragraph ([round.rs](/crates/core/src/files/items/round.rs)
  lines 233 to 263).
- A command palette, a keyed start menu, and keyboard triage. These are behaviour, and keyboard
  navigation has its own item in the priorities.
- A diff or file panel beside the session, a peek mode for items, and snooze or pin. The proposal
  names only a filter and search on decisions.
- A usage burn-rate line, and a "reduce effects" setting. Both are new settings or computed data.

A gap about scope is always a question. The capabilities that are only UI are settled inside the
topics under [Approaches](#approaches). The rest get one line each under
[Needs no choice](#needs-no-choice), pointing here.

### The preview decision requires Storybook mockups, and the proposal asks for throwaway prototypes

[The preview decision](/specs/decisions/preview.md) says "Mockups and named states of views MUST be
stories written with the real components, next to them". It lists a static preview task among the
rejected alternatives. [The sandbox decision](/specs/decisions/sandbox.md) says variants SHOULD stay
stories. The proposal says the prototypes "could be raw HTML, or even image generation", and are
"investigation, not code to keep".

The skill's spec reference allows static HTML or images only "without" an active preview decision
([spec.md](/skills/uraeda/references/spec.md) lines 290 to 315). Its discovery reference allows
visual questions only as story exports ([discovery.md](/skills/uraeda/references/discovery.md) lines
417 to 445). So this round's five HTML mockups run against an active decision.

Constitution principle I says conflicts "MUST be resolved explicitly by a human". The human's own
request here, throwaway HTML, stands above the decision, per [AGENTS.md](/AGENTS.md). What is left
is what the workflow says from now on, in [prototypes in the workflow](#prototypes-in-the-workflow).

### The stack decision forbids parsing markdown in the UI

[The stack decision](/specs/decisions/stack.md) says "The web UI MUST draw workflow files from the
core's document tree, never parsing their markdown." A proposal editor with a live preview parses
markdown in the browser, whether it is WYSIWYG or CodeMirror decorations. The proposal asks for "a
GOOD editor for proposals". It offers "keep it being a big text input" if the work is too much.

Whether editing a proposal's text counts as "drawing a workflow file" is a ruling for the human. The
measured table under [Markdown editors](#markdown-editors-and-whether-the-file-survives) shows that
only text-buffer editors keep the file as written.

### The layout decision fixes two width classes, and half a screen falls between them

[The layout decision](/specs/decisions/ui-layout.md) says "The UI MUST adapt to two width classes,
not to the device, through the theme and never per-view media queries". It also says a view's spec
shows "mockups at both width classes".

The proposal wants the shell to "get out of the way", particularly "on half widescreen". It says the
layout "breaks in places, such as at half a screen's width".

Half of a 1920 px display is about 960 px. That is wide under the decision's rule, and under the
theme's 1024 px step that multiplies sizes. By arithmetic from the code, the transcript has about
296 px of text at 960 px with both columns open. The list beside a detail pane has about 216 px.

All five mockups were written without that constraint. Each adapts at about 1000 to 1180 px with its
own media queries: natural at 1000, cyber at 1280 and 1000, terminal at 1100 and 860, glass at 1100,
and blueprint at 1180 and 1000. That is per-view media queries, which the decision forbids. No
layout or accessibility check runs between 768 and 1023 px today.

### The feature colour is already removed

The proposal asks to "Remove the color option on features". The merge-chats spec says "The colour of
an item's settings goes" (`2026-10-20-merge-chats:specs/2026-10-20-merge-chats/spec.md:241-243`).
Its plan removes the colour from the core, binding, server, and web. Nothing is left for this
feature once that merges. If this feature starts first, the removal still reaches every layer.

### The Storybook link on the feature home is one of several ways in

The proposal says "Remove the storybook access though, it does not really work", under the feature
home. The link is in the files list's links ([FileList.tsx](/packages/web/src/feature/FileList.tsx)
lines 108 to 114). Storybook is also offered in the session's Progress column, in story links in
documents, and as "Open in Storybook" on each embedded story. The active preview decision relies on
Storybook embeds in specs and rounds, so removing all access conflicts with it. The wording most
likely means the feature home only. That is a one-line change under
[Needs no choice](#needs-no-choice).

### The chat disappears, and the session takes its place

The proposal's shell lists "New session/CF", "Running sessions", and "In-progress CF", and describes
a session page. After merge-chats, "The word 'chat' leaves the UI: a chat is a session without a
workflow" (`2026-10-20-merge-chats:specs/2026-10-20-merge-chats/spec.md:63-64`). A change or a
feature holds one or more sessions. The sidebar has one "Sessions" section instead of Changes,
Features, and Chats.

So "Running sessions" and "In-progress CF" become two views of one list. The shell design must
decide whether they stay two groups. The merged spec also fixes that every row has its status and
its "…" at the same horizontal place.

### Keyboard navigation is a separate item

[PRIORITIES.md](/specs/PRIORITIES.md) lists "Keyboard navigation in web UI" under Next. It names
"Leader-key inspired nav and/or vimium for extra links" and "Vim mode in text editing? -> depends on
how much complexity it adds". The terminal direction is built on keys, and in the mockup the keys
are look-only. The README says so.

[The behaviour decision](/specs/decisions/ui-behaviour.md) requires that every action works by tap
and by keyboard. It also requires that lists share one keyboard behaviour. So a keyed look cannot
replace visible controls. A vim mode in the proposal editor would be settled with that item, or
earlier if a CodeMirror editor is chosen.

### "The prototypes are then deleted", and the spec's mockups

The proposal says the spec "writes the chosen direction down" and that "the prototypes are then
deleted". The skill's spec step keeps the picked variant's export and deletes the others
([spec.md](/skills/uraeda/references/spec.md) lines 303 to 305). The layout decision asks for
mockups at both width classes in a view's spec. Constitution principle II says "Workflow state,
decisions, and design changes MUST be stored as plain text in git". Screenshots are committed under
[the checks decision](/specs/decisions/ui-checks.md).

What of a picked direction stays in git is therefore a choice: the mockup, its screenshots, or only
the spec's words and tokens. It is covered in
[prototypes in the workflow](#prototypes-in-the-workflow).

### The usage limit is for one provider

The proposal says "5h limit of provider", and asks for icons for Claude Code, Codex, and Pi. Only
Claude Code reports a five-hour window today. Codex shows percent left where Claude shows percent
used. The widget's look has to cope with a missing window, per
[Usage-limit widgets](#usage-limit-widgets). The mockups draw only Claude's window.

## Worth it and feasibility

**Cost against gain.** The gain is what the proposal states: a UI that looks finished and memorable
before version 1.0.0, and a layout that holds at half a screen. The cost is large for a "visual"
pass. The app has about 236 source files, and 100 of them import StyleX. A new shell, home, session
surface, and reading treatment each touch shared components that every page uses.
[The coherence decision](/specs/decisions/ui-coherence.md) makes that both easier and harder. A
direction that changes the icon set, the fonts, and the width classes adds dependencies and a
decision change on top. Each changed view also needs screenshots at both sizes in both themes, as
the checks decision requires. The proposal says polish left over is "a batch of small changes". This
evidence does not show whether cost outweighs gain. The proposal's own smaller first pass is under
[the split](#the-split).

**Outside behaviour relied on.**

| Behaviour                                                              | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The mockups open inside Uraeda's sandboxed mockup frame                | Not verified end to end. The server serves a file in any `mockups` folder, at any depth. It sends `content-security-policy: sandbox allow-scripts` and `referrer-policy: no-referrer` ([files.ts](/packages/server/src/files.ts) lines 83 to 126). Its type map covers `html`, `js`, and `css`. The UI's mockup page matches exactly one name segment, so `natural/index.html` has no page of its own ([routes.tsx](/packages/web/src/routes.tsx) lines 125 to 127). The core reads a file outside a feature's checkout only when it is tracked ([files.rs](/crates/core/src/api/files.rs) lines 33 to 55). Whether an uncommitted `mockups` folder is served was not tested. Nothing was run inside the frame. |
| The mockups work in a frame that has scripts but no same-origin access | Partly checked. A grep shows no `localStorage`, `sessionStorage`, or cookie use in the mockups, which would throw in an opaque origin. Relative script paths such as `../shared/data.js` stay inside the `mockups` folder. Whether Google Fonts load in the frame was not tested.                                                                                                                                                                                                                                                                                                                                                                                                                               |
| The mockups render in WebKit                                           | Not verified. The README says they were checked in Chromium, not in Safari or Firefox. Uraeda's own tests and screenshots run in WebKit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Blur-and-saturate glass in WebKit                                      | Documented: `backdrop-filter` is in Safari 18, and prefixed since Safari 9. The glass mockup uses blur and saturation only. Refraction works only in Chromium, so the mockup has none. Not tested in WebKit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| The OS "Reduce transparency" setting in WebKit                         | Documented as unsupported: WebKit has no `prefers-reduced-transparency`. The glass mockup holds a rule for it that never fires there.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Astryx's `BottomSheet` as a non-modal panel on a desktop               | Its documentation covers the non-modal form and snap points. It calls the sheet a mobile touch sheet and does not describe desktop use. Not tested.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Astryx's `CommandPalette` and `Resizable` for the shapes needed        | The components exist. Not tested against the needs here.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| A self-hosted font under the lint and the stylesheet allowlist         | Not tested. The allowlist test would reject a fourth stylesheet.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| StyleX 0.19.1 container queries and keyframes under the app's lint     | Not checked. The app uses neither today.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| A CodeMirror editor styled with the theme's tokens                     | Not tested.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

**Guards relaxed.** No option as written loosens a security guard. The mockups load fonts from
Google Fonts, an external request that the app itself does not make. In plain words: Google's
servers learn that a viewer's browser asked for those fonts, and from which address. The mockup
responses carry `referrer-policy: no-referrer`, so the page's address, which holds the frame secret,
is not sent along. Self-hosted fonts in the app would remove that request.

## Approaches

Criteria come from the following sources, and every table uses the same ones within its topic.

- [The proposal](proposal.md): reading and hierarchy first, the shell yielding on half a screen, a
  look that is distinct and memorable, and "almost only UI".
- [The constitution](/specs/CONSTITUTION.md): principle II (design changes stored as plain text in
  git) and principle VI (simple code, checks that do not go up, a justified new abstraction).
- Active decisions: [layout](/specs/decisions/ui-layout.md),
  [components](/specs/decisions/ui-components.md), [coherence](/specs/decisions/ui-coherence.md),
  [behaviour](/specs/decisions/ui-behaviour.md), [checks](/specs/decisions/ui-checks.md),
  [stack](/specs/decisions/stack.md), [preview](/specs/decisions/preview.md), and
  [toolchain](/specs/decisions/toolchain.md).
- WCAG 2.2, marked "WCAG" where it is the source of a criterion: see
  [Accessibility, WCAG 2.2](#accessibility-wcag-22).

A cell marked "judgement" is this round's own reading, not a sourced fact.

### The split

This topic is whether one feature carries the whole design pass, or part of it moves to its own
feature. It relies on [Markdown editors](#markdown-editors-and-whether-the-file-survives),
[The proposal](#the-stack-decision-forbids-parsing-markdown-in-the-ui), and
[Worth it and feasibility](#worth-it-and-feasibility).

The spec's split rule, from [writing.md](/skills/uraeda/references/writing.md) rule 33, is: "past 6
stories, 30 scenarios, or 2 changed decisions, the discovery proposes a split". The reason it gives
is that a larger spec cannot be approved in one sitting. The thresholds count stories and scenarios
of the spec and the decisions it changes, so counts below are judgement until a spec exists.

| Option                                                                                                                                  | Decisions likely changed (judgement)                                                                                 | Stories (judgement)                                                                                                                       | Fit with "one pass, decided together"                                                                                        | Review in one sitting                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| A. One feature for the whole pass, with the editor as a plain text field plus the existing preview toggle (the proposal's own fallback) | Layout (a third class, or none), preview (prototype rule), components (fonts or libraries). Stack unchanged. Up to 3 | One per view group: shell, home, lists, feature home, reading pages, session, New, decisions, settings, identity. Over the threshold of 6 | Full                                                                                                                         | A spec near the limit of a sitting, and a split is proposed by rule 33 |
| B. One feature for the pass without a new editor, and the proposal editor split out as its own feature                                  | This one: layout, preview, components. The editor feature: stack, and components for a dependency                    | This one: same as A. The editor feature: about 3                                                                                          | Editor taken out, as the proposal allows                                                                                     | This one is as in A, the editor is small and separate                  |
| C. Several features: identity and shell, then reading pages, then lists and home, then the editor                                       | Each feature changes one or two. The first changes the most (layout, components, preview)                            | 2 to 5 each                                                                                                                               | Visual identity decided before views, as the proposal's "decided together" asks for. Views then follow in separate approvals | Each fits a sitting                                                    |

Notes. The mockups decide direction for all views at once, so the direction question is asked once
whatever option is chosen. In option C, the later features inherit a direction and its tokens and
have no choice left on look. Under option A, a feature this size has no precedent in the
repository's history: the `redesign-*` features each redid one view.

### The visual direction

This topic is which of the five directions the UI takes as its base look. It relies on
[Apple Liquid Glass](#apple-liquid-glass),
[Japanese design and the author's own sites](#japanese-design-bonsai-vocabulary-and-the-authors-own-sites),
[Game UIs and terminal UIs](#game-uis-and-terminal-uis),
[Motion, transparency, contrast, and engine support](#motion-transparency-contrast-and-engine-support),
[Contrast of the mockups' own colours](#contrast-of-the-mockups-own-colours), and
[the astryx levers](#astryx-components-and-theme-levers).

All five are in `mockups/`, over the same data. Each view is a link inside its shell. Contrast
ratios are those measured on the mockup's own tokens. Breakpoints are the mockup's own media
queries.

| Option                                                               | Traits and risk for long reading                                                                                                                                                                                                                  | Contrast (measured)                                                                                                                              | Light and dark                                                             | Half-width behaviour (960 px)                                                                                                               | Effort in StyleX and Astryx                                                                                                                                                                            |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A. [Natural](/specs/2026-10-20-layout-look/mockups/natural.html)     | Washi paper, moss, bark, serif reading column, leaf-shaped corners, grain. Illustration only on the home, as the Japanese-design sources warn against ornament elsewhere. Lowest risk for reading (judgement)                                     | Text 4.76 to 13.6 in light, 5.63 to 14.4 in dark. A traditional moss `#838A2D` cannot carry text (3.6:1), so the mockup darkened it              | Both, with a day and night switch                                          | No sidebar, so content keeps the full width. Adapts at 1000 and 720 px                                                                      | Three font families, a grain background, a custom bonsai drawing from workspace data, a bottom dock instead of the `SideNav`, leaf radii as tokens                                                     |
| B. [Cyber](/specs/2026-10-20-layout-look/mockups/cyber.html)         | The author's palette, chamfered panels, scanlines, glitch on titles, parallax layers following the pointer. Highest risk: ZZZ and Cyberpunk critiques of effects and ultra-bold type. Panels stay flat for text                                   | Text 4.58 to 17.9. Neon green is 15.8:1, loud as text                                                                                            | Dark only                                                                  | The right column folds away at 1280 px, then single column at 1000 px. Parallax needs room, and the sources say to flatten it at this width | Chamfers by `clip-path` or `corner-shape` (experimental), keyframes for glitch, a pointer-driven parallax with a motion off-switch (WCAG 2.3.3), `prefers-contrast` removing effects as in the mockup  |
| C. [Terminal](/specs/2026-10-20-layout-look/mockups/terminal.html)   | Catppuccin Mocha, monospace chrome with proportional prose, titled panes, tab line, status line. Keys are look-only here. Text at 80 characters shows fewer words per line. Box-drawing as text reads badly to screen readers, so borders are CSS | Text 4.56 to 12.1. The first draft's dim `o0` on `s0` was 3.54:1, which fails 4.5:1 for small text, so it was raised                             | Dark only in the mockup. The palette has a light sibling, Latte, not drawn | Side panes fold at 1100 and 860 px, and the picker's preview pane hides                                                                     | A monospace font family, border-with-title panes as a component, a status line and tab line replacing the shell, an overlay picker. Visible controls for every key, as the behaviour decision requires |
| D. [Glass](/specs/2026-10-20-layout-look/mockups/glass.html)         | Liquid Glass on chrome only, opaque reading sheets, rings on the home. Follows Apple's own rule not to use glass in the content layer. The Nielsen Norman critique applies to chrome over text                                                    | Text 4.57 to 16.8 in light, 4.55 to 15.6 in dark. Glass over a moving wallpaper changes with the backdrop, so the ratio is a range, not a number | Both. Follows the system theme, with a switch                              | The sidebar becomes an icon column at 1100 px, the inspector hides, and the session sheet has three detents                                 | A translucent layer needs a reduced-transparency path, which Astryx's adaptations lack and WebKit cannot detect. Blur costs repaint on a sticky header. No refraction, which only Chromium has         |
| E. [Blueprint](/specs/2026-10-20-layout-look/mockups/blueprint.html) | Drawing sheets, a title block, numbered callouts for questions, revision clouds on changed decisions. Reading column is a serif. Fit for specs and plans is this round's judgement                                                                | Text 4.65 to 12.6 on cyanotype, 4.57 to 14.2 on vellum. Yellow `#f3b800` on vellum is 1.63:1, so it cannot carry text                            | Both: cyanotype and vellum                                                 | The drawing list folds to labels at 1000 px and the notes column becomes an overlay at 1180 px                                              | A drafting grid from gradients, line weights as tokens, a title block as a shared footer, revision clouds as an SVG overlay on the decision diff, a different shell from today's                       |

Notes.

- The author's own sites already separate effects from prose: effects on the splash only, a
  proportional body, mono for chrome. The cyber and terminal mockups follow that.
- The mockups were made by hand in plain HTML and CSS, with no lint. A StyleX version has to express
  each effect through tokens and `stylex.create`, with no raw values except through `var(--…)`.
  Which effects fit that lint was not checked.
- Every direction handles the five items of the shell differently.
  [Mixing directions](#mixing-directions) lists them.

### Mixing directions

This topic is whether one direction carries everything, or a part comes from another. It relies on
[The visual direction](#the-visual-direction),
[the coherence decision](/specs/decisions/ui-coherence.md), and
[the graphs, traces, and home pages](#graphs-traces-and-home-pages-that-stand-out).

The parts a mix could swap, and what each direction draws for them, from the
[mockups' README](/specs/2026-10-20-layout-look/mockups/README.md):

| Part                       | Natural                                                                      | Cyber                                                           | Terminal                                      | Glass                                                           | Blueprint                                                                       |
| -------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Shell pattern              | Floating bottom dock, no sidebar                                             | Left icon rail, top bar, bottom dock of running work            | Tab line on top, status line at the bottom    | Floating glass sidebar and toolbar, bottom tab bar on the phone | Drawing list on the left, tab bar, title-block footer                           |
| Home centrepiece           | A bonsai, branches are features, blossoms where you are needed               | A branch map with eight ticks per feature                       | A keyed start menu with a pixel bonsai        | Fitness-style rings and widgets                                 | A process plan with diamonds at each step                                       |
| Questions and spec reading | One centred serif column, callouts for goal, why it matters, and the example | Alert block, goal panel, sticky headers, chamfered option cards | Outline pane, cards, session as a split below | Opaque sheets, glass bar with question pills                    | Numbered callouts with leader lines, goal in a large italic serif, notes column |
| Session surface            | Bottom sheet                                                                 | "Comm link" panel from the right                                | Terminal split below                          | Sheet with three detents, opaque at full height                 | Notes column on the right                                                       |
| New page                   | A seed, a sprout, and a tree                                                 | Three tall cards in cyan, violet, green                         | A picker overlay with a preview               | Three big gradient cards                                        | Three sheet sizes                                                               |

| Option                                                     | Coherence (decision)                                                     | Tokens carry it                                         | Effort                    | Risk (judgement)                                        |
| ---------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------- | ------------------------- | ------------------------------------------------------- |
| A. One direction throughout                                | One look everywhere                                                      | Yes                                                     | The direction's own       | None from mixing                                        |
| B. One shell and chrome, another direction's reading pages | The reading pages are the shared components, so they change in one place | Partly: two palettes, or one palette with two type sets | Two directions' work      | A reader who sees chrome and content in different moods |
| C. One direction's home centrepiece on another's shell     | The home is one page, drawn by shared panels                             | Yes, if colours map                                     | Home's own component only | A home that does not match its shell                    |
| D. Direction per part, any combination                     | Information kinds still use one component each                           | Only if tokens are shared across parts                  | Highest                   | Most likely to look assembled                           |

A home centrepiece must be deterministic to carry meaning. Every source that draws work as a graph
warns that a random layout is a hairball, such as Obsidian's graph. The mockups' bonsai and branch
map place a branch by data (a feature's step and priority), and that placement rule was not verified
against real workspace data.

### The session beside a document

This topic is where a person asks the session a question from a clarifications, spec, or plan page,
and reads the answer. It relies on [Astryx components](#astryx-components-and-theme-levers),
[WCAG 2.4.11](#accessibility-wcag-22),
[Width classes](#width-classes-window-classes-and-container-queries), and the proposal's wording "a
modal/overlay, or come from the bottom, or be a floating panel from the right".

Today, "Ask the agent" leaves the page and opens the session with the quoted text in the composer
(`web/sessions.ts`, `?ask=`). The proposal says reading the answer must not be "cramped in a small
side panel". Apple's guidelines say to use a panel when people repeatedly give input and watch
results, and a sheet for a scoped task. Material 3 calls a coplanar side sheet "not recommended for
narrow screens". WCAG 2.4.11 names sticky footers and non-modal dialogs as what hides focus, so each
overlay form needs `scroll-padding` at least its height.

| Option                                                    | Keeps the question visible                                     | Half-width (960 px)                                                                      | Layout and behaviour decisions                                                                                   | WCAG 2.4.11                                                               | Astryx support                                                                         |
| --------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| A. A right panel, resizable and foldable                  | Yes, beside the page                                           | Takes 30 to 40% of 960 px, or replaces the page below the medium class (Material's rule) | A column that takes room SHOULD be foldable and resizable, which fits. The column already exists as `SideColumn` | Beside, not over: no obscuring                                            | `Resizable`, `Layout`, `SideColumn` exist                                              |
| B. A bottom sheet with detents, non-modal                 | Yes at half height, hidden at full                             | Works at any width. Wide screens use dialogs and popovers by the decision                | A sheet on wide screens departs from the rule that wide screens use popovers and dialogs                         | A non-modal sheet needs `scroll-padding-bottom` equal to its height       | `BottomSheet` has snap points and a non-modal form, documented as a mobile touch sheet |
| C. A floating overlay panel from the right (modal or not) | A modal hides it. A floating non-modal panel covers part of it | Covers the page at 960 px                                                                | A popover or dialog on wide screens, as the decision says                                                        | A modal passes by construction. A floating non-modal needs scroll padding | `Dialog`, `Popover`, `Overlay` exist                                                   |
| D. A separate page (today)                                | No, the page is left                                           | No problem                                                                               | A view the human follows SHOULD be a page of its own                                                             | Not applicable                                                            | Exists                                                                                 |
| E. A split below, terminal style                          | Yes, above the split                                           | Both halves are small at 960 px                                                          | Neither a sheet nor a dialog                                                                                     | The split's sticky header needs padding                                   | `Layout` could, unverified                                                             |

The mockups draw A (cyber's comm panel and blueprint's notes column), B (natural's sheet and glass's
detents), and E (terminal). Whether the session's bounded-mounting rule holds in each was not
tested. The URL must carry the open state (decision rule), and Back must close it through
`useBackCloses`.

### Width classes

This topic is how the UI treats the range between 768 px and about 1200 px, where half a screen
sits. It relies on
[Width classes, window classes, and container queries](#width-classes-window-classes-and-container-queries),
[the layout decision in the proposal](#the-layout-decision-fixes-two-width-classes-and-half-a-screen-falls-between-them),
and [Rules and their owners](#rules-and-their-owners).

Facts: the theme already has two steps, at `md` 768 and at `lg` 1024, but the decision names two
width classes, narrow and wide. The mockups each used their own media queries. Tests run at 402 and
1440 only. Where `useWidthClass()` is the one owner, `SpecContents` (1100) and `Blocks.tsx` already
copy the rule.

| Option                                                                                                       | Meaning for the layout decision                                                                                                                                              | Half-screen behaviour (960 px, 1280 px)                                                | Existing tests and checks                                                                             | Copies of the rule                                                        |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| A. Keep two classes, and make wide layouts fold themselves: auto-fold of columns by the width the column has | Unchanged. The rule says "two width classes", and a fold is behaviour inside wide                                                                                            | 960 px gets a folded sidebar rail and a closed column by default, then opens on demand | The page matrix at 402 and 1440 stays. A test is needed at a width between 768 and 1023, today absent | One more place that learns a width, unless folded by `useWidthOf`         |
| B. A third class near 840 to 1199 (Material 3 "expanded"), in the theme                                      | Amended: "three width classes", and the sheets and dialogs mapping must say what medium does                                                                                 | A planned layout for 840 to 1199, with a rail and an overlay pane. 1280 is "large"     | The matrix gains a size. The fix-testing spec keeps the matrix                                        | `SHOWN_FROM` and the 1024 step collapse into the class                    |
| C. Container queries on each pane, with the two viewport classes kept                                        | The decision forbids "per-view media queries"; a container query is not a media query, but a ruling is needed on "through the theme". The shell would still use the viewport | A pane adapts to the width it has, whatever the columns around it                      | Per-pane widths are tested at several sizes. No container query exists in the code                    | Replaces `useWidthOf`'s three uses. StyleX 0.19.1 support was not checked |

The Android sources say that once panes resize, a viewport query cannot tell a pane its width.
Chrome's guidance says macro layout by media query and micro layout by container query. Material 3
is a design for phones and tablets, and Uraeda's wide screens are desktop windows, so how far its
thresholds carry over is judgement.

### Prototypes in the workflow

This topic is whether throwaway HTML or images count as part of an investigation, whether they are
kept or deleted, and what the skill and the preview decision say. It relies on
[the proposal's two sections on prototypes](#the-preview-decision-requires-storybook-mockups-and-the-proposal-asks-for-throwaway-prototypes),
[the skill's mockup rules](/skills/uraeda/references/spec.md#mockups), and
[visual questions](/skills/uraeda/references/discovery.md#visual-questions).

| Option                                                                                                      | Preview decision                                                                                                       | Constitution II (design in git)                                                   | Cost                                                                              | Fidelity to the direction                  | What the skill changes                                                                          |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| A. Throwaway HTML or images are allowed in an investigation, and deleted when the spec writes the direction | Conflicts as written. The decision would say "unless an investigation's visual question asks for throwaway prototypes" | The spec's words and tokens stay. The prototype goes, though git history holds it | Lowest                                                                            | Unconstrained by lint: any effect          | `discovery.md` visual questions, `spec.md` mockups, the two templates and the example, together |
| B. Throwaway prototypes are allowed and kept in the feature folder as a record                              | Same conflict                                                                                                          | The prototype stays in git as plain text                                          | Low, plus its size in the repository                                              | Same as A                                  | As A, plus a rule on where a kept prototype lives                                               |
| C. Prototypes are always Storybook stories built from the real components                                   | No conflict. The decision applies                                                                                      | Stories are code in git, and the picked one is the first commit of its view       | Highest: five directions in StyleX and Astryx, through lint, before one is picked | Limited to what the theme and lint allow   | None. The spec's current rules stay                                                             |
| D. HTML for choosing, Storybook for the picked direction                                                    | Conflicts for the choosing step only                                                                                   | The picked direction becomes stories and stays                                    | Medium: five HTML, one story set                                                  | Choice unconstrained, shipping constrained | A rule on the handoff from HTML to stories                                                      |

How a person opens a mockup in Uraeda also differs per option: stories embed live in questions and
specs, while a mockup folder opens in the sandboxed mockup frame, with the checks under
[Worth it and feasibility](#worth-it-and-feasibility). The sandbox decision's SHOULD says variants
stay stories.

### Colour modes

This topic is which themes the UI offers. It relies on
[the checks decision](/specs/decisions/ui-checks.md), the theme code, and
[the mockups' light and dark](#the-visual-direction).

| Option                    | Checks decision                                                                           | Settings                                 | Mockup coverage                                                                              | Work                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| A. Light and dark (today) | Met as is                                                                                 | Appearance keeps system, light, and dark | Natural, glass, and blueprint have both. Cyber and terminal would need a light version drawn | Every token has a pair, and every view is checked in both |
| B. Dark only              | The decision asks for "both themes", so it would change, and the screenshot matrix halves | Appearance loses the mode choice         | Cyber and terminal fit                                                                       | One set of tokens. Light users lose their mode            |
| C. Light only             | Same change                                                                               | Same                                     | Natural, glass, and blueprint have a light form                                              | One set of tokens. Dark users lose their mode             |

iA advises against pure black on pure white, and Zenless Zone Zero's critique says white on black
looks heavier, so dark UIs need lighter weights. WCAG does not require two themes.

### Priorities layout

This topic is how Ongoing, Now, Next, and Later appear on the Priorities page. It relies on
[Linear, Things, Obsidian](#linear-things-obsidian-and-other-productivity-apps),
[accessible reordering](#accessible-reordering), and [WorkList](#important-reads).

| Option                                                                      | Hierarchy readable at a glance                                 | Half-width                                                                                              | Reordering without dragging                                                  | Existing code                                                          |
| --------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| A. One vertical grouped list with sticky group headers                      | Group by weight and order; Things' lists map nearly one to one | Reads at any width                                                                                      | Menu actions beside the drag handle, such as "Move to Now" and "Move to top" | `WorkList` is this today. Priorities has a Section control in the pane |
| B. Four columns that scroll sideways, as the natural and cyber mockups draw | All four groups visible side by side on a wide screen          | Shows one or two columns at 960 px. Trello users report this cost, and Linear uses Shift plus the wheel | Dragging across columns, plus menu actions                                   | A new layout in `WorkList`, with `useDroppable` per column             |
| C. Hybrid: columns on large widths, a list below                            | Both, by width                                                 | A list at 960 px                                                                                        | Same as A and B                                                              | Both layouts to maintain                                               |

The proposal says the columns are "Not a requirement, just an idea", and its first goal is "CLEARLY
SEEING THE HIERARCHY OF TASKS + their status". The terminal mockup draws a buffer-like list with
relative line numbers, and the blueprint mockup a schedule where line weight carries the order.
Disabling drag while a sort is active is GitHub Projects' rule and is not in Uraeda's list today,
which has one fixed order.

### Icon set

This topic is which icon library the UI draws, beyond the 29 and 53 icons it has. It relies on
[Icon sets](#icon-sets), [Astryx](#astryx-components-and-theme-levers), and
[the lint limits](#important-reads).

| Option                                                        | Licence | Count            | Fit with today                                            | Weights for directions | Notes                                                 |
| ------------------------------------------------------------- | ------- | ---------------- | --------------------------------------------------------- | ---------------------- | ----------------------------------------------------- |
| A. Lucide, extended                                           | ISC     | 2,167            | 82 icons already drawn in this style, and Astryx takes it | One stroke style       | `icons.ts` splits first (482 of 500 lines)            |
| B. Phosphor                                                   | MIT     | 1,512 per weight | A new style beside the 82                                 | Six weights            | Last React release 2025-05-22                         |
| C. Tabler                                                     | MIT     | 5,184 outline    | Same 24 grid and 2 px stroke, so mixes with Lucide        | Outline and filled     | Frequent releases                                     |
| D. Pixelarticons for a terminal look, with Lucide as fallback | MIT     | 1,036            | A second style                                            | Pixel look             | Includes git glyphs                                   |
| E. Custom icons per direction                                 | Own     | As drawn         | Nothing reused                                            | As drawn               | Largest effort, and the mockups' 49 icons are a start |

Remix Icon's licence forbids use as a logo, which matters only if icons double as the logo. The "＋"
bug needs a `plus` icon under every option.

### Logo

This topic is the mark for the app, its favicon, and the "approved" stamp. It relies on
[the bonsai vocabulary](#japanese-design-bonsai-vocabulary-and-the-authors-own-sites) and
[fonts](#fonts).

[logos.html](/specs/2026-10-20-layout-look/mockups/logos.html) draws all five concepts at 96, 32,
and 16 px, light and dark. The natural mockup carries its own small bonsai mark beside the name
and 裏枝. The concepts come from Mon (family crest) conventions, which are "essentially monochrome",
and the ensō, a circle drawn in one stroke.

| Option                  | Idea                                                               | Monochrome and inverted       | Small size                         | Meaning                               | Needs                                          |
| ----------------------- | ------------------------------------------------------------------ | ----------------------------- | ---------------------------------- | ------------------------------------- | ---------------------------------------------- |
| A. Back-branch mon      | A circle with a trunk and one branch behind it, only its tip shown | Yes, by construction of a mon | Circle and trunk                   | The 裏枝 itself                       | A drawn SVG                                    |
| B. Ensō with a bud      | An open brush circle whose gap is bridged by a bud                 | Yes                           | A thick stroke                     | "Work never quite finished"           | A drawn SVG                                    |
| C. Git fork as a bonsai | Nodes and lines in the shape of a small tree                       | Yes                           | Reads as a graph at 16 px          | Git-driven, and a branch is a feature | A drawn SVG                                    |
| D. Vermilion seal       | A hanko stamp with two characters, also the "approved" stamp       | Colour is part of it          | Depends on the characters at 16 px | Approval                              | A Japanese serif font, or the characters drawn |
| E. Dot-matrix tree      | A pixel bonsai on a grid                                           | Yes                           | Crisp on a grid                    | Terminal look, grows dot by dot       | A pixel grid                                   |

Favicon rules from the research: one solid shape, no hairlines under 1.5 px at 32 px, tested at 16
px on light and dark tabs, and an SVG favicon can follow `prefers-color-scheme`. These were not
checked in a browser tab.

### Harness marks

This topic is how the UI shows which agent program runs a session. It relies on
[Harness marks and trademarks](#harness-marks-and-trademarks).

| Option                                     | Trademark constraint                                                                                                                                                                                           | Recognisable                  | Theme fit                            | Dependency                                                                                                              |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| A. Own neutral glyphs, as the mockups draw | None                                                                                                                                                                                                           | Low until learned (judgement) | Fully themed                         | None                                                                                                                    |
| B. Official marks                          | Anthropic: prior approval and no alteration, and recolouring counts as alteration. OpenAI: no alteration, approval for co-branding. Gemini CLI: guidelines PDF unread. Cursor and opencode publish brand pages | High                          | Cannot be recoloured for Claude Code | lobe-icons static SVG (MIT, no dependencies, six harnesses) or simple-icons (CC0, five harnesses, none for Codex or Pi) |
| C. A text label or initials                | None                                                                                                                                                                                                           | Reads by name                 | Fully themed                         | None                                                                                                                    |

The mockups use stand-ins, so they do not alter an official mark.

### Dependencies and fonts

This topic is which fonts and which libraries the UI adds. It relies on [Fonts](#fonts),
[Panel libraries](#panel-drawer-and-palette-libraries), and
[StyleX and the lint](#stylex-and-the-lint-that-guards-it).

| Option                                                | Components decision                                                                                                  | Network and guards                                                      | Licence                           | Test and lint                                                                                     |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------- |
| A. Self-hosted open-licence font files in the app     | Needs a way to register them through the theme                                                                       | No external request                                                     | OFL                               | The stylesheet allowlist would need a fourth entry, or the theme build a font facility, unchecked |
| B. Google Fonts or another CDN, as the mockups do     | A stylesheet outside the allowlist                                                                                   | An external request on every load, and the local server needs a network | OFL fonts, service terms not read | Same allowlist change                                                                             |
| C. System fonts only, as the app does today in effect | No change                                                                                                            | None                                                                    | None                              | None                                                                                              |
| D. Astryx components only, no panel library           | Met                                                                                                                  | None                                                                    | None                              | None                                                                                              |
| E. Add react-resizable-panels or cmdk                 | A raw dependency where Astryx has `Resizable`, `Layout`, and `CommandPalette`. It must be pinned to an exact version | None                                                                    | MIT                               | A new check line in `ready`, as the toolchain decision asks                                       |

Fonts and libraries combine: A, B, or C with D or E. A font family count differs by direction:
natural uses three, cyber three, terminal one, glass two, blueprint four.

### Needs no choice

- **The feature colour option.** It is removed by merge-chats, so no question remains.
- **Storybook access on the feature home.** The proposal says to remove it, and the change is one
  line in `FileList`. The wider question of other Storybook entries is raised under
  [the proposal](#the-storybook-link-on-the-feature-home-is-one-of-several-ways-in).
- **One scroll with a sticky question header, for clarifications.** The one-question-at-a-time
  evidence is mixed and mostly vendor data. Later questions refer back to earlier ones, and the
  skill's reading order assumes one pass. WCAG 2.4.11 needs `scroll-padding` for the sticky header
  in any direction.
- **The Inbox as a categorised list with reordering.** The proposal specifies it. Menu actions
  beside dragging follow the accessible-reordering guidance, and the Inbox shares `WorkList` with
  Priorities.
- **Ownership of the New page.** Merge-chats owns the page, its three kinds, and its picker. This
  feature only restyles them, so each kind must look distinct as the proposal asks.
- **A reduce-effects setting and `prefers-reduced-motion`.** Honouring `prefers-reduced-motion` is
  required for any motion under WCAG 2.3.3 and is supported in all three engines. An in-app toggle
  for transparency matters only with a glass look, since WebKit cannot read the OS setting, and its
  cost is listed under that direction.
- **Text contrast thresholds.** 4.5:1 for text and 3:1 for non-text parts, from WCAG 1.4.3 and
  1.4.11. The checks decision already asks for readability and accessibility checks at both sizes
  and both themes.
- **Keyboard navigation staying out of scope.** It has its own priorities item, and visible controls
  stay required by the behaviour decision.
- **The decisions page content.** The proposal sets it: constitution first, then decisions with
  filter and search, then a rendered page with an edit option. Only its look is open, in every
  direction.
- **A session list grouped by whose move it is, and one status vocabulary.** Merge-chats already
  groups and orders the list, and the coherence decision requires one component per kind of
  information, so a direction only restyles them.
- **Pull request state on a row, collapsed agent activity, and comments anchored to parts.** These
  exist in the code already: cards show pull request and line counts, tool calls fold, and the spec
  has anchored comments.
- **A command palette, a diff panel beside the session, a waterfall lens, a weekly usage window, and
  snooze or pin.** They are behaviour beyond a visual pass. The scope question is raised once under
  [the proposal](#the-proposal-says-almost-only-ui-while-the-capabilities-users-expect-add-behaviour).
  A direction's look needs no choice for them.
- **Item detail in a peek, a side panel, or a full page.** The pane beside a list and the full draft
  page already exist, and the proposal says drafts open on a page of their own.
- **A sidebar in three states and a bottom bar on the phone.** These are shell patterns, decided in
  [mixing directions](#mixing-directions) and [width classes](#width-classes).
- **Deterministic layouts.** A criterion of the home centrepiece under
  [mixing directions](#mixing-directions), not a topic.
- **Reordering without dragging.** Covered under [priorities layout](#priorities-layout).
- **Notifications on two events.** They exist, under an active decision. Only their placement moves
  with the shell.
- **Isolation per task.** Worktrees exist already, outside this feature.

## Not checked

- **Not reached**: openai.com/brand and the OpenAI academy page (403), the Typeform help article on
  its two layouts (403), Superhuman help pages (403 or 404), the Arc help centre (403), Linear's
  peek docs and Raycast's root search page (404), Notion's side-peek page (404), the Material 3
  pages on m3.material.io (404 or empty), the HIG pages for sidebars and Liquid Glass adoption
  (empty body, the JSON versions were read), react-resizable-panels' docs site (empty), arwes.dev
  (refused), Berkeley Mono's shop page (403), and the Fontworks column on the Neon Genesis
  Evangelion fonts (redirected).
- **Snippet only**: the Kotobank-adjacent Shikoku Shimbun glossary, Arc's 2023 release notes,
  Atlassian's Browser Company deal, the Codex five-hour meter's disappearance, Warp's vertical tabs,
  GDC talks on Cyberpunk 2077 and Destiny, the Territory Studio interviews, the Wuthering Waves and
  Honkai: Star Rail articles, the reading-speed studies on monospace (Jarosch 2019, Payne, Morris),
  Nothing OS's use of Geist, the Typeform and Fillout completion tests, Obsidian's live preview not
  being reusable, iA Writer Duo's licence, and the Korean 오방색 and 단청 sources.
- **Not searched in depth**: Yuque, Craft's focus mode, Chinese and Korean UI design galleries
  (zcool and ui.cn were unreachable), Reddit, Hacker News, and X threads, and Akira's HUDs.
  WebSearch is limited to the United States, which limits CJK recall.
- **Not tested**: how the mockups run inside Uraeda's own mockup page (a local file server with the
  same sandbox header was tested), and whether the frame loads the Google fonts there. Whether an
  uncommitted `mockups` folder is served. How a link to a nested mockup file opens in Uraeda. The
  mockups in Safari, WebKit, or Firefox: the README says they were checked in Chromium only. The
  favicon concepts in a browser tab. Whether any ProseMirror or Lexical editor can be configured to
  keep the file byte for byte, an editor's bundle size, Atomic Editor's behaviour on the
  repository's files, and a CodeMirror client for `ura lsp`. Whether Astryx's `BottomSheet`,
  `CommandPalette`, and `Resizable` meet the needs above, and whether StyleX 0.19.1 supports
  container queries and keyframes within the app's lint.
- **Not read**: the Gemini CLI guidelines PDF, the licences of Rajdhani, Figtree, and Barlow
  Condensed, a bundle-size comparison of any library, and which colour pairs the mockups draw for
  each measured token.
- **Not found**: an official description of status icons in the Codex and Claude desktop sidebars,
  the sessions list and usage display of Devin and Factory, Linear's narrow-window behaviour, and
  any hanok-inspired or 国风 interface examples first-hand.
