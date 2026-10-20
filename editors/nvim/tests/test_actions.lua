local helpers = dofile("tests/helpers.lua")
local eq = MiniTest.expect.equality

-- The day a start writes, and the time a pasted image is named after, read by the server from its
-- environment, inherited from the child: set for this file's cases only.
local dates = { URA_TODAY = "2026-10-14", URA_NOW = "20261014-104733" }
local saved = {}

local child = helpers.new_child()
--- (Re)starts the child with `config`, keeping every notification in `_G.notes`, as
--- { message, level }.
local function setup(config)
  child.setup(config)
  child.lua([[
    _G.notes = {}
    vim.notify = function(message, level)
      table.insert(_G.notes, { message, level })
    end
  ]])
end

local T = MiniTest.new_set({
  hooks = {
    pre_case = function()
      for name, value in pairs(dates) do
        saved[name], vim.env[name] = vim.env[name], value
      end
      setup()
    end,
    post_case = function()
      for name in pairs(dates) do
        vim.env[name] = saved[name]
      end
    end,
    post_once = child.stop,
  },
})

local later = "# Priorities\n\n## Now\n\n## Next\n\n## Later\n\n- Codex runtime\n\n## Blocked\n"
local linked = later:gsub("%- Codex runtime", "- [Codex runtime](drafts/codex-runtime.md)")
local draft_text = "# Codex runtime\n\n## What\n\nA runtime.\n"
local ERROR = vim.log.levels.ERROR

--- Waits up to 5 s for the child's current buffer to be the file at `path`.
local function wait_buffer(path)
  return child.lua(
    "local path = ... return vim.wait(5000, function() return vim.api.nvim_buf_get_name(0) == path end, 20)",
    { path }
  )
end

--- Waits up to 5 s for an error notification in the child, and returns the error notifications.
local function errors()
  child.lua([[vim.wait(5000, function()
    return vim.iter(_G.notes):any(function(note) return note[2] == vim.log.levels.ERROR end)
  end, 20)]])
  return vim.tbl_filter(function(note)
    return note[2] == ERROR
  end, child.lua_get("_G.notes"))
end

--- Waits up to 5 s for the last commit of the repository at `repo` to be `subject`.
local function wait_commit(repo, subject)
  child.lua(
    [[local repo, subject = ...
      vim.wait(5000, function()
        local log = vim.system({ "git", "-C", repo, "log", "-1", "--format=%s" }):wait()
        return vim.trim(log.stdout or "") == subject
      end, 50)]],
    { repo, subject }
  )
end

local function read(path)
  local file = assert(io.open(path, "rb"))
  local text = file:read("*a")
  file:close()
  return text
end

local function subjects(repo, ref)
  return vim.split(vim.trim(helpers.git(repo, { "log", "--format=%s", ref or "HEAD" })), "\n")
end

--- Edits `path`, waits for its client, and puts the cursor on `line`.
local function open(path, line)
  helpers.edit(child, path)
  eq(helpers.wait_client(child), true)
  if line then
    child.api.nvim_win_set_cursor(0, { line, 0 })
  end
end

T["a line becomes a draft"] = function()
  local repo = helpers.repo({ ["specs/PRIORITIES.md"] = later })
  local priorities = repo .. "/specs/PRIORITIES.md"
  open(priorities, 9)

  child.type_keys("\\an")

  local draft = repo .. "/specs/drafts/codex-runtime.md"
  eq(wait_buffer(draft), true)
  eq(vim.tbl_contains(vim.split(read(draft), "\n"), "# Codex runtime"), true)
  local buf = child.lua_get("vim.fn.bufnr(...)", { priorities })
  eq(
    child.lua_get("vim.api.nvim_buf_get_lines(..., 8, 9, false)", { buf }),
    { "- [Codex runtime](drafts/codex-runtime.md)" }
  )
  eq(subjects(repo), { "chore: start" })
  eq(helpers.hook_runs(repo), 0)
end

T["a linked line opens its draft"] = function()
  local repo = helpers.repo({
    ["specs/PRIORITIES.md"] = linked,
    ["specs/drafts/codex-runtime.md"] = draft_text,
  })
  open(repo .. "/specs/PRIORITIES.md", 9)

  child.cmd("Uraeda draft")

  eq(wait_buffer(repo .. "/specs/drafts/codex-runtime.md"), true)
  eq(helpers.git(repo, { "status", "--porcelain" }), "")
end

T["an unsaved priorities file is saved first"] = function()
  local repo = helpers.repo({ ["specs/PRIORITIES.md"] = later })
  local priorities = repo .. "/specs/PRIORITIES.md"
  open(priorities)
  child.lua("vim.api.nvim_buf_set_lines(0, 8, 8, false, { '- Benchmarks' })")
  child.api.nvim_win_set_cursor(0, { 10, 0 })

  child.type_keys("\\an")

  eq(wait_buffer(repo .. "/specs/drafts/codex-runtime.md"), true)
  eq(
    vim.list_slice(vim.split(read(priorities), "\n"), 9, 10),
    { "- Benchmarks", "- [Codex runtime](drafts/codex-runtime.md)" }
  )
end

T["a draft starts a feature"] = function()
  local repo = helpers.repo({
    ["specs/PRIORITIES.md"] = linked,
    ["specs/drafts/codex-runtime.md"] = draft_text,
  })
  local draft = repo .. "/specs/drafts/codex-runtime.md"
  open(draft)

  child.type_keys("\\ap")

  local folder = "2026-10-14-codex-runtime"
  local proposal = ("%s/.worktrees/%s/specs/%s/proposal.md"):format(repo, folder, folder)
  eq(wait_buffer(proposal), true)
  eq(child.lua_get("vim.fn.bufexists(...)", { draft }), 0)
  eq(subjects(repo, "main")[1], "chore(codex-runtime): start Codex runtime")
  eq(subjects(repo, folder)[1], "chore(codex-runtime): start Codex runtime")
  eq(helpers.hook_runs(repo), 1)
  child.lua([[vim.wait(1000, function()
    return vim.iter(_G.notes):any(function(note) return note[1]:find("^Started") end)
  end, 20)]])
  eq(child.lua_get("_G.notes"), {
    { "Starting Codex runtime…", vim.log.levels.INFO },
    { "Started " .. folder, vim.log.levels.INFO },
  })
end

T["a spec cannot be started"] = function()
  local repo = helpers.repo(helpers.example())
  local spec = repo .. "/specs/2026-10-06-recurring-tasks/spec.md"
  open(spec)

  child.cmd("Uraeda start")

  eq(errors(), { { "Only a draft or a backlog file can be started.", ERROR } })
  eq(helpers.git(repo, { "status", "--porcelain" }), "")
  eq(child.lua_get("vim.api.nvim_buf_get_name(0)"), spec)
end

T["a draft is committed"] = function()
  local repo = helpers.repo(helpers.example())
  local priorities = repo .. "/specs/PRIORITIES.md"
  helpers.write(priorities, read(priorities) .. "\n- [Codex runtime](drafts/codex-runtime.md)\n")
  helpers.write(repo .. "/specs/drafts/codex-runtime.md", draft_text)
  open(repo .. "/specs/drafts/codex-runtime.md")

  child.type_keys("\\ag")

  wait_commit(repo, "chore: draft Codex runtime")
  eq(subjects(repo)[1], "chore: draft Codex runtime")
  eq(helpers.git(repo, { "status", "--porcelain" }), "")

  open(repo .. "/specs/2026-10-06-recurring-tasks/spec.md")
  child.type_keys("\\ag")
  eq(errors(), {
    {
      "Only drafts, backlog files, proposals, PRIORITIES.md, and INBOX.md are committed from the editor.",
      ERROR,
    },
  })
end

T["a buffer closed while a command runs"] = function()
  local repo = helpers.repo({ ["specs/PRIORITIES.md"] = later })
  helpers.write(repo .. "/specs/PRIORITIES.md", linked)
  helpers.write(repo .. "/specs/drafts/codex-runtime.md", draft_text)
  helpers.set_hook(repo, 'sleep 1\necho run >> "$(git rev-parse --git-common-dir)/hook-runs"')
  local draft = repo .. "/specs/drafts/codex-runtime.md"
  open(draft)

  child.cmd("Uraeda commit")
  child.cmd("bwipeout! " .. vim.fn.fnameescape(draft))

  wait_commit(repo, "chore: draft Codex runtime")
  eq(subjects(repo)[1], "chore: draft Codex runtime")

  open(draft)
  child.cmd("Uraeda start")
  child.cmd("bwipeout! " .. vim.fn.fnameescape(draft))

  local folder = "2026-10-14-codex-runtime"
  local proposal = ("%s/.worktrees/%s/specs/%s/proposal.md"):format(repo, folder, folder)
  eq(wait_buffer(proposal), true)
  eq(subjects(repo, "main")[1], "chore(codex-runtime): start Codex runtime")
  eq(subjects(repo, folder)[1], "chore(codex-runtime): start Codex runtime")
  child.lua("vim.wait(200)")
  eq(
    vim.tbl_filter(function(note)
      return note[2] == ERROR
    end, child.lua_get("_G.notes")),
    {}
  )
  eq(child.lua_get("vim.v.errmsg"), "")
end

local images = vim.fs.joinpath(helpers.root, "fixtures", "images")
local desktop = vim.fs.joinpath(images, "desktop.png")
local folder = "2026-10-14-login-banner"
local banner = "# Login banner\n\n## What\n\nThe banner covers the login button:\n\n## Why\n"
local pasted = "![pasted image](images/pasted-20261014-104733.webp)"

--- A repository whose feature `2026-10-14-login-banner` has its proposal in its worktree. Returns
--- the repository and the proposal's path.
local function with_proposal()
  local repo = helpers.repo({ ["specs/PRIORITIES.md"] = later }, {
    [folder] = { [("specs/%s/proposal.md"):format(folder)] = banner },
  })
  return repo, ("%s/.worktrees/%s/specs/%s/proposal.md"):format(repo, folder, folder)
end

--- Waits up to 5 s for line `line` of the child's current buffer to be `text`, and returns it.
local function wait_line(line, text)
  return child.lua(
    [[local line, text = ...
      vim.wait(5000, function()
        return vim.api.nvim_buf_get_lines(0, line - 1, line, false)[1] == text
      end, 20)
      return vim.api.nvim_buf_get_lines(0, line - 1, line, false)[1] ]],
    { line, text }
  )
end

local function exists(path)
  return vim.uv.fs_stat(path) ~= nil
end

T["US5.1: the clipboard's image is linked at the cursor, in one undo step"] = function()
  setup({ clipboard = { "cat", desktop } })
  local _, proposal = with_proposal()
  open(proposal, 6)

  child.cmd("Uraeda image")

  eq(wait_line(6, pasted), pasted)
  local saved = vim.fs.joinpath(vim.fs.dirname(proposal), "images/pasted-20261014-104733.webp")
  eq(read(saved):sub(9, 12), "WEBP")
  local notes = child.lua_get("_G.notes")
  eq(notes[#notes], { "uraeda: added images/pasted-20261014-104733.webp", vim.log.levels.INFO })
  child.type_keys("u")
  eq(
    child.lua_get("vim.api.nvim_buf_get_lines(0, 0, -1, false)"),
    vim.split(banner:sub(1, -2), "\n")
  )
end

T["US5.2: a file named after the command is linked"] = function()
  local _, proposal = with_proposal()
  open(proposal, 6)

  child.cmd("Uraeda image " .. vim.fn.fnameescape(desktop))

  local link = "![desktop](images/desktop.webp)"
  eq(wait_line(6, link), link)
  eq(exists(vim.fs.joinpath(vim.fs.dirname(proposal), "images/desktop.webp")), true)
end

T["US5.3: a single-file draft becomes a folder, reopened with the link"] = function()
  setup({ clipboard = { "cat", desktop } })
  local repo = helpers.repo({
    ["specs/PRIORITIES.md"] = later:gsub(
      "%- Codex runtime",
      "- [Login banner](drafts/login-banner.md)"
    ),
    ["specs/drafts/login-banner.md"] = banner,
  })
  local draft = repo .. "/specs/drafts/login-banner.md"
  open(draft, 6)

  child.cmd("Uraeda image")

  local moved = repo .. "/specs/drafts/login-banner/proposal.md"
  eq(wait_buffer(moved), true)
  eq(wait_line(6, pasted), pasted)
  eq(exists(draft), false)
  eq(child.lua_get("vim.fn.bufexists(...)", { draft }), 0)
  local notes = child.lua_get("_G.notes")
  eq(notes[#notes], {
    "uraeda: added images/pasted-20261014-104733.webp; the draft is now a folder",
    vim.log.levels.INFO,
  })
  eq(exists(repo .. "/specs/drafts/login-banner/images/pasted-20261014-104733.webp"), true)
end

T["US5.4: a clipboard holding text saves nothing"] = function()
  setup({ clipboard = { "echo", "text" } })
  local _, proposal = with_proposal()
  open(proposal, 6)

  child.cmd("Uraeda image")

  eq(errors(), { { "uraeda: the clipboard holds no image", ERROR } })
  eq(exists(vim.fs.joinpath(vim.fs.dirname(proposal), "images")), false)
  eq(child.lua_get("vim.bo.modified"), false)
end

T["the core's refusals are prefixed"] = function()
  local _, proposal = with_proposal()
  open(proposal, 6)

  child.cmd("Uraeda image " .. vim.fn.fnameescape(vim.fs.joinpath(images, "drawing.svg")))

  eq(errors(), {
    { "uraeda: Only PNG, JPEG, GIF, and WebP images can be added: drawing.svg is not one.", ERROR },
  })
  eq(exists(vim.fs.joinpath(vim.fs.dirname(proposal), "images")), false)
end

T["a missing clipboard tool is named"] = function()
  local _, proposal = with_proposal()
  open(proposal, 6)
  -- A Wayland session whose PATH has neither wl-paste nor xclip.
  local dir = vim.fn.tempname()
  vim.fn.mkdir(dir, "p")
  child.lua(
    "vim.env.PATH, vim.env.WAYLAND_DISPLAY, vim.env.DISPLAY = ..., 'wayland-1', nil",
    { dir }
  )

  child.cmd("Uraeda image")

  eq(errors(), {
    { "uraeda: no clipboard tool found: install wl-clipboard, xclip, or pngpaste", ERROR },
  })
end

T["a buffer edited while the command runs gets the link at the cursor's place"] = function()
  local _, proposal = with_proposal()
  open(proposal, 6)

  -- The edit lands before the server answers: both run before the child reads its messages.
  child.lua(
    [[vim.cmd("Uraeda image " .. vim.fn.fnameescape(...))
      vim.api.nvim_buf_set_lines(0, 0, 0, false, { "Above" })]],
    { desktop }
  )

  local link = "![desktop](images/desktop.webp)"
  eq(wait_line(7, link), link)
  eq(child.lua_get("vim.api.nvim_buf_get_lines(0, 0, 1, false)"), { "Above" })
end

T["the link goes after the character under the cursor, as p puts text"] = function()
  setup({ clipboard = { "cat", desktop } })
  for _, line in ipairs({ "See the login form:", "See the login form →" }) do
    local _, proposal = with_proposal()
    open(proposal)
    child.api.nvim_buf_set_lines(0, 4, 5, false, { line })
    -- The cursor on the last character, as after typing it: `:`, or the three bytes of `→`.
    local last = line:find("→") and #line - 3 or #line - 1
    child.api.nvim_win_set_cursor(0, { 5, last })

    child.cmd("Uraeda image")

    eq(wait_line(5, line .. pasted), line .. pasted)
    eq(child.api.nvim_win_get_cursor(0), { 5, #line + #pasted - 1 })
  end
end

T["an empty line takes the link at its start"] = function()
  setup({ clipboard = { "cat", desktop } })
  local _, proposal = with_proposal()
  open(proposal, 6)

  child.cmd("Uraeda image")

  eq(wait_line(6, pasted), pasted)
  eq(child.api.nvim_win_get_cursor(0), { 6, #pasted - 1 })
end

T["a refused paste leaves no temporary file and no mark"] = function()
  -- Starts as a PNG does, so the plugin sends it, and the core refuses it.
  local broken = vim.fn.tempname()
  helpers.write(broken, "\137PNG\r\n\26\nnot an image")
  setup({ clipboard = { "cat", broken } })
  local _, proposal = with_proposal()
  open(proposal, 6)

  child.cmd("Uraeda image")

  local found = errors()
  eq(#found, 1)
  eq(vim.startswith(found[1][1], "uraeda: "), true)
  eq(child.lua_get("vim.fn.readdir(vim.fn.fnamemodify(vim.fn.tempname(), ':h'))"), {})
  eq(
    child.lua_get(
      "vim.api.nvim_buf_get_extmarks(0, vim.api.nvim_create_namespace('uraeda.image'), 0, -1, {})"
    ),
    {}
  )
end

T["a draft edited while it moves keeps the edits in its new buffer"] = function()
  setup({ clipboard = { "cat", desktop } })
  local repo = helpers.repo({
    ["specs/PRIORITIES.md"] = later:gsub(
      "%- Codex runtime",
      "- [Login banner](drafts/login-banner.md)"
    ),
    ["specs/drafts/login-banner.md"] = banner,
  })
  local draft = repo .. "/specs/drafts/login-banner.md"
  open(draft, 6)

  -- The edit lands before the server answers: both run before the child reads its messages.
  child.lua([[vim.cmd("Uraeda image")
    vim.api.nvim_buf_set_lines(0, 0, 0, false, { "Above" })]])

  local moved = repo .. "/specs/drafts/login-banner/proposal.md"
  eq(wait_buffer(moved), true)
  eq(wait_line(7, pasted), pasted)
  eq(child.lua_get("vim.api.nvim_buf_get_lines(0, 0, 1, false)"), { "Above" })
  eq(child.lua_get("vim.bo.modified"), true)
  eq(child.lua_get("vim.fn.bufexists(...)", { draft }), 0)
  child.cmd("wall")
  eq(exists(draft), false)
  eq(vim.split(read(moved), "\n")[1], "Above")
end

T["a missing clipboard command is named"] = function()
  setup({ clipboard = { "no-such-clipboard-tool" } })
  local _, proposal = with_proposal()
  open(proposal, 6)

  child.cmd("Uraeda image")

  eq(errors(), { { "uraeda: clipboard command not found: no-such-clipboard-tool", ERROR } })
end

--- A folder holding a fake clipboard tool `name`, logging its arguments to `<folder>/log`, and
--- running `script`; returns the folder.
local function fake_tool(name, script)
  local dir = vim.fn.tempname()
  local log = vim.fs.joinpath(dir, "log")
  helpers.write(
    vim.fs.joinpath(dir, name),
    ('#!/bin/sh\necho "$*" >> "%s"\n%s\n'):format(log, script)
  )
  vim.uv.fs_chmod(vim.fs.joinpath(dir, name), tonumber("755", 8))
  return dir, log
end

T["wl-paste gives the first image type it lists"] = function()
  local dir, log = fake_tool(
    "wl-paste",
    ([[case "$*" in
  "--list-types") printf 'text/plain\nimage/png\n' ;;
  "--type image/png") cat "%s" ;;
  *) exit 1 ;;
esac]]):format(desktop)
  )
  local _, proposal = with_proposal()
  open(proposal, 6)
  child.lua("vim.env.PATH, vim.env.WAYLAND_DISPLAY, vim.env.DISPLAY = ..., 'wayland-1', nil", {
    dir .. ":" .. vim.env.PATH,
  })

  child.cmd("Uraeda image")

  eq(wait_line(6, pasted), pasted)
  eq(vim.split(vim.trim(read(log)), "\n"), { "--list-types", "--type image/png" })
end

T["xclip gives the first image type it lists"] = function()
  local dir, log = fake_tool(
    "xclip",
    ([[case "$*" in
  "-selection clipboard -t TARGETS -o") printf 'TARGETS\nUTF8_STRING\nimage/png\n' ;;
  "-selection clipboard -t image/png -o") cat "%s" ;;
  *) exit 1 ;;
esac]]):format(desktop)
  )
  local _, proposal = with_proposal()
  open(proposal, 6)
  child.lua("vim.env.PATH, vim.env.WAYLAND_DISPLAY, vim.env.DISPLAY = ..., nil, ':0'", {
    dir .. ":" .. vim.env.PATH,
  })

  child.cmd("Uraeda image")

  eq(wait_line(6, pasted), pasted)
  eq(
    vim.split(vim.trim(read(log)), "\n"),
    { "-selection clipboard -t TARGETS -o", "-selection clipboard -t image/png -o" }
  )
end

T["an action other than image takes no argument"] = function()
  local repo = helpers.repo({ ["specs/PRIORITIES.md"] = linked })
  open(repo .. "/specs/PRIORITIES.md", 9)

  child.cmd("Uraeda draft now")

  eq(errors(), { { "Uraeda: draft takes no arguments.", ERROR } })
  eq(child.lua_get("vim.api.nvim_buf_get_name(0)"), repo .. "/specs/PRIORITIES.md")
end

return T
